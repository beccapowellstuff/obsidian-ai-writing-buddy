import { App, MarkdownView, Notice, TFile } from "obsidian";
import { join } from "path";
import type { AiWritingBuddySettings } from "../config/default-settings";
import type { AiWritingBuddyChatNoteContext, AiWritingBuddyContextRetrievalMode, AiWritingBuddyContextScope, AiWritingBuddyNoteContext } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyRagChunk, AiWritingBuddyRagIndexedFile, AiWritingBuddyRagSearchResult } from "../types/rag-index";
import { EmbeddingService } from "./embedding-service";
import { RagChunker } from "./rag-chunker";
import { RagIndexStore } from "./rag-index-store";

const MAX_RETRIEVED_CHUNKS = 8;
const MAX_RETRIEVED_CONTEXT_CHARACTERS = 30000;
const DEFAULT_SIMILARITY_THRESHOLD = 0.12;

export class RagService {
	private readonly chunker = new RagChunker();
	private readonly store: RagIndexStore;

	constructor(
		private readonly app: App,
		private readonly settings: AiWritingBuddySettings,
		pluginRootPath: string,
	) {
		this.store = new RagIndexStore(join(pluginRootPath, "rag-index", "embeddings.db"));
	}

	async getContext(scope: AiWritingBuddyContextScope, query: string, includeIndexedRag: boolean): Promise<AiWritingBuddyChatNoteContext | undefined> {
		if (scope === "indexed-notes") {
			return this.getIndexedNotesContext(scope, query);
		}

		const files = this.getScopeFiles(scope);

		if (files.length === 0 && !includeIndexedRag) {
			return undefined;
		}

		const indexingResults: Array<{ file: TFile; indexedFile: AiWritingBuddyRagIndexedFile }> = [];
		let usedKeywordFallback = false;

		for (const file of files) {
			const result = await this.ensureFileIndexed(file);

			indexingResults.push(result);

			if (result.indexedFile.retrievalMode === "keyword") {
				usedKeywordFallback = true;
			}

			await this.yieldToUi();
		}

		const indexedFiles = includeIndexedRag ? await this.store.listIndexedFiles() : [];
		const fileMetadataByPath = new Map<string, AiWritingBuddyRagIndexedFile>();

		for (const indexedFile of indexedFiles) {
			fileMetadataByPath.set(indexedFile.filePath, indexedFile);

			if (indexedFile.retrievalMode === "keyword") {
				usedKeywordFallback = true;
			}
		}

		for (const result of indexingResults) {
			fileMetadataByPath.set(result.indexedFile.filePath, result.indexedFile);
		}

		const scopedFilePaths = indexingResults.map((result) => result.indexedFile.filePath);
		const indexedRagFilePaths = indexedFiles.map((file) => file.filePath).filter((filePath) => !scopedFilePaths.includes(filePath));
		const scopeFilePaths = [...scopedFilePaths, ...indexedRagFilePaths];

		if (scopeFilePaths.length === 0) {
			return undefined;
		}

		const retrievalMode = usedKeywordFallback ? "keyword" : "embedding";
		let scopedSearchResults: AiWritingBuddyRagSearchResult[] = [];
		let indexedRagSearchResults: AiWritingBuddyRagSearchResult[] = [];

		if (retrievalMode === "embedding") {
			try {
				const queryEmbedding = (await this.createEmbeddingService().embedTexts([query])).embeddings[0];

				if (!queryEmbedding) {
					throw new Error("Embedding provider did not return a query vector.");
				}

				await this.reindexFilesWithMismatchedEmbeddingDimensions(indexingResults, queryEmbedding.length);
				this.refreshFileMetadata(fileMetadataByPath, indexingResults);

				const dimensionCompatibleFilePaths = [...fileMetadataByPath.values()]
					.filter((file) => file.retrievalMode === "embedding" && file.embeddingDimension === queryEmbedding.length)
					.map((file) => file.filePath);

				if (dimensionCompatibleFilePaths.length < fileMetadataByPath.size) {
					usedKeywordFallback = true;
				}

				const dimensionCompatibleScopedFilePaths = dimensionCompatibleFilePaths.filter((filePath) => scopedFilePaths.includes(filePath));
				const dimensionCompatibleIndexedRagFilePaths = dimensionCompatibleFilePaths.filter((filePath) => indexedRagFilePaths.includes(filePath));

				scopedSearchResults = await this.store.searchEmbeddingChunks(queryEmbedding, dimensionCompatibleScopedFilePaths, {
					maxChunks: MAX_RETRIEVED_CHUNKS,
					maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
					similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
				});
				indexedRagSearchResults = await this.store.searchEmbeddingChunks(queryEmbedding, dimensionCompatibleIndexedRagFilePaths, {
					maxChunks: MAX_RETRIEVED_CHUNKS,
					maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
					similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
				});
			} catch (error) {
				usedKeywordFallback = true;
				console.warn("AI Writing Buddy RAG query embedding failed; using keyword fallback.", error);
				new Notice("Context is using keyword fallback.");
			}
		}

		if (usedKeywordFallback || scopedSearchResults.length + indexedRagSearchResults.length === 0) {
			scopedSearchResults = await this.store.searchKeywordChunks(query, scopedFilePaths, {
				maxChunks: MAX_RETRIEVED_CHUNKS,
				maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
				similarityThreshold: 0,
			});
			indexedRagSearchResults = await this.store.searchKeywordChunks(query, indexedRagFilePaths, {
				maxChunks: MAX_RETRIEVED_CHUNKS,
				maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
				similarityThreshold: 0,
			});
		}

		const searchResults = this.prioritizeScopedSearchResults(scopedSearchResults, indexedRagSearchResults);
		const notes = this.createNoteContexts(searchResults, [...fileMetadataByPath.values()]);

		if (notes.length === 0) {
			return undefined;
		}

		return {
			scope,
			notes,
			retrievalMode: usedKeywordFallback ? "keyword" : "embedding",
			usedKeywordFallback,
			includeIndexedRag,
		};
	}

