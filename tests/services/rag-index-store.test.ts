import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRagKeywordSearchQuery, scoreKeywordChunk } from "../../src/services/rag-keyword-search";
import { RagIndexStore } from "../../src/services/rag-index-store";
import type { AiWritingBuddyRagChunk } from "../../src/types/rag-index";

const sqlMocks = vi.hoisted(() => ({
	runLog: [] as string[],
	activeTransaction: false,
	queryRows: [] as Array<Record<string, unknown>>,
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
		private rowIndex = -1;

		constructor(private readonly rows: Array<Record<string, unknown>> = []) {}

		bind(): void {}
		step(): boolean {
			this.rowIndex += 1;
			return this.rowIndex < this.rows.length;
		}
		getAsObject(): Record<string, unknown> {
			return this.rows[this.rowIndex] ?? {};
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

		prepare(sql: string): FakeStatement {
			if (sql.includes("SELECT rag_chunks.*")) {
				return new FakeStatement(sqlMocks.queryRows);
			}

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

function createChunkRow(path: string, chunkIndex: number, text: string): Record<string, unknown> {
	return {
		id: `${path}::${chunkIndex}`,
		file_path: path,
		chunk_index: chunkIndex,
		text,
		retrieval_mode: "keyword",
		updated_at: 1,
		file_title:
			path
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") ?? path,
		file_hash: "hash",
		total_chunk_count: 1,
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
		sqlMocks.queryRows = [];
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
		const queryTerms = createRagKeywordSearchQuery("what story does Scott take a shower").terms;
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

	it("returns only positive-score keyword chunks", async () => {
		const store = new RagIndexStore("rag-index/embeddings.db");
		const matchingPath = "- Story Ideas/- Visual Transformation Methods.md";
		const unrelatedPath = "Stories/Rain Window.md";

		sqlMocks.queryRows = [
			createChunkRow(matchingPath, 0, "Digital Pixelation makes the character dissolve into blocks of light."),
			createChunkRow(unrelatedPath, 0, "Rain taps against the kitchen window."),
		];

		const results = await store.searchKeywordChunks("Digital Pixelation", [matchingPath, unrelatedPath], {
			maxChunks: 8,
			maxContextCharacters: 30000,
			similarityThreshold: 0,
		});

		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			id: `${matchingPath}::0`,
			selectedBy: "keyword",
		});
		expect(results[0]?.score).toBeGreaterThan(0);
	});

	it("returns no keyword chunks when every candidate scores zero", async () => {
		const store = new RagIndexStore("rag-index/embeddings.db");
		const firstPath = "Stories/Rain Window.md";
		const secondPath = "Archive/Quiet Kitchen.md";

		sqlMocks.queryRows = [createChunkRow(firstPath, 0, "Rain taps against the kitchen window."), createChunkRow(secondPath, 0, "A kettle hums on the counter.")];

		const results = await store.searchKeywordChunks("zqxwv impossible term", [firstPath, secondPath], {
			maxChunks: 8,
			maxContextCharacters: 30000,
			similarityThreshold: 0,
		});

		expect(results).toEqual([]);
	});

	it("applies the result limiter after filtering zero-score keyword chunks", async () => {
		const store = new RagIndexStore("rag-index/embeddings.db");
		const paths = ["Ideas/One.md", "Ideas/Two.md", "Ideas/Three.md"];

		sqlMocks.queryRows = paths.map((path, index) => createChunkRow(path, 0, `Digital Pixelation option ${index + 1}.`));

		const results = await store.searchKeywordChunks("Digital Pixelation", paths, {
			maxChunks: 2,
			maxContextCharacters: 30000,
			similarityThreshold: 0,
		});

		expect(results).toHaveLength(2);
		expect(results.every((result) => result.score > 0)).toBe(true);
	});
});
