import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("obsidian", () => {
	class TFile {
		path: string;
		basename: string;
		extension: string;

		constructor(path = "") {
			this.path = path;
			this.basename =
				path
					.split("/")
					.pop()
					?.replace(/\.[^.]+$/, "") ?? path;
			this.extension = path.split(".").pop() ?? "";
		}
	}

	return {
		TFile,
	};
});

import { TFile, type App } from "obsidian";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { RagFileIndexer } from "../../src/services/rag-file-indexer";
import type { RagIndexStore } from "../../src/services/rag-index-store";
import type { AiWritingBuddyRagIndexedFile } from "../../src/types/rag-index";

type MockApp = {
	vault: {
		cachedRead: Mock<(file: TFile) => Promise<string>>;
	};
};

type MockStore = {
	getIndexedFile: Mock<(filePath: string) => Promise<AiWritingBuddyRagIndexedFile | null>>;
	upsertFileIndex: Mock<(file: AiWritingBuddyRagIndexedFile, chunks: unknown[]) => Promise<void>>;
};

function createFile(path: string): TFile {
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

function createApp(content: string): MockApp {
	return {
		vault: {
			cachedRead: vi.fn(async () => content),
		},
	};
}

function createStore(indexedFile: AiWritingBuddyRagIndexedFile | null = null): MockStore {
	return {
		getIndexedFile: vi.fn(async () => indexedFile),
		upsertFileIndex: vi.fn(async () => undefined),
	};
}

function createIndexer(app: MockApp, store: MockStore, settings = DEFAULT_AI_WRITING_BUDDY_SETTINGS): RagFileIndexer {
	return new RagFileIndexer(app as unknown as App, settings, store as unknown as RagIndexStore);
}

describe("RagFileIndexer", () => {
	beforeEach(() => {
		vi.stubGlobal("window", {
			fetch: vi.fn(),
			clearTimeout: vi.fn(),
			setTimeout: (callback: () => void) => {
				callback();
				return 0;
			},
		});
	});

	it("stores empty files as zero-chunk embedding records without embedding requests when embeddings are configured", async () => {
		const file = createFile("Templates/Blank.md");
		const app = createApp("\n\n");
		const store = createStore();
		const settings = {
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			embeddingBaseUrl: "http://localhost:1234/v1",
			embeddingModelName: "text-embedding-test",
		};
		const indexer = createIndexer(app, store, settings);

		const result = await indexer.ensureFileIndexed(file);

		expect(window.fetch).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			usedKeywordFallback: false,
			file: {
				filePath: file.path,
				embeddingModel: "text-embedding-test",
				retrievalMode: "embedding",
				chunkCount: 0,
			},
		});
		expect(result.file.embeddingDimension).toBeUndefined();
		expect(store.upsertFileIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				filePath: file.path,
				embeddingModel: "text-embedding-test",
				retrievalMode: "embedding",
				chunkCount: 0,
			}),
			[],
		);
	});

	it("reuses unchanged zero-chunk embedding records", async () => {
		const file = createFile("Templates/Blank.md");
		const app = createApp("");
		const settings = {
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			embeddingBaseUrl: "http://localhost:1234/v1",
			embeddingModelName: "text-embedding-test",
		};
		const fileHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
		const indexedFile: AiWritingBuddyRagIndexedFile = {
			filePath: file.path,
			fileTitle: file.basename,
			fileHash,
			embeddingModel: "text-embedding-test",
			retrievalMode: "embedding",
			chunkCount: 0,
			indexedAt: 1,
		};
		const store = createStore(indexedFile);
		const indexer = createIndexer(app, store, settings);

		const result = await indexer.ensureFileIndexed(file);

		expect(window.fetch).not.toHaveBeenCalled();
		expect(store.upsertFileIndex).not.toHaveBeenCalled();
		expect(result).toEqual({
			file: indexedFile,
			usedKeywordFallback: false,
		});
	});

	it("stores empty files as zero-chunk keyword records when embeddings are not configured", async () => {
		const file = createFile("Templates/Blank.md");
		const app = createApp("");
		const store = createStore();
		const indexer = createIndexer(app, store);

		const result = await indexer.ensureFileIndexed(file);

		expect(result).toMatchObject({
			usedKeywordFallback: true,
			file: {
				filePath: file.path,
				retrievalMode: "keyword",
				chunkCount: 0,
			},
		});
		expect(store.upsertFileIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				filePath: file.path,
				retrievalMode: "keyword",
				chunkCount: 0,
			}),
			[],
		);
	});
});