	private async getIndexedNotesContext(scope: AiWritingBuddyContextScope, query: string): Promise<AiWritingBuddyChatNoteContext | undefined> {
		const indexedFiles = await this.store.listIndexedFiles();

		if (indexedFiles.length === 0) {
			return undefined;
		}

		const scopeFilePaths = indexedFiles.map((file) => file.filePath);
		let usedKeywordFallback = indexedFiles.some((file) => file.retrievalMode === "keyword");
		let searchResults: AiWritingBuddyRagSearchResult[] = [];

		if (!usedKeywordFallback && this.createEmbeddingService().isConfigured()) {
			try {
				const queryEmbedding = (await this.createEmbeddingService().embedTexts([query])).embeddings[0];

				if (!queryEmbedding) {
					throw new Error("Embedding provider did not return a query vector.");
				}

				const dimensionCompatibleFiles = indexedFiles.filter((file) => file.retrievalMode === "embedding" && file.embeddingDimension === queryEmbedding.length);

				searchResults = await this.store.searchEmbeddingChunks(queryEmbedding, dimensionCompatibleFiles.map((file) => file.filePath), {
					maxChunks: MAX_RETRIEVED_CHUNKS,
					maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
					similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
				});

				if (dimensionCompatibleFiles.length < indexedFiles.length) {
					usedKeywordFallback = true;
				}
			} catch (error) {
				usedKeywordFallback = true;
				console.warn("AI Writing Buddy indexed-note query embedding failed; using keyword fallback.", error);
				new Notice("Indexed notes are using keyword fallback.");
			}
		} else {
			usedKeywordFallback = true;
		}

		if (usedKeywordFallback || searchResults.length === 0) {
			searchResults = await this.store.searchKeywordChunks(query, scopeFilePaths, {
				maxChunks: MAX_RETRIEVED_CHUNKS,
				maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
				similarityThreshold: 0,
			});
		}

		const notes = this.createNoteContexts(searchResults, indexedFiles);

		if (notes.length === 0) {
			return undefined;
		}

		return {
			scope,
			notes,
			retrievalMode: usedKeywordFallback ? "keyword" : "embedding",
			usedKeywordFallback,
			includeIndexedRag: scope === "indexed-notes",
		};
	}

	private refreshFileMetadata(fileMetadataByPath: Map<string, AiWritingBuddyRagIndexedFile>, indexingResults: Array<{ file: TFile; indexedFile: AiWritingBuddyRagIndexedFile }>): void {
		for (const result of indexingResults) {
			fileMetadataByPath.set(result.indexedFile.filePath, result.indexedFile);
		}
	}

