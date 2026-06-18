import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("obsidian", () => {
	class TFile {
		path: string;
		basename: string;
		extension: string;

		constructor(path = "") {
			this.path = path;
			this.basename = path
				? (path
						.split("/")
						.pop()
						?.replace(/\.[^.]+$/, "") ?? path)
				: "";
			this.extension = path ? (path.split(".").pop() ?? "") : "";
		}
	}

	class MarkdownView {
		file: TFile | null;

		constructor(file: TFile | null = null) {
			this.file = file;
		}
	}

	class Notice {
		constructor(_message: string) {}
	}

	return {
		MarkdownView,
		Notice,
		TFile,
	};
});

const ragStoreMocks = vi.hoisted(() => ({
	getIndexedFile: vi.fn(),
	listIndexedFiles: vi.fn(),
	searchEmbeddingChunks: vi.fn(),
	searchKeywordChunks: vi.fn(),
	upsertFileIndex: vi.fn(),
}));

vi.mock("../../src/services/rag-index-store", () => ({
	RagIndexStore: class {
		async getIndexedFile(filePath: string): Promise<AiWritingBuddyRagIndexedFile | null> {
			return ragStoreMocks.getIndexedFile(filePath) as Promise<AiWritingBuddyRagIndexedFile | null>;
		}

		async listIndexedFiles(): Promise<AiWritingBuddyRagIndexedFile[]> {
			return ragStoreMocks.listIndexedFiles() as Promise<AiWritingBuddyRagIndexedFile[]>;
		}
		async searchEmbeddingChunks(embedding: number[], scopeFilePaths: string[], options: unknown): Promise<AiWritingBuddyRagSearchResult[]> {
			return ragStoreMocks.searchEmbeddingChunks(embedding, scopeFilePaths, options) as Promise<AiWritingBuddyRagSearchResult[]>;
		}

		async searchKeywordChunks(query: string, scopeFilePaths: string[], options: unknown): Promise<AiWritingBuddyRagSearchResult[]> {
			return ragStoreMocks.searchKeywordChunks(query, scopeFilePaths, options) as Promise<AiWritingBuddyRagSearchResult[]>;
		}

		async upsertFileIndex(file: unknown, chunks: unknown[]): Promise<void> {
			return ragStoreMocks.upsertFileIndex(file, chunks) as Promise<void>;
		}
	},
}));

import { TFile, type App } from "obsidian";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { RagIndexStore } from "../../src/services/rag-index-store";
import { RagService } from "../../src/services/rag-service";
import type { AiWritingBuddyRagIndexedFile, AiWritingBuddyRagSearchResult } from "../../src/types/rag-index";

type MockWorkspace = {
	activeEditor: { file: TFile | null } | null;
	getActiveViewOfType: Mock<() => { file: TFile | null } | null>;
	getActiveFile: Mock<() => TFile | null>;
	getLeavesOfType: Mock<() => Array<{ view: { file: TFile } }>>;
};

type MockApp = {
	workspace: MockWorkspace;
	vault: {
		cachedRead: Mock<(file: TFile) => Promise<string>>;
	};
};

function createMarkdownFile(path: string): TFile {
	const file = new TFile();

	Object.assign(file, {
		path,
		basename:
			path
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") ?? path,
		extension: path.split(".").pop() ?? "",
	});

	return file;
}

function createApp(options: { activeEditorFile?: TFile | null; activeViewFile?: TFile | null; activeFile?: TFile | null; openFiles?: TFile[] }): MockApp {
	return {
		workspace: {
			activeEditor: options.activeEditorFile === undefined ? null : { file: options.activeEditorFile },
			getActiveViewOfType: vi.fn(() => (options.activeViewFile === undefined ? null : { file: options.activeViewFile })),
			getActiveFile: vi.fn(() => options.activeFile ?? null),
			getLeavesOfType: vi.fn(() => (options.openFiles ?? []).map((file) => ({ view: { file } }))),
		},
		vault: {
			cachedRead: vi.fn(async () => "Current note body"),
		},
	};
}

