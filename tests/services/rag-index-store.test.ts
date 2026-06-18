import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRagKeywordSearchQuery, scoreKeywordChunk, tokenizeRagSearchText } from "../../src/services/rag-keyword-search";
import { RagIndexStore } from "../../src/services/rag-index-store";
import type { AiWritingBuddyRagChunk } from "../../src/types/rag-index";

const sqlMocks = vi.hoisted(() => ({
	runLog: [] as string[],
	activeTransaction: false,
}));

const fsMocks = vi.hoisted(() => ({
	mkdir: vi.fn(),
	readFile: vi.fn(),
	writeFile: vi.fn(),
}));

vi.mock("sql.js/dist/sql-wasm.wasm", () => ({
	default: new Uint8Array(),
}));

vi.mock("fs/promises", () => ({
	mkdir: fsMocks.mkdir,
	readFile: fsMocks.readFile,
	writeFile: fsMocks.writeFile,
}));

vi.mock("@webreflection/sql.js", () => {
	class FakeStatement {
		bind(): void {}
		step(): boolean {
			return false;
		}
		getAsObject(): Record<string, unknown> {
			return {};
		}
		free(): void {}
	}

	class FakeDatabase {
		constructor(_data?: Uint8Array) {}

		run(sql: string): void {
			sqlMocks.runLog.push(sql);

			const statement = sql.trim();

			if (statement === "BEGIN TRANSACTION") {
				if (sqlMocks.activeTransaction) {
					throw new Error("Overlapping SQL transaction");
				}

				sqlMocks.activeTransaction = true;
				return;
			}

			if (statement === "COMMIT" || statement === "ROLLBACK") {
				sqlMocks.activeTransaction = false;
			}
		}

		prepare(): FakeStatement {
			return new FakeStatement();
		}

		export(): Uint8Array {
			return new Uint8Array([1]);
		}
	}

	return {
		default: async () => ({
			Database: FakeDatabase,
		}),
	};
});

type Deferred = {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: unknown) => void;
};

function createDeferred(): Deferred {
	let resolve: () => void = () => {};
	let reject: (error: unknown) => void = () => {};
	const promise = new Promise<void>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});

	return {
		promise,
		resolve,
		reject,
	};
}

function createChunk(path: string, text: string): AiWritingBuddyRagChunk {
	return {
		id: `${path}::0`,
		filePath: path,
		fileTitle:
			path
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") ?? path,
		fileHash: "hash",
		chunkIndex: 0,
		text,
		retrievalMode: "keyword",
		updatedAt: 1,
	};
}

function createIndexedFile(path: string) {
	return {
		filePath: path,
		fileTitle:
			path
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") ?? path,
		fileHash: "hash",
		retrievalMode: "keyword" as const,
		chunkCount: 1,
		indexedAt: 1,
	};
}

async function waitForWriteCallCount(count: number): Promise<void> {
	await vi.waitFor(() => {
		expect(fsMocks.writeFile).toHaveBeenCalledTimes(count);
	});
}

describe("RagIndexStore mutation queue", () => {
	beforeEach(() => {
		sqlMocks.runLog.length = 0;
		sqlMocks.activeTransaction = false;
		fsMocks.mkdir.mockResolvedValue(undefined);
		fsMocks.readFile.mockRejectedValue(new Error("No database"));
		fsMocks.writeFile.mockResolvedValue(undefined);
	});

	it("runs concurrent mutations sequentially through transaction and export", async () => {
		const firstWrite = createDeferred();
		const secondWrite = createDeferred();

		fsMocks.writeFile.mockImplementationOnce(() => firstWrite.promise).mockImplementationOnce(() => secondWrite.promise);

		const store = new RagIndexStore("rag-index/embeddings.db");
		const firstMutation = store.upsertFileIndex(createIndexedFile("Stories/One.md"), [createChunk("Stories/One.md", "One")]);
		const secondMutation = store.deleteFileIndex("Stories/Two.md");

		await waitForWriteCallCount(1);
		expect(sqlMocks.runLog.filter((sql) => sql.trim() === "BEGIN TRANSACTION")).toHaveLength(1);

		firstWrite.resolve();
		await waitForWriteCallCount(2);
		expect(sqlMocks.runLog.filter((sql) => sql.trim() === "BEGIN TRANSACTION")).toHaveLength(2);

		secondWrite.resolve();
		await expect(firstMutation).resolves.toBeUndefined();
		await expect(secondMutation).resolves.toBeUndefined();
	});

	it("continues queued mutations after a rejected mutation", async () => {
		const failedWrite = createDeferred();

		fsMocks.writeFile.mockImplementationOnce(() => failedWrite.promise).mockResolvedValueOnce(undefined);

		const store = new RagIndexStore("rag-index/embeddings.db");
		const failedMutation = store.markVaultIndexBuilt(1);
		const laterMutation = store.clearIndex();

		await waitForWriteCallCount(1);
		failedWrite.reject(new Error("Export failed"));

		await expect(failedMutation).rejects.toThrow("Export failed");
		await waitForWriteCallCount(2);
		await expect(laterMutation).resolves.toBeUndefined();
	});
});

describe("RagIndexStore keyword scoring", () => {
	it("prefers content matches over generic story path matches", () => {
		const queryTerms = tokenizeRagSearchText("what story does Scott take a shower");
		const matchingChunk = createChunk("Stories/Quiet Morning.md", "Scott takes a shower before returning to the kitchen.");
		const genericStoryChunk = createChunk("Stories/Archive/Blue House.md", "A scene about rain on the windows.");

		expect(queryTerms).toEqual(["scott", "take", "shower"]);
		expect(scoreKeywordChunk(matchingChunk, queryTerms)).toBeGreaterThan(scoreKeywordChunk(genericStoryChunk, queryTerms));
	});

	it("strongly prefers an exact phrase chunk over a generic chunk from another story ideas note", () => {
		const query = createRagKeywordSearchQuery("hey I remember I did notes once for a Digital Pixelation story idea. Where is that located?");
		const matchingChunk = createChunk(
			"- Story Ideas/- Visual Transformation Methods.md",
			[
				"## Visual Transformation Methods",
				"Digital Pixelation: The character's body could start pixelating, with pixels detaching and floating away or rearranging themselves to form the new identity.",
				"This approach is particularly fitting for stories with themes of technology, digital worlds, or virtual reality.",
			].join("\n"),
		);
		const genericChunk = createChunk(
			"- Stories that have ideas/! Notes Part 2.md",
			[
				"## Visual Transformation Methods",
				"Statue/Cocoon Breakaway: As you mentioned, the individual could initially be encased in a statue-like form or a cocoon.",
				"This method symbolizes rebirth and metamorphosis.",
			].join("\n"),
		);

		expect(query.terms).toEqual(["digital", "pixelation"]);
		expect(query.phrases).toContain("digital pixelation");
		expect(scoreKeywordChunk(matchingChunk, query)).toBeGreaterThan(scoreKeywordChunk(genericChunk, query));
	});
});