	private async ensureFileIndexed(file: TFile): Promise<{ file: TFile; indexedFile: AiWritingBuddyRagIndexedFile }> {
		const content = await this.app.vault.cachedRead(file);
		const fileHash = await this.hashText(content);
		const indexedFile = await this.store.getIndexedFile(file.path);
		const desiredMode: AiWritingBuddyContextRetrievalMode = this.createEmbeddingService().isConfigured() ? "embedding" : "keyword";

		if (this.canReuseIndex(indexedFile, fileHash, desiredMode)) {
			return { file, indexedFile };
		}

		new Notice(`Indexing ${file.basename} for context...`);
		console.debug("AI Writing Buddy RAG indexing file", file.path);

		if (desiredMode === "embedding") {
			try {
				const indexed = await this.indexFileWithEmbeddings(file, content, fileHash);
				return { file, indexedFile: indexed };
			} catch (error) {
				console.warn("AI Writing Buddy embedding indexing failed; storing keyword chunks.", error);
				new Notice(`Context is using keyword fallback for ${file.basename}.`);
			}
		}

		const indexed = await this.indexFileWithKeywords(file, content, fileHash);
		return { file, indexedFile: indexed };
	}

	private canReuseIndex(indexedFile: AiWritingBuddyRagIndexedFile | null, fileHash: string, desiredMode: AiWritingBuddyContextRetrievalMode): indexedFile is AiWritingBuddyRagIndexedFile {
		if (!indexedFile || indexedFile.fileHash !== fileHash || indexedFile.retrievalMode !== desiredMode) {
			return false;
		}

		if (desiredMode === "keyword") {
			return true;
		}

		const embeddingModel = this.createEmbeddingService().getEmbeddingModel();

		return indexedFile.embeddingModel === embeddingModel && typeof indexedFile.embeddingDimension === "number" && indexedFile.embeddingDimension > 0;
	}

	private async reindexFilesWithMismatchedEmbeddingDimensions(indexingResults: Array<{ file: TFile; indexedFile: AiWritingBuddyRagIndexedFile }>, queryEmbeddingDimension: number): Promise<void> {
		for (const result of indexingResults) {
			if (result.indexedFile.retrievalMode !== "embedding" || result.indexedFile.embeddingDimension === queryEmbeddingDimension) {
				continue;
			}

			new Notice(`Re-indexing ${result.file.basename} for embedding dimensions...`);
			console.debug("AI Writing Buddy RAG embedding dimension changed; re-indexing file", result.file.path);

			const content = await this.app.vault.cachedRead(result.file);
			const fileHash = await this.hashText(content);

			result.indexedFile = await this.indexFileWithEmbeddings(result.file, content, fileHash);
			await this.yieldToUi();
		}
	}

	private async indexFileWithEmbeddings(file: TFile, content: string, fileHash: string): Promise<AiWritingBuddyRagIndexedFile> {
		const chunkerChunks = this.chunker.chunk(file, content);
		const embeddingService = this.createEmbeddingService();
		const embeddingResult = await embeddingService.embedTexts(chunkerChunks.map((chunk) => chunk.text));
		const now = Date.now();
		const chunks: AiWritingBuddyRagChunk[] = chunkerChunks.map((chunk, index) => ({
			...chunk,
			fileHash,
			embedding: embeddingResult.embeddings[index],
			embeddingDimension: embeddingResult.dimension,
			retrievalMode: "embedding",
			updatedAt: now,
		}));
		const indexedFile: AiWritingBuddyRagIndexedFile = {
			filePath: file.path,
			fileTitle: file.basename,
			fileHash,
			embeddingModel: embeddingResult.model,
			embeddingDimension: embeddingResult.dimension,
			retrievalMode: "embedding",
			chunkCount: chunks.length,
			indexedAt: now,
		};

		await this.store.upsertFileIndex(indexedFile, chunks);

		return indexedFile;
	}

	private async indexFileWithKeywords(file: TFile, content: string, fileHash: string): Promise<AiWritingBuddyRagIndexedFile> {
		const chunkerChunks = this.chunker.chunk(file, content);
		const now = Date.now();
		const chunks: AiWritingBuddyRagChunk[] = chunkerChunks.map((chunk) => ({
			...chunk,
			fileHash,
			retrievalMode: "keyword",
			updatedAt: now,
		}));
		const indexedFile: AiWritingBuddyRagIndexedFile = {
			filePath: file.path,
			fileTitle: file.basename,
			fileHash,
			retrievalMode: "keyword",
			chunkCount: chunks.length,
			indexedAt: now,
		};

		await this.store.upsertFileIndex(indexedFile, chunks);

		return indexedFile;
	}

