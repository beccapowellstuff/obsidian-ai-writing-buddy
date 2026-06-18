import type { AiWritingBuddyContextRetrievalMode } from "./ai-writing-buddy-context";

export type AiWritingBuddyRagChunk = {
	id: string;
	filePath: string;
	fileTitle: string;
	fileHash: string;
	chunkIndex: number;
	headingPath?: string[];
	startLine?: number;
	endLine?: number;
	text: string;
	embedding?: number[];
	embeddingDimension?: number;
	retrievalMode: AiWritingBuddyContextRetrievalMode;
	updatedAt: number;
};

export type AiWritingBuddyRagIndexedFile = {
	filePath: string;
	fileTitle: string;
	fileHash: string;
	embeddingModel?: string;
	embeddingDimension?: number;
	retrievalMode: AiWritingBuddyContextRetrievalMode;
	chunkCount: number;
	indexedAt: number;
};

export type AiWritingBuddyRagSearchResult = AiWritingBuddyRagChunk & {
	score: number;
	totalChunkCount: number;
};

export type AiWritingBuddyRagSearchOptions = {
	maxChunks: number;
	maxContextCharacters: number;
	similarityThreshold: number;
};

export type AiWritingBuddyRagIndexStatusState = "idle" | "indexing" | "completed" | "failed";

export type AiWritingBuddyRagIndexStatus = {
	state: AiWritingBuddyRagIndexStatusState;
	indexedFileCount: number;
	totalMarkdownFileCount: number;
	processedFileCount: number;
	currentFilePath?: string;
	lastIndexedAt?: number;
	retrievalMode?: AiWritingBuddyContextRetrievalMode;
	lastError?: string;
};

export type AiWritingBuddyRagFileIndexResult = {
	file: AiWritingBuddyRagIndexedFile;
	usedKeywordFallback: boolean;
	errorMessage?: string;
};