function createIndexedFile(file: TFile): AiWritingBuddyRagIndexedFile {
	return {
		filePath: file.path,
		fileTitle: file.basename,
		fileHash: `${file.path}-hash`,
		retrievalMode: "keyword",
		chunkCount: 1,
		indexedAt: 1,
	};
}

function createEmbeddingIndexedFile(file: TFile, embeddingDimension = 3): AiWritingBuddyRagIndexedFile {
	return {
		filePath: file.path,
		fileTitle: file.basename,
		fileHash: `${file.path}-hash`,
		embeddingModel: "text-embedding-test",
		embeddingDimension,
		retrievalMode: "embedding",
		chunkCount: 1,
		indexedAt: 1,
	};
}

function createZeroChunkEmbeddingIndexedFile(file: TFile): AiWritingBuddyRagIndexedFile {
	return {
		filePath: file.path,
		fileTitle: file.basename,
		fileHash: `${file.path}-hash`,
		embeddingModel: "text-embedding-test",
		retrievalMode: "embedding",
		chunkCount: 0,
		indexedAt: 1,
	};
}

function createSearchResult(file: TFile, score: number): AiWritingBuddyRagSearchResult {
	return {
		id: `${file.path}::0`,
		filePath: file.path,
		fileTitle: file.basename,
		fileHash: `${file.path}-hash`,
		chunkIndex: 0,
		startLine: 1,
		endLine: 1,
		text: `${file.basename} text`,
		retrievalMode: "keyword",
		updatedAt: 1,
		score,
		totalChunkCount: 1,
	};
}

function createEmbeddingSearchResult(file: TFile, score: number): AiWritingBuddyRagSearchResult {
	return {
		...createSearchResult(file, score),
		retrievalMode: "embedding",
	};
}

function createLargeSearchResult(file: TFile, chunkIndex: number, textLength: number, retrievalMode: "embedding" | "keyword"): AiWritingBuddyRagSearchResult {
	return {
		...createSearchResult(file, 10 - chunkIndex),
		id: `${file.path}::${chunkIndex}`,
		chunkIndex,
		text: "x".repeat(textLength),
		retrievalMode,
		totalChunkCount: 16,
	};
}

function createRagIndexStore(): RagIndexStore {
	return new RagIndexStore(".");
}

function createEmbeddingSettings() {
	return {
		...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
		embeddingBaseUrl: "http://localhost:1234/v1",
		embeddingModelName: "text-embedding-test",
	};
}

