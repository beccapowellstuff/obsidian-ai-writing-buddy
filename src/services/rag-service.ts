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

type RagRetrievalResults = {
	scopedSearchResults: AiWritingBuddyRagSearchResult[];
	indexedRagSearchResults: AiWritingBuddyRagSearchResult[];
	usedKeywordFallback: boolean;
};

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

		const retrievalResults = await this.searchMixedRetrieval(query, fileMetadataByPath, indexingResults, scopedFilePaths, indexedRagFilePaths, true);
		const scopedSearchResults = retrievalResults.scopedSearchResults;
		const indexedRagSearchResults = retrievalResults.indexedRagSearchResults;
		usedKeywordFallback = usedKeywordFallback || retrievalResults.usedKeywordFallback;

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
		const fileMetadataByPath = new Map(indexedFiles.map((file) => [file.filePath, file]));
		const retrievalResults = await this.searchMixedRetrieval(query, fileMetadataByPath, [], scopeFilePaths, [], false);
		const searchResults = this.prioritizeScopedSearchResults(retrievalResults.scopedSearchResults, []);
		const usedKeywordFallback = retrievalResults.usedKeywordFallback;

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

	private async searchMixedRetrieval(
		query: string,
		fileMetadataByPath: Map<string, AiWritingBuddyRagIndexedFile>,
		indexingResults: Array<{ file: TFile; indexedFile: AiWritingBuddyRagIndexedFile }>,
		scopedFilePaths: string[],
		indexedRagFilePaths: string[],
		allowScopedReindex: boolean,
	): Promise<RagRetrievalResults> {
		let queryEmbedding: number[] | undefined;
		let usedKeywordFallback = false;
		const nonEmptyFiles = [...fileMetadataByPath.values()].filter((file) => file.chunkCount > 0);
		const hasEmbeddingCandidates = nonEmptyFiles.some((file) => file.retrievalMode === "embedding");

		if (hasEmbeddingCandidates && this.createEmbeddingService().isConfigured()) {
			try {
				queryEmbedding = (await this.createEmbeddingService().embedTexts([query])).embeddings[0];

				if (!queryEmbedding) {
					throw new Error("Embedding provider did not return a query vector.");
				}

				if (allowScopedReindex) {
					await this.reindexFilesWithMismatchedEmbeddingDimensions(indexingResults, queryEmbedding.length);
					this.refreshFileMetadata(fileMetadataByPath, indexingResults);
				}
			} catch (error) {
				usedKeywordFallback = true;
				console.warn("AI Writing Buddy RAG query embedding failed; using keyword fallback.", error);
				new Notice("Context is using keyword fallback.");
			}
		}

		const scopedEmbeddingFilePaths = this.getEmbeddingSearchFilePaths(scopedFilePaths, fileMetadataByPath, queryEmbedding);
		const indexedEmbeddingFilePaths = this.getEmbeddingSearchFilePaths(indexedRagFilePaths, fileMetadataByPath, queryEmbedding);
		const scopedKeywordFilePaths = this.getKeywordSearchFilePaths(scopedFilePaths, fileMetadataByPath, queryEmbedding);
		const indexedKeywordFilePaths = this.getKeywordSearchFilePaths(indexedRagFilePaths, fileMetadataByPath, queryEmbedding);

		if (scopedKeywordFilePaths.length + indexedKeywordFilePaths.length > 0) {
			usedKeywordFallback = true;
		}

		const scopedEmbeddingResults =
			queryEmbedding && scopedEmbeddingFilePaths.length > 0
				? await this.store.searchEmbeddingChunks(queryEmbedding, scopedEmbeddingFilePaths, {
						maxChunks: MAX_RETRIEVED_CHUNKS,
						maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
						similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
					})
				: [];
		const indexedEmbeddingResults =
			queryEmbedding && indexedEmbeddingFilePaths.length > 0
				? await this.store.searchEmbeddingChunks(queryEmbedding, indexedEmbeddingFilePaths, {
						maxChunks: MAX_RETRIEVED_CHUNKS,
						maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
						similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
					})
				: [];
		const scopedKeywordResults =
			scopedKeywordFilePaths.length > 0
				? await this.store.searchKeywordChunks(query, scopedKeywordFilePaths, {
						maxChunks: MAX_RETRIEVED_CHUNKS,
						maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
						similarityThreshold: 0,
					})
				: [];
		const indexedKeywordResults =
			indexedKeywordFilePaths.length > 0
				? await this.store.searchKeywordChunks(query, indexedKeywordFilePaths, {
						maxChunks: MAX_RETRIEVED_CHUNKS,
						maxContextCharacters: MAX_RETRIEVED_CONTEXT_CHARACTERS,
						similarityThreshold: 0,
					})
				: [];

		return {
			scopedSearchResults: [...scopedEmbeddingResults, ...scopedKeywordResults],
			indexedRagSearchResults: [...indexedEmbeddingResults, ...indexedKeywordResults],
			usedKeywordFallback,
		};
	}

	private getEmbeddingSearchFilePaths(filePaths: string[], fileMetadataByPath: Map<string, AiWritingBuddyRagIndexedFile>, queryEmbedding: number[] | undefined): string[] {
		if (!queryEmbedding) {
			return [];
		}

		return filePaths.filter((filePath) => {
			const file = fileMetadataByPath.get(filePath);

			return file?.retrievalMode === "embedding" && file.chunkCount > 0 && file.embeddingDimension === queryEmbedding.length;
		});
	}

	private getKeywordSearchFilePaths(filePaths: string[], fileMetadataByPath: Map<string, AiWritingBuddyRagIndexedFile>, queryEmbedding: number[] | undefined): string[] {
		return filePaths.filter((filePath) => {
			const file = fileMetadataByPath.get(filePath);

			if (!file || file.chunkCount === 0) {
				return false;
			}

			if (!queryEmbedding) {
				return true;
			}

			return file.retrievalMode === "keyword" || file.embeddingDimension !== queryEmbedding.length;
		});
	}

	private async reindexFilesWithMismatchedEmbeddingDimensions(indexingResults: Array<{ file: TFile; indexedFile: AiWritingBuddyRagIndexedFile }>, queryEmbeddingDimension: number): Promise<void> {
		for (const result of indexingResults) {
			if (result.indexedFile.retrievalMode !== "embedding" || result.indexedFile.chunkCount === 0 || result.indexedFile.embeddingDimension === queryEmbeddingDimension) {
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
