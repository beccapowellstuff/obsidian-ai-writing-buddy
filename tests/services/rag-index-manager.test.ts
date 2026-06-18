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

	class Notice {
		constructor(readonly message: string) {}
	}

	return {
		Notice,
		TFile,
	};
});

const ragStoreMocks = vi.hoisted(() => ({
	clearIndex: vi.fn(),
	countIndexedFiles: vi.fn(),
	deleteFileIndex: vi.fn(),
	getIndexedFile: vi.fn(),
	hasVaultIndexBeenBuilt: vi.fn(),
	listIndexedFilePaths: vi.fn(),
	markVaultIndexBuilt: vi.fn(),
	upsertFileIndex: vi.fn(),
}));

vi.mock("../../src/services/rag-index-store", () => ({
	RagIndexStore: class {
		async clearIndex(): Promise<void> {
			return ragStoreMocks.clearIndex() as Promise<void>;
		}

		async countIndexedFiles(): Promise<number> {
			return ragStoreMocks.countIndexedFiles() as Promise<number>;
		}

		async deleteFileIndex(filePath: string): Promise<void> {
			return ragStoreMocks.deleteFileIndex(filePath) as Promise<void>;
		}

		async getIndexedFile(filePath: string): Promise<unknown> {
			return ragStoreMocks.getIndexedFile(filePath) as Promise<unknown>;
		}

		async hasVaultIndexBeenBuilt(): Promise<boolean> {
			return ragStoreMocks.hasVaultIndexBeenBuilt() as Promise<boolean>;
		}

		async listIndexedFilePaths(): Promise<string[]> {
			return ragStoreMocks.listIndexedFilePaths() as Promise<string[]>;
		}

		async markVaultIndexBuilt(indexedAt: number): Promise<void> {
			return ragStoreMocks.markVaultIndexBuilt(indexedAt) as Promise<void>;
		}

		async upsertFileIndex(file: unknown, chunks: unknown[]): Promise<void> {
			return ragStoreMocks.upsertFileIndex(file, chunks) as Promise<void>;
		}
	},
}));

import { TFile, type App } from "obsidian";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { RagIndexManager } from "../../src/services/rag-index-manager";

type MockApp = {
	vault: {
		cachedRead: Mock<(file: TFile) => Promise<string>>;
		getMarkdownFiles: Mock<() => TFile[]>;
	};
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

function createApp(files: TFile[]): MockApp {
	return {
		vault: {
			cachedRead: vi.fn(async (file) => `${file.basename} body`),
			getMarkdownFiles: vi.fn(() => files),
		},
	};
}

describe("RagIndexManager", () => {
	beforeEach(() => {
		ragStoreMocks.clearIndex.mockResolvedValue(undefined);
		ragStoreMocks.countIndexedFiles.mockResolvedValue(0);
		ragStoreMocks.deleteFileIndex.mockResolvedValue(undefined);
		ragStoreMocks.getIndexedFile.mockResolvedValue(null);
		ragStoreMocks.hasVaultIndexBeenBuilt.mockResolvedValue(false);
		ragStoreMocks.listIndexedFilePaths.mockResolvedValue([]);
		ragStoreMocks.markVaultIndexBuilt.mockResolvedValue(undefined);
		ragStoreMocks.upsertFileIndex.mockResolvedValue(undefined);

		vi.stubGlobal("window", {
			fetch: vi.fn(),
			clearTimeout: vi.fn(),
			setTimeout: (callback: () => void, delay?: number) => {
				if (delay !== 60000) {
					callback();
				}

				return 1;
			},
		});
	});

	it("builds a vault index from markdown files", async () => {
		const files = [createFile("Stories/One.md"), createFile("Stories/Two.md")];
		const app = createApp(files);
		const manager = new RagIndexManager(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, ".");

		ragStoreMocks.countIndexedFiles.mockResolvedValue(files.length);

		const status = await manager.buildIndex();

		expect(app.vault.cachedRead).toHaveBeenCalledTimes(2);
		expect(ragStoreMocks.upsertFileIndex).toHaveBeenCalledTimes(2);
		expect(status).toMatchObject({
			state: "completed",
			indexedFileCount: 2,
			totalMarkdownFileCount: 2,
			processedFileCount: 2,
			retrievalMode: "keyword",
		});
		expect(ragStoreMocks.markVaultIndexBuilt).toHaveBeenCalledWith(expect.any(Number));
	});

	it("reuses unchanged indexed files without rewriting them", async () => {
		const file = createFile("Stories/One.md");
		const app = createApp([file]);
		const manager = new RagIndexManager(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, ".");
		const content = "One body";
		const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
		const fileHash = Array.from(new Uint8Array(hashBuffer))
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");

		app.vault.cachedRead.mockResolvedValue(content);
		ragStoreMocks.getIndexedFile.mockResolvedValue({
			filePath: file.path,
			fileTitle: file.basename,
			fileHash,
			retrievalMode: "keyword",
			chunkCount: 1,
			indexedAt: 1,
		});

		await manager.buildIndex();

		expect(ragStoreMocks.upsertFileIndex).not.toHaveBeenCalled();
	});

	it("updates modified markdown files only after a vault index has been built", async () => {
		const file = createFile("Stories/One.md");
		const app = createApp([file]);
		const manager = new RagIndexManager(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, ".");

		manager.handleVaultFileCreatedOrModified(file);
		expect(ragStoreMocks.upsertFileIndex).not.toHaveBeenCalled();

		await manager.buildIndex();
		ragStoreMocks.upsertFileIndex.mockClear();

		manager.handleVaultFileCreatedOrModified(file);
		await new Promise((resolve) => globalThis.setTimeout(resolve, 10));

		expect(ragStoreMocks.upsertFileIndex).toHaveBeenCalledTimes(1);
	});

	it("updates modified markdown files after restart when a vault index exists", async () => {
		const file = createFile("Stories/One.md");
		const app = createApp([file]);
		const manager = new RagIndexManager(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, ".");

		ragStoreMocks.hasVaultIndexBeenBuilt.mockResolvedValue(true);
		await manager.getStatus();

		manager.handleVaultFileCreatedOrModified(file);
		await new Promise((resolve) => globalThis.setTimeout(resolve, 10));

		expect(ragStoreMocks.upsertFileIndex).toHaveBeenCalledTimes(1);
	});

	it("removes stale records when a markdown file is deleted", async () => {
		const file = createFile("Stories/One.md");
		const app = createApp([file]);
		const manager = new RagIndexManager(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, ".");

		await manager.buildIndex();
		manager.handleVaultFileDeleted(file);

		expect(ragStoreMocks.deleteFileIndex).toHaveBeenCalledWith(file.path);
	});

	it("falls back to keyword chunks when embedding requests fail", async () => {
		const file = createFile("Stories/One.md");
		const app = createApp([file]);
		const manager = new RagIndexManager(app as unknown as App, {
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			embeddingBaseUrl: "http://localhost:1234/v1",
			embeddingModelName: "text-embedding-test",
		}, ".");
		const fetchMock = window.fetch as Mock;

		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

		const status = await manager.buildIndex();

		expect(ragStoreMocks.upsertFileIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				filePath: file.path,
				retrievalMode: "keyword",
			}),
			expect.any(Array),
		);
		expect(status).toMatchObject({
			state: "completed",
			retrievalMode: "keyword",
			lastError: "Failed to fetch",
		});
	});
});
