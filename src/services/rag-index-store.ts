import initSqlJs, { type SqlJsDatabase } from "@webreflection/sql.js";
import sqlWasm from "sql.js/dist/sql-wasm.wasm";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import type { AiWritingBuddyContextRetrievalMode } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyRagChunk, AiWritingBuddyRagIndexedFile, AiWritingBuddyRagSearchOptions, AiWritingBuddyRagSearchResult } from "../types/rag-index";

type IndexedFileRow = {
	file_path?: unknown;
	file_title?: unknown;
	file_hash?: unknown;
	embedding_model?: unknown;
	embedding_dimension?: unknown;
	retrieval_mode?: unknown;
	chunk_count?: unknown;
	indexed_at?: unknown;
};

type ChunkRow = {
	id?: unknown;
	file_path?: unknown;
	chunk_index?: unknown;
	heading_path_json?: unknown;
	start_line?: unknown;
	end_line?: unknown;
	text?: unknown;
	embedding_json?: unknown;
	embedding_dimension?: unknown;
	retrieval_mode?: unknown;
	updated_at?: unknown;
	file_title?: unknown;
	file_hash?: unknown;
	total_chunk_count?: unknown;
};

export class RagIndexStore {
	private dbPromise: Promise<SqlJsDatabase> | null = null;

	constructor(private readonly dbPath: string) {}

	async getIndexedFile(filePath: string): Promise<AiWritingBuddyRagIndexedFile | null> {
		const db = await this.getDatabase();
		const rows = this.selectRows<IndexedFileRow>(db, "SELECT * FROM indexed_files WHERE file_path = ?", [filePath]);
		const row = rows[0];

		return row ? this.mapIndexedFile(row) : null;
	}

	async listIndexedFiles(): Promise<AiWritingBuddyRagIndexedFile[]> {
		const db = await this.getDatabase();
		const rows = this.selectRows<IndexedFileRow>(db, "SELECT * FROM indexed_files ORDER BY file_title ASC, file_path ASC");

		return rows.map((row) => this.mapIndexedFile(row));
	}

