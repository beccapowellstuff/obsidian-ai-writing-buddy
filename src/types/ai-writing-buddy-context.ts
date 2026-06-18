export type AiWritingBuddyContextScope = "current-note" | "open-notes" | "indexed-notes";

export type AiWritingBuddyContextOptions = {
	enabled: boolean;
	scope: AiWritingBuddyContextScope;
	includeIndexedRag: boolean;
};

export type AiWritingBuddyContextRetrievalMode = "embedding" | "keyword";

export type AiWritingBuddyRetrievedChunk = {
	id: string;
	chunkIndex: number;
	headingPath?: string[];
	startLine?: number;
	endLine?: number;
	text: string;
	score: number;
	retrievalMode: AiWritingBuddyContextRetrievalMode;
	selectedBy: AiWritingBuddyContextRetrievalMode;
	storedRetrievalMode: AiWritingBuddyContextRetrievalMode;
};

export type AiWritingBuddyNoteContext = {
	path: string;
	title: string;
	content: string;
	wasTruncated: boolean;
	contentSource: "retrieved-chunks";
	retrievalMode: AiWritingBuddyContextRetrievalMode;
	retrievedChunkCount?: number;
	totalChunkCount?: number;
	chunks?: AiWritingBuddyRetrievedChunk[];
};

export type AiWritingBuddyChatNoteContext = {
	scope: AiWritingBuddyContextScope;
	notes: AiWritingBuddyNoteContext[];
	retrievalMode: AiWritingBuddyContextRetrievalMode;
	usedKeywordFallback: boolean;
	includeIndexedRag: boolean;
};

export type AiWritingBuddyUsedContext = {
	scope: AiWritingBuddyContextScope;
	retrievalMode: AiWritingBuddyContextRetrievalMode;
	usedKeywordFallback: boolean;
	includeIndexedRag: boolean;
	notes: Array<{
		title: string;
		path: string;
		contentIncluded: boolean;
		wasTruncated: boolean;
		contentSource: "retrieved-chunks";
		retrievalMode: AiWritingBuddyContextRetrievalMode;
		retrievedChunkCount?: number;
		totalChunkCount?: number;
	}>;
};
