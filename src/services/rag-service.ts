import { App, MarkdownView, Notice, TFile } from "obsidian";
import type { AiWritingBuddySettings } from "../config/default-settings";
import type { AiWritingBuddyChatNoteContext, AiWritingBuddyContextScope, AiWritingBuddyNoteContext } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyRagIndexedFile, AiWritingBuddyRagSearchResult } from "../types/rag-index";
import { EmbeddingService } from "./embedding-service";
import { RagFileIndexer } from "./rag-file-indexer";
import { RagIndexStore } from "./rag-index-store";

const MAX_RETRIEVED_CHUNKS = 8;
const MAX_SCOPED_CHUNKS_WHEN_INDEXED_RAG_INCLUDED = 4;
const MAX_RETRIEVED_CONTEXT_CHARACTERS = 30000;
const DEFAULT_SIMILARITY_THRESHOLD = 0.12;

export class RagService {
	private readonly fileIndexer: RagFileIndexer;

	constructor(
		private readonly app: App,
		private readonly settings: AiWritingBuddySettings,
		private readonly store: RagIndexStore,
	) {
		this.fileIndexer = new RagFileIndexer(this.app, this.settings, this.store);
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
			new Notice(`Indexing ${file.basename} for context...`);
			console.debug("AI Writing Buddy RAG indexing file", file.path);

			const result = await this.fileIndexer.ensureFileIndexed(file);

			indexingResults.push({ file, indexedFile: result.file });

			if (result.usedKeywordFallback) {
				usedKeywordFallback = true;

				if (result.errorMessage) {
					new Notice(`Context is using keyword fallback for ${file.basename}.`);
				}
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

	private async reindexFilesWithMismatchedEmbeddingDimensions(indexingResults: Array<{ file: TFile; indexedFile: AiWritingBuddyRagIndexedFile }>, queryEmbeddingDimension: number): Promise<void> {
		for (const result of indexingResults) {
			if (result.indexedFile.retrievalMode !== "embedding" || result.indexedFile.embeddingDimension === queryEmbeddingDimension) {
				continue;
			}

			new Notice(`Re-indexing ${result.file.basename} for embedding dimensions...`);
			console.debug("AI Writing Buddy RAG embedding dimension changed; re-indexing file", result.file.path);

			result.indexedFile = await this.fileIndexer.reindexFileWithEmbeddings(result.file);
			await this.yieldToUi();
		}
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

		const addChunk = (chunk: AiWritingBuddyRagSearchResult): boolean => {
			if (selectedChunks.length >= MAX_RETRIEVED_CHUNKS || seenChunkIds.has(chunk.id)) {
				return false;
			}

			if (usedCharacters + chunk.text.length > MAX_RETRIEVED_CONTEXT_CHARACTERS && selectedChunks.length > 0) {
				return false;
			}

			selectedChunks.push(chunk);
			seenChunkIds.add(chunk.id);
			usedCharacters += chunk.text.length;

			return true;
		};

		if (indexedRagSearchResults.length === 0) {
			for (const chunk of scopedSearchResults) {
				addChunk(chunk);
			}

			return selectedChunks;
		}

		let scopedChunkCount = 0;

		for (const chunk of scopedSearchResults) {
			if (scopedChunkCount >= MAX_SCOPED_CHUNKS_WHEN_INDEXED_RAG_INCLUDED) {
				break;
			}

			if (addChunk(chunk)) {
				scopedChunkCount += 1;
			}
		}

		for (const chunk of indexedRagSearchResults) {
			addChunk(chunk);
		}

		for (const chunk of scopedSearchResults) {
			addChunk(chunk);
		}

		return selectedChunks;
	}

	private createEmbeddingService(): EmbeddingService {
		return new EmbeddingService(this.settings);
	}

	private async yieldToUi(): Promise<void> {
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, 0);
		});
	}
}