describe("RagService", () => {
	beforeEach(() => {
		ragStoreMocks.getIndexedFile.mockResolvedValue(null);
		ragStoreMocks.listIndexedFiles.mockResolvedValue([]);
		ragStoreMocks.searchEmbeddingChunks.mockResolvedValue([]);
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([]);
		ragStoreMocks.upsertFileIndex.mockResolvedValue(undefined);

		vi.stubGlobal("window", {
			fetch: vi.fn(),
			clearTimeout: vi.fn(),
			setTimeout: (callback: () => void) => {
				callback();
				return 0;
			},
		});
	});

	it("uses the active markdown editor file for current-note context before the broader active file fallback", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const staleActiveFile = createMarkdownFile("Comics/To be Young.md");
		const app = createApp({
			activeEditorFile: currentFile,
			activeFile: staleActiveFile,
		});
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, createRagIndexStore());

		ragStoreMocks.searchKeywordChunks.mockResolvedValue([createSearchResult(currentFile, 1)]);

		await service.getContext("current-note", "what is the current note?", false);

		expect(app.vault.cachedRead).toHaveBeenCalledWith(currentFile);
		expect(app.workspace.getActiveFile).not.toHaveBeenCalled();
	});

	it("keeps current-note results ahead of optional indexed RAG results", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const indexedFile = createMarkdownFile("Comics/To be Young.md");
		const app = createApp({
			activeEditorFile: currentFile,
			activeFile: indexedFile,
		});
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, createRagIndexStore());
		const otherIndexedFile = createIndexedFile(indexedFile);
		const currentResult = createSearchResult(currentFile, 0);
		const indexedResult = createSearchResult(indexedFile, 10);

		ragStoreMocks.listIndexedFiles.mockResolvedValue([otherIndexedFile]);
		ragStoreMocks.searchKeywordChunks.mockImplementation(async (_query: string, scopeFilePaths: string[]) => {
			if (scopeFilePaths.includes(currentFile.path)) {
				return [currentResult];
			}

			if (scopeFilePaths.includes(indexedFile.path)) {
				return [indexedResult];
			}

			return [];
		});

		const context = await service.getContext("current-note", "what is the current note?", true);

		expect(context?.notes.map((note) => note.path)).toEqual([currentFile.path, indexedFile.path]);
		expect(ragStoreMocks.searchKeywordChunks).toHaveBeenCalledWith("what is the current note?", [currentFile.path], expect.any(Object));
		expect(ragStoreMocks.searchKeywordChunks).toHaveBeenCalledWith("what is the current note?", [indexedFile.path], expect.any(Object));
	});

	it("keeps room for indexed RAG results when the RAG toggle is enabled", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const indexedFile = createMarkdownFile("- Story Ideas/- Visual Transformation Methods.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, createRagIndexStore());
		const currentResults = Array.from({ length: 8 }, (_value, index) => ({
			...createSearchResult(currentFile, 8 - index),
			id: `${currentFile.path}::${index}`,
			chunkIndex: index,
		}));
		const indexedResult = createSearchResult(indexedFile, 1);

		ragStoreMocks.listIndexedFiles.mockResolvedValue([createIndexedFile(indexedFile)]);
		ragStoreMocks.searchKeywordChunks.mockImplementation(async (_query: string, scopeFilePaths: string[]) => {
			if (scopeFilePaths.includes(currentFile.path)) {
				return currentResults;
			}

			if (scopeFilePaths.includes(indexedFile.path)) {
				return [indexedResult];
			}

			return [];
		});

		const context = await service.getContext("current-note", "Digital Pixelation", true);
		const currentNoteChunkCount = context?.notes.find((note) => note.path === currentFile.path)?.retrievedChunkCount ?? 0;

		expect(context?.notes.map((note) => note.path)).toEqual([currentFile.path, indexedFile.path]);
		expect(currentNoteChunkCount).toBeLessThan(8);
		expect(context?.notes.find((note) => note.path === indexedFile.path)?.retrievedChunkCount).toBe(1);
		expect(context).toMatchObject({
			scope: "current-note",
			includeIndexedRag: true,
		});
	});

	it("searches all indexed files when indexed-notes is selected", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const indexedFile = createMarkdownFile("- Story Ideas/- Visual Transformation Methods.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, createRagIndexStore());
		const indexedMetadata = createIndexedFile(indexedFile);
		const indexedResult = createSearchResult(indexedFile, 10);

		ragStoreMocks.listIndexedFiles.mockResolvedValue([indexedMetadata]);
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([indexedResult]);

		const context = await service.getContext("indexed-notes", "Digital Pixelation", false);

		expect(app.vault.cachedRead).not.toHaveBeenCalled();
		expect(context).toMatchObject({
			scope: "indexed-notes",
			retrievalMode: "keyword",
			usedKeywordFallback: true,
			includeIndexedRag: true,
		});
		expect(context?.notes.map((note) => note.path)).toEqual([indexedFile.path]);
		expect(ragStoreMocks.searchKeywordChunks).toHaveBeenCalledWith("Digital Pixelation", [indexedFile.path], expect.any(Object));
	});

	it("reuses an unchanged keyword index without writing it again", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, createRagIndexStore());

		const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("Current note body"));
		const fileHash = Array.from(new Uint8Array(hashBuffer))
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");

		ragStoreMocks.getIndexedFile.mockResolvedValue({
			...createIndexedFile(currentFile),
			fileHash,
		});
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([createSearchResult(currentFile, 1)]);

		const context = await service.getContext("current-note", "what is the current note?", false);

		expect(ragStoreMocks.getIndexedFile).toHaveBeenCalledWith(currentFile.path);
		expect(ragStoreMocks.upsertFileIndex).not.toHaveBeenCalled();
		expect(context?.notes.map((note) => note.path)).toEqual([currentFile.path]);
	});

	it("re-indexes a keyword index when the file content hash changes", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, createRagIndexStore());

		ragStoreMocks.getIndexedFile.mockResolvedValue({
			...createIndexedFile(currentFile),
			fileHash: "stale-file-hash",
		});
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([createSearchResult(currentFile, 1)]);

		const context = await service.getContext("current-note", "what is the current note?", false);

		expect(ragStoreMocks.getIndexedFile).toHaveBeenCalledWith(currentFile.path);
		expect(ragStoreMocks.upsertFileIndex).toHaveBeenCalledTimes(1);
		expect(ragStoreMocks.upsertFileIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				filePath: currentFile.path,
				retrievalMode: "keyword",
			}),
			expect.any(Array),
		);
		expect(context?.notes.map((note) => note.path)).toEqual([currentFile.path]);
	});

	it("uses embedding retrieval when embeddings are configured and available", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		const settings = {
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			embeddingBaseUrl: "http://localhost:1234/v1",
			embeddingModelName: "text-embedding-test",
		};
		const service = new RagService(app as unknown as App, settings, createRagIndexStore());
		const embedding = [0.1, 0.2, 0.3];
		const embeddingSearchResult = {
			...createSearchResult(currentFile, 0.9),
			retrievalMode: "embedding" as const,
		};
		const fetchMock = window.fetch as Mock;

		fetchMock.mockResolvedValue({
			status: 200,
			json: async () => ({
				data: [{ index: 0, embedding }],
			}),
		});

		ragStoreMocks.searchEmbeddingChunks.mockImplementation(async (_embedding: number[], scopeFilePaths: string[]) => {
			return scopeFilePaths.includes(currentFile.path) ? [embeddingSearchResult] : [];
		});

		const context = await service.getContext("current-note", "what is the current note?", false);

		expect(context).toMatchObject({
			scope: "current-note",
			retrievalMode: "embedding",
			usedKeywordFallback: false,
			includeIndexedRag: false,
		});
		expect(context?.notes.map((note) => note.path)).toEqual([currentFile.path]);
		expect(ragStoreMocks.searchEmbeddingChunks).toHaveBeenCalledWith(
			embedding,
			[currentFile.path],
			expect.objectContaining({
				similarityThreshold: 0.12,
			}),
		);
		expect(ragStoreMocks.searchKeywordChunks).not.toHaveBeenCalled();
	});

	it("reports keyword fallback when embeddings are not configured", async () => {
		const currentFile = createMarkdownFile("Stories/The Unfinished Oath.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, createRagIndexStore());

		ragStoreMocks.searchKeywordChunks.mockResolvedValue([createSearchResult(currentFile, 1)]);

		const context = await service.getContext("current-note", "what is the current note?", false);

		expect(context).toMatchObject({
			scope: "current-note",
			retrievalMode: "keyword",
			usedKeywordFallback: true,
			includeIndexedRag: false,
		});
		expect(ragStoreMocks.searchKeywordChunks).toHaveBeenCalledWith(
			"what is the current note?",
			[currentFile.path],
			expect.objectContaining({
				similarityThreshold: 0,
			}),
		);
	});

	it("does not generate a query embedding when only zero-chunk embedding records are candidates", async () => {
		const emptyFile = createMarkdownFile("Templates/Blank.md");
		const app = createApp({});
		const service = new RagService(app as unknown as App, createEmbeddingSettings(), createRagIndexStore());

		ragStoreMocks.listIndexedFiles.mockResolvedValue([createZeroChunkEmbeddingIndexedFile(emptyFile)]);

		const context = await service.getContext("indexed-notes", "blank template", false);

		expect(context).toBeUndefined();
		expect(window.fetch).not.toHaveBeenCalled();
		expect(ragStoreMocks.searchEmbeddingChunks).not.toHaveBeenCalled();
		expect(ragStoreMocks.searchKeywordChunks).not.toHaveBeenCalled();
	});

	it("searches embedding and keyword candidate groups without downgrading semantic files globally", async () => {
		const embeddingFile = createMarkdownFile("Stories/Semantic.md");
		const keywordFile = createMarkdownFile("Stories/Keyword.md");
		const app = createApp({});
		const service = new RagService(app as unknown as App, createEmbeddingSettings(), createRagIndexStore());
		const queryEmbedding = [0.1, 0.2, 0.3];
		const embeddingResult = createEmbeddingSearchResult(embeddingFile, 0.9);
		const keywordResult = createSearchResult(keywordFile, 10);
		const fetchMock = window.fetch as Mock;

		fetchMock.mockResolvedValue({
			status: 200,
			json: async () => ({
				data: [{ index: 0, embedding: queryEmbedding }],
			}),
		});
		ragStoreMocks.listIndexedFiles.mockResolvedValue([createEmbeddingIndexedFile(embeddingFile), createIndexedFile(keywordFile)]);
		ragStoreMocks.searchEmbeddingChunks.mockResolvedValue([embeddingResult]);
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([keywordResult]);

		const context = await service.getContext("indexed-notes", "mixed retrieval", false);

		expect(ragStoreMocks.searchEmbeddingChunks).toHaveBeenCalledWith(queryEmbedding, [embeddingFile.path], expect.any(Object));
		expect(ragStoreMocks.searchKeywordChunks).toHaveBeenCalledWith("mixed retrieval", [keywordFile.path], expect.any(Object));
		expect(context?.notes.map((note) => note.path)).toEqual([embeddingFile.path, keywordFile.path]);
		expect(context).toMatchObject({
			retrievalMode: "keyword",
			usedKeywordFallback: true,
		});
	});

	it("uses keyword fallback for all non-empty candidates when query embedding generation fails", async () => {
		const embeddingFile = createMarkdownFile("Stories/Semantic.md");
		const keywordFile = createMarkdownFile("Stories/Keyword.md");
		const emptyFile = createMarkdownFile("Templates/Blank.md");
		const app = createApp({});
		const service = new RagService(app as unknown as App, createEmbeddingSettings(), createRagIndexStore());
		const fetchMock = window.fetch as Mock;

		fetchMock.mockRejectedValue(new Error("Embedding outage"));
		ragStoreMocks.listIndexedFiles.mockResolvedValue([createEmbeddingIndexedFile(embeddingFile), createIndexedFile(keywordFile), createZeroChunkEmbeddingIndexedFile(emptyFile)]);
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([createSearchResult(embeddingFile, 3), createSearchResult(keywordFile, 2)]);

		const context = await service.getContext("indexed-notes", "outage retrieval", false);

		expect(ragStoreMocks.searchEmbeddingChunks).not.toHaveBeenCalled();
		expect(ragStoreMocks.searchKeywordChunks).toHaveBeenCalledWith("outage retrieval", [embeddingFile.path, keywordFile.path], expect.any(Object));
		expect(context?.notes.map((note) => note.path)).toEqual([embeddingFile.path, keywordFile.path]);
		expect(context).toMatchObject({
			retrievalMode: "keyword",
			usedKeywordFallback: true,
		});
	});

	it("keeps indexed-only dimension mismatches available through keyword search", async () => {
		const mismatchedFile = createMarkdownFile("Stories/Old Vectors.md");
		const app = createApp({});
		const service = new RagService(app as unknown as App, createEmbeddingSettings(), createRagIndexStore());
		const queryEmbedding = [0.1, 0.2, 0.3];
		const fetchMock = window.fetch as Mock;

		fetchMock.mockResolvedValue({
			status: 200,
			json: async () => ({
				data: [{ index: 0, embedding: queryEmbedding }],
			}),
		});
		ragStoreMocks.listIndexedFiles.mockResolvedValue([createEmbeddingIndexedFile(mismatchedFile, 2)]);
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([createSearchResult(mismatchedFile, 1)]);

		const context = await service.getContext("indexed-notes", "old vectors", false);

		expect(ragStoreMocks.searchEmbeddingChunks).not.toHaveBeenCalled();
		expect(ragStoreMocks.searchKeywordChunks).toHaveBeenCalledWith("old vectors", [mismatchedFile.path], expect.any(Object));
		expect(context?.notes.map((note) => note.path)).toEqual([mismatchedFile.path]);
	});

	it("reindexes scoped dimension mismatches before semantic search", async () => {
		const currentFile = createMarkdownFile("Stories/Current.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		const service = new RagService(app as unknown as App, createEmbeddingSettings(), createRagIndexStore());
		const content = "Current note body";
		const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
		const fileHash = Array.from(new Uint8Array(hashBuffer))
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		const fetchMock = window.fetch as Mock;

		ragStoreMocks.getIndexedFile.mockResolvedValue({
			...createEmbeddingIndexedFile(currentFile, 2),
			fileHash,
		});
		fetchMock
			.mockResolvedValueOnce({
				status: 200,
				json: async () => ({
					data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
				}),
			})
			.mockResolvedValueOnce({
				status: 200,
				json: async () => ({
					data: [{ index: 0, embedding: [0.4, 0.5, 0.6] }],
				}),
			});
		ragStoreMocks.searchEmbeddingChunks.mockResolvedValue([createEmbeddingSearchResult(currentFile, 0.8)]);

		const context = await service.getContext("current-note", "current note", false);

		expect(ragStoreMocks.upsertFileIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				filePath: currentFile.path,
				embeddingDimension: 3,
				retrievalMode: "embedding",
			}),
			expect.any(Array),
		);
		expect(ragStoreMocks.searchEmbeddingChunks).toHaveBeenCalledWith([0.1, 0.2, 0.3], [currentFile.path], expect.any(Object));
		expect(context?.notes.map((note) => note.path)).toEqual([currentFile.path]);
	});

	it("does not reindex or retrieve zero-chunk scoped embedding records", async () => {
		const currentFile = createMarkdownFile("Templates/Blank.md");
		const app = createApp({
			activeEditorFile: currentFile,
		});
		app.vault.cachedRead.mockResolvedValue("");
		const service = new RagService(app as unknown as App, createEmbeddingSettings(), createRagIndexStore());

		ragStoreMocks.getIndexedFile.mockResolvedValue({
			...createZeroChunkEmbeddingIndexedFile(currentFile),
			fileHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		});

		const context = await service.getContext("current-note", "blank", false);

		expect(context).toBeUndefined();
		expect(window.fetch).not.toHaveBeenCalled();
		expect(ragStoreMocks.upsertFileIndex).not.toHaveBeenCalled();
		expect(ragStoreMocks.searchEmbeddingChunks).not.toHaveBeenCalled();
		expect(ragStoreMocks.searchKeywordChunks).not.toHaveBeenCalled();
	});

	it("applies global chunk and character limits after combining indexed-note embedding and keyword results", async () => {
		const embeddingFile = createMarkdownFile("Stories/Semantic.md");
		const keywordFile = createMarkdownFile("Stories/Keyword.md");
		const app = createApp({});
		const service = new RagService(app as unknown as App, createEmbeddingSettings(), createRagIndexStore());
		const queryEmbedding = [0.1, 0.2, 0.3];
		const fetchMock = window.fetch as Mock;
		const embeddingResults = Array.from({ length: 8 }, (_value, index) => createLargeSearchResult(embeddingFile, index, 4000, "embedding"));
		const keywordResults = Array.from({ length: 8 }, (_value, index) => createLargeSearchResult(keywordFile, index, 4000, "keyword"));

		fetchMock.mockResolvedValue({
			status: 200,
			json: async () => ({
				data: [{ index: 0, embedding: queryEmbedding }],
			}),
		});
		ragStoreMocks.listIndexedFiles.mockResolvedValue([createEmbeddingIndexedFile(embeddingFile), createIndexedFile(keywordFile)]);
		ragStoreMocks.searchEmbeddingChunks.mockResolvedValue(embeddingResults);
		ragStoreMocks.searchKeywordChunks.mockResolvedValue(keywordResults);

		const context = await service.getContext("indexed-notes", "limit combined results", false);
		const retrievedChunks = context?.notes.flatMap((note) => note.chunks ?? []) ?? [];
		const retrievedCharacters = retrievedChunks.reduce((total, chunk) => total + chunk.text.length, 0);

		expect(retrievedChunks).toHaveLength(7);
		expect(retrievedChunks.length).toBeLessThanOrEqual(8);
		expect(retrievedCharacters).toBeLessThanOrEqual(30000);
		expect(retrievedChunks.map((chunk) => chunk.retrievalMode)).toEqual(Array.from({ length: 7 }, () => "embedding"));
	});
});
