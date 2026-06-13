import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("obsidian", () => {
	class TFile {
		path: string;
		basename: string;
		extension: string;

		constructor(path = "") {
			this.path = path;
			this.basename = path ? (path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? path) : "";
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
		basename: path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? path,
		extension: path.split(".").pop() ?? "",
	});

	return file;
}

function createApp(options: {
	activeEditorFile?: TFile | null;
	activeViewFile?: TFile | null;
	activeFile?: TFile | null;
	openFiles?: TFile[];
}): MockApp {
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

describe("RagService", () => {
	beforeEach(() => {
		ragStoreMocks.getIndexedFile.mockResolvedValue(null);
		ragStoreMocks.listIndexedFiles.mockResolvedValue([]);
		ragStoreMocks.searchKeywordChunks.mockResolvedValue([]);
		ragStoreMocks.upsertFileIndex.mockResolvedValue(undefined);

		vi.stubGlobal("window", {
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
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, ".");

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
		const service = new RagService(app as unknown as App, DEFAULT_AI_WRITING_BUDDY_SETTINGS, ".");
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
});