	private createNoteContexts(searchResults: AiWritingBuddyRagSearchResult[], indexedFiles: AiWritingBuddyRagIndexedFile[]): AiWritingBuddyNoteContext[] {
		const fileMetadataByPath = new Map(indexedFiles.map((file) => [file.filePath, file]));
		const chunksByPath = new Map<string, AiWritingBuddyRagSearchResult[]>();

		for (const result of searchResults) {
			chunksByPath.set(result.filePath, [...(chunksByPath.get(result.filePath) ?? []), result]);
		}

		return [...chunksByPath.entries()].map(([filePath, chunks]) => {
			const sortedChunks = chunks.slice().sort((left, right) => left.chunkIndex - right.chunkIndex);
			const metadata = fileMetadataByPath.get(filePath);
			const totalChunkCount = metadata?.chunkCount ?? sortedChunks[0]?.totalChunkCount ?? sortedChunks.length;
			const retrievalMode = sortedChunks.some((chunk) => chunk.retrievalMode === "keyword") ? "keyword" : "embedding";

			return {
				path: filePath,
				title: metadata?.fileTitle ?? sortedChunks[0]?.fileTitle ?? filePath,
				content: sortedChunks.map((chunk) => this.formatRetrievedChunk(chunk)).join("\n\n"),
				wasTruncated: sortedChunks.length < totalChunkCount,
				contentSource: "retrieved-chunks",
				retrievalMode,
				retrievedChunkCount: sortedChunks.length,
				totalChunkCount,
				chunks: sortedChunks.map((chunk) => ({
					id: chunk.id,
					chunkIndex: chunk.chunkIndex,
					headingPath: chunk.headingPath,
					startLine: chunk.startLine,
					endLine: chunk.endLine,
					text: chunk.text,
					score: chunk.score,
					retrievalMode: chunk.retrievalMode,
				})),
			};
		});
	}

	private formatRetrievedChunk(chunk: AiWritingBuddyRagSearchResult): string {
		return [
			`[Excerpt chunk ${chunk.chunkIndex + 1} of ${chunk.totalChunkCount}]`,
			chunk.headingPath && chunk.headingPath.length > 0 ? `Heading: ${chunk.headingPath.join(" > ")}` : "",
			typeof chunk.startLine === "number" && typeof chunk.endLine === "number" ? `Lines: ${chunk.startLine}-${chunk.endLine}` : "",
			`Retrieval: ${chunk.retrievalMode}`,
			"Text:",
			chunk.text,
		]
			.filter(Boolean)
			.join("\n");
	}

	private getScopeFiles(scope: AiWritingBuddyContextScope): TFile[] {
		if (scope === "current-note") {
			const activeFile = this.getCurrentMarkdownFile();
			return this.isMarkdownFile(activeFile) ? [activeFile] : [];
		}

		return this.getOpenMarkdownFiles();
	}

	private getCurrentMarkdownFile(): TFile | null {
		const activeEditorFile = this.app.workspace.activeEditor?.file;

		if (this.isMarkdownFile(activeEditorFile)) {
			return activeEditorFile;
		}

		const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (this.isMarkdownFile(activeMarkdownView?.file)) {
			return activeMarkdownView.file;
		}

		return this.app.workspace.getActiveFile();
	}

	private getOpenMarkdownFiles(): TFile[] {
		const files: TFile[] = [];
		const seenPaths = new Set<string>();
		const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");

		for (const leaf of markdownLeaves) {
			const view = leaf.view;

			if (!(view instanceof MarkdownView) || !this.isMarkdownFile(view.file) || seenPaths.has(view.file.path)) {
				continue;
			}

			seenPaths.add(view.file.path);
			files.push(view.file);
		}

		return files;
	}

	private isMarkdownFile(file: TFile | null | undefined): file is TFile {
		return file instanceof TFile && file.extension.toLowerCase() === "md";
	}

	private prioritizeScopedSearchResults(scopedSearchResults: AiWritingBuddyRagSearchResult[], indexedRagSearchResults: AiWritingBuddyRagSearchResult[]): AiWritingBuddyRagSearchResult[] {
		const selectedChunks: AiWritingBuddyRagSearchResult[] = [];
		const seenChunkIds = new Set<string>();
		let usedCharacters = 0;

		for (const chunk of [...scopedSearchResults, ...indexedRagSearchResults]) {
			if (selectedChunks.length >= MAX_RETRIEVED_CHUNKS || seenChunkIds.has(chunk.id)) {
				continue;
			}

			if (usedCharacters + chunk.text.length > MAX_RETRIEVED_CONTEXT_CHARACTERS && selectedChunks.length > 0) {
				continue;
			}

			selectedChunks.push(chunk);
			seenChunkIds.add(chunk.id);
			usedCharacters += chunk.text.length;
		}

		return selectedChunks;
	}

	private createEmbeddingService(): EmbeddingService {
		return new EmbeddingService(this.settings);
	}

	private async hashText(text: string): Promise<string> {
		const data = new TextEncoder().encode(text);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashBytes = Array.from(new Uint8Array(hashBuffer));

		return hashBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
	}

	private async yieldToUi(): Promise<void> {
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, 0);
		});
	}
}