	async upsertFileIndex(file: AiWritingBuddyRagIndexedFile, chunks: AiWritingBuddyRagChunk[]): Promise<void> {
		const db = await this.getDatabase();

		db.run("BEGIN TRANSACTION");

		try {
			db.run("DELETE FROM rag_chunks WHERE file_path = ?", [file.filePath]);
			db.run("DELETE FROM indexed_files WHERE file_path = ?", [file.filePath]);
			db.run(
				[
					"INSERT INTO indexed_files",
					"(file_path, file_title, file_hash, embedding_model, embedding_dimension, retrieval_mode, chunk_count, indexed_at)",
					"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				].join(" "),
				[file.filePath, file.fileTitle, file.fileHash, file.embeddingModel ?? null, file.embeddingDimension ?? null, file.retrievalMode, file.chunkCount, file.indexedAt],
			);

			const statement = db.prepare(
				[
					"INSERT INTO rag_chunks",
					"(id, file_path, chunk_index, heading_path_json, start_line, end_line, text, embedding_json, embedding_dimension, retrieval_mode, updated_at)",
					"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				].join(" "),
			);

			try {
				for (const chunk of chunks) {
					statement.bind([
						chunk.id,
						chunk.filePath,
						chunk.chunkIndex,
						chunk.headingPath ? JSON.stringify(chunk.headingPath) : null,
						chunk.startLine ?? null,
						chunk.endLine ?? null,
						chunk.text,
						chunk.embedding ? JSON.stringify(chunk.embedding) : null,
						chunk.embeddingDimension ?? null,
						chunk.retrievalMode,
						chunk.updatedAt,
					]);
					statement.step();
				}
			} finally {
				statement.free();
			}

			db.run("COMMIT");
		} catch (error) {
			db.run("ROLLBACK");
			throw error;
		}

		await this.saveDatabase(db);
	}

	async searchEmbeddingChunks(queryEmbedding: number[], scopeFilePaths: string[], options: AiWritingBuddyRagSearchOptions): Promise<AiWritingBuddyRagSearchResult[]> {
		const candidateChunks = await this.getCandidateChunks(scopeFilePaths, "embedding");
		const scoredChunks = candidateChunks
			.map((chunk) => ({
				...chunk,
				score: chunk.embedding ? this.cosineSimilarity(queryEmbedding, chunk.embedding) : -1,
			}))
			.filter((chunk) => chunk.score >= options.similarityThreshold)
			.sort((left, right) => right.score - left.score);

		return this.limitSearchResults(scoredChunks, options);
	}

	async searchKeywordChunks(query: string, scopeFilePaths: string[], options: AiWritingBuddyRagSearchOptions): Promise<AiWritingBuddyRagSearchResult[]> {
		const candidateChunks = await this.getCandidateChunks(scopeFilePaths);
		const queryTerms = this.tokenize(query);
		const scoredChunks = candidateChunks
			.map((chunk) => ({
				...chunk,
				score: this.scoreKeywordChunk(chunk, queryTerms),
			}))
			.sort((left, right) => {
				if (right.score !== left.score) {
					return right.score - left.score;
				}

				if (left.filePath !== right.filePath) {
					return left.filePath.localeCompare(right.filePath);
				}

				return left.chunkIndex - right.chunkIndex;
			});

		return this.limitSearchResults(scoredChunks, options);
	}

	private async getCandidateChunks(scopeFilePaths: string[], retrievalMode?: AiWritingBuddyContextRetrievalMode): Promise<AiWritingBuddyRagSearchResult[]> {
		if (scopeFilePaths.length === 0) {
			return [];
		}

		const db = await this.getDatabase();
		const placeholders = scopeFilePaths.map(() => "?").join(", ");
		const modeClause = retrievalMode ? "AND rag_chunks.retrieval_mode = ?" : "";
		const params: unknown[] = retrievalMode ? [...scopeFilePaths, retrievalMode] : [...scopeFilePaths];
		const rows = this.selectRows<ChunkRow>(
			db,
			[
				"SELECT rag_chunks.*, indexed_files.file_title, indexed_files.file_hash, indexed_files.chunk_count AS total_chunk_count",
				"FROM rag_chunks",
				"JOIN indexed_files ON indexed_files.file_path = rag_chunks.file_path",
				`WHERE rag_chunks.file_path IN (${placeholders})`,
				modeClause,
			].join(" "),
			params,
		);

		return rows.map((row) => ({
			...this.mapChunk(row),
			score: 0,
			totalChunkCount: this.asNumber(row.total_chunk_count) ?? 0,
		}));
	}

	private async getDatabase(): Promise<SqlJsDatabase> {
		if (!this.dbPromise) {
			this.dbPromise = this.loadDatabase();
		}

		return this.dbPromise;
	}

	private async loadDatabase(): Promise<SqlJsDatabase> {
		const SQL = await initSqlJs({ wasmBinary: sqlWasm });
		let data: Uint8Array | undefined;

		try {
			data = await readFile(this.dbPath);
		} catch {
			data = undefined;
		}

		const db = data ? new SQL.Database(data) : new SQL.Database();
		this.ensureSchema(db);

		return db;
	}

	private ensureSchema(db: SqlJsDatabase): void {
		db.run(`
			CREATE TABLE IF NOT EXISTS indexed_files (
				file_path TEXT PRIMARY KEY,
				file_title TEXT NOT NULL,
				file_hash TEXT NOT NULL,
				embedding_model TEXT,
				embedding_dimension INTEGER,
				retrieval_mode TEXT NOT NULL,
				chunk_count INTEGER NOT NULL,
				indexed_at INTEGER NOT NULL
			);
		`);
		db.run(`
			CREATE TABLE IF NOT EXISTS rag_chunks (
				id TEXT PRIMARY KEY,
				file_path TEXT NOT NULL,
				chunk_index INTEGER NOT NULL,
				heading_path_json TEXT,
				start_line INTEGER,
				end_line INTEGER,
				text TEXT NOT NULL,
				embedding_json TEXT,
				embedding_dimension INTEGER,
				retrieval_mode TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`);
		db.run("CREATE INDEX IF NOT EXISTS idx_rag_chunks_file_path ON rag_chunks(file_path);");
		db.run("CREATE INDEX IF NOT EXISTS idx_rag_chunks_file_path_chunk_index ON rag_chunks(file_path, chunk_index);");
		db.run("CREATE INDEX IF NOT EXISTS idx_rag_chunks_retrieval_mode ON rag_chunks(retrieval_mode);");
	}

	private async saveDatabase(db: SqlJsDatabase): Promise<void> {
		await mkdir(dirname(this.dbPath), { recursive: true });
		await writeFile(this.dbPath, db.export());
	}

	private selectRows<T extends Record<string, unknown>>(db: SqlJsDatabase, sql: string, params: unknown[] = []): T[] {
		const statement = db.prepare(sql);
		const rows: T[] = [];

		try {
			statement.bind(params);

			while (statement.step()) {
				rows.push(statement.getAsObject() as T);
			}
		} finally {
			statement.free();
		}

		return rows;
	}

	private mapIndexedFile(row: IndexedFileRow): AiWritingBuddyRagIndexedFile {
		return {
			filePath: this.asString(row.file_path),
			fileTitle: this.asString(row.file_title),
			fileHash: this.asString(row.file_hash),
			embeddingModel: this.asOptionalString(row.embedding_model),
			embeddingDimension: this.asNumber(row.embedding_dimension),
			retrievalMode: this.asRetrievalMode(row.retrieval_mode),
			chunkCount: this.asNumber(row.chunk_count) ?? 0,
			indexedAt: this.asNumber(row.indexed_at) ?? 0,
		};
	}

	private mapChunk(row: ChunkRow): AiWritingBuddyRagChunk {
		const embeddingJson = this.asOptionalString(row.embedding_json);

		return {
			id: this.asString(row.id),
			filePath: this.asString(row.file_path),
			fileTitle: this.asString(row.file_title),
			fileHash: this.asString(row.file_hash),
			chunkIndex: this.asNumber(row.chunk_index) ?? 0,
			headingPath: this.parseHeadingPath(row.heading_path_json),
			startLine: this.asNumber(row.start_line),
			endLine: this.asNumber(row.end_line),
			text: this.asString(row.text),
			embedding: embeddingJson ? this.parseEmbedding(embeddingJson) : undefined,
			embeddingDimension: this.asNumber(row.embedding_dimension),
			retrievalMode: this.asRetrievalMode(row.retrieval_mode),
			updatedAt: this.asNumber(row.updated_at) ?? 0,
		};
	}

	private parseHeadingPath(value: unknown): string[] | undefined {
		const text = this.asOptionalString(value);

		if (!text) {
			return undefined;
		}

		try {
			const parsedValue: unknown = JSON.parse(text) as unknown;
			return Array.isArray(parsedValue) ? parsedValue.filter((item): item is string => typeof item === "string") : undefined;
		} catch {
			return undefined;
		}
	}

	private parseEmbedding(value: string): number[] | undefined {
		try {
			const parsedValue: unknown = JSON.parse(value) as unknown;
			return Array.isArray(parsedValue) ? parsedValue.filter((item): item is number => typeof item === "number") : undefined;
		} catch {
			return undefined;
		}
	}

	private asOptionalString(value: unknown): string | undefined {
		return typeof value === "string" && value.length > 0 ? value : undefined;
	}

	private asString(value: unknown): string {
		return typeof value === "string" ? value : "";
	}

	private asNumber(value: unknown): number | undefined {
		return typeof value === "number" && Number.isFinite(value) ? value : undefined;
	}

	private asRetrievalMode(value: unknown): AiWritingBuddyContextRetrievalMode {
		return value === "embedding" ? "embedding" : "keyword";
	}

	private cosineSimilarity(left: number[], right: number[]): number {
		let dotProduct = 0;
		let leftMagnitude = 0;
		let rightMagnitude = 0;
		const length = Math.min(left.length, right.length);

		for (let index = 0; index < length; index++) {
			const leftValue = left[index] ?? 0;
			const rightValue = right[index] ?? 0;

			dotProduct += leftValue * rightValue;
			leftMagnitude += leftValue * leftValue;
			rightMagnitude += rightValue * rightValue;
		}

		const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);

		return denominator > 0 ? dotProduct / denominator : 0;
	}

	private limitSearchResults(chunks: AiWritingBuddyRagSearchResult[], options: AiWritingBuddyRagSearchOptions): AiWritingBuddyRagSearchResult[] {
		const selectedChunks: AiWritingBuddyRagSearchResult[] = [];
		let usedCharacters = 0;

		for (const chunk of chunks) {
			if (selectedChunks.length >= options.maxChunks) {
				break;
			}

			if (usedCharacters + chunk.text.length > options.maxContextCharacters && selectedChunks.length > 0) {
				continue;
			}

			selectedChunks.push(chunk);
			usedCharacters += chunk.text.length;
		}

		return selectedChunks;
	}

	private scoreKeywordChunk(chunk: AiWritingBuddyRagChunk, queryTerms: string[]): number {
		if (queryTerms.length === 0) {
			return chunk.chunkIndex === 0 ? 1 : 0;
		}

		const contentTerms = this.tokenize(chunk.text);
		const titleTerms = this.tokenize(chunk.fileTitle);
		const pathTerms = this.tokenize(chunk.filePath);
		const contentTermCounts = new Map<string, number>();
		let score = 0;

		for (const term of contentTerms) {
			contentTermCounts.set(term, (contentTermCounts.get(term) ?? 0) + 1);
		}

		for (const term of queryTerms) {
			score += Math.min(contentTermCounts.get(term) ?? 0, 6);

			if (titleTerms.includes(term)) {
				score += 5;
			}

			if (pathTerms.includes(term)) {
				score += 2;
			}
		}

		return score;
	}

	private tokenize(text: string): string[] {
		const matches = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
		const stopWords = new Set(["the", "and", "for", "that", "this", "with", "from", "have", "what", "when", "where", "which", "about", "into", "your", "note", "notes"]);

		return matches.filter((term) => !stopWords.has(term));
	}
}
