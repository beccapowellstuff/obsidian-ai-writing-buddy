import type { App, TFile } from "obsidian";
import type { AiWritingBuddySettings } from "../config/default-settings";
import type { AiWritingBuddyContextRetrievalMode } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyRagChunk, AiWritingBuddyRagFileIndexResult, AiWritingBuddyRagIndexedFile } from "../types/rag-index";
import { extractErrorMessage } from "../utils/extract-error-message";
import { EmbeddingService } from "./embedding-service";
import { RagChunker } from "./rag-chunker";
import type { RagIndexStore } from "./rag-index-store";

export class RagFileIndexer {
	private readonly chunker = new RagChunker();

	constructor(
		private readonly app: App,
		private readonly settings: AiWritingBuddySettings,
		private readonly store: RagIndexStore,
	) {}

	async ensureFileIndexed(file: TFile): Promise<AiWritingBuddyRagFileIndexResult> {
		const content = await this.app.vault.cachedRead(file);
		const fileHash = await this.hashText(content);
		const indexedFile = await this.store.getIndexedFile(file.path);
		const desiredMode: AiWritingBuddyContextRetrievalMode = this.createEmbeddingService().isConfigured() ? "embedding" : "keyword";

		if (this.canReuseIndex(indexedFile, fileHash, desiredMode)) {
			return {
				file: indexedFile,
				usedKeywordFallback: indexedFile.retrievalMode === "keyword",
			};
		}

		if (desiredMode === "embedding") {
			try {
				return {
					file: await this.indexFileWithEmbeddings(file, content, fileHash),
					usedKeywordFallback: false,
				};
			} catch (error) {
				const errorMessage = extractErrorMessage(error, "Embedding provider unavailable.");

				console.warn("AI Writing Buddy embedding indexing failed; storing keyword chunks.", error);

				return {
					file: await this.indexFileWithKeywords(file, content, fileHash),
					usedKeywordFallback: true,
					errorMessage,
				};
			}
		}

		return {
			file: await this.indexFileWithKeywords(file, content, fileHash),
			usedKeywordFallback: true,
		};
	}

	async reindexFileWithEmbeddings(file: TFile): Promise<AiWritingBuddyRagIndexedFile> {
		const content = await this.app.vault.cachedRead(file);
		const fileHash = await this.hashText(content);

		return await this.indexFileWithEmbeddings(file, content, fileHash);
	}

	private canReuseIndex(indexedFile: AiWritingBuddyRagIndexedFile | null, fileHash: string, desiredMode: AiWritingBuddyContextRetrievalMode): indexedFile is AiWritingBuddyRagIndexedFile {
		if (!indexedFile || indexedFile.fileHash !== fileHash || indexedFile.retrievalMode !== desiredMode) {
			return false;
		}

		if (desiredMode === "keyword") {
			return true;
		}

		const embeddingModel = this.createEmbeddingService().getEmbeddingModel();

		return indexedFile.embeddingModel === embeddingModel && (indexedFile.chunkCount === 0 || (typeof indexedFile.embeddingDimension === "number" && indexedFile.embeddingDimension > 0));
	}

	private async indexFileWithEmbeddings(file: TFile, content: string, fileHash: string): Promise<AiWritingBuddyRagIndexedFile> {
		const chunkerChunks = this.chunker.chunk(file, content);
		const embeddingService = this.createEmbeddingService();
		const now = Date.now();

		if (chunkerChunks.length === 0) {
			const indexedFile: AiWritingBuddyRagIndexedFile = {
				filePath: file.path,
				fileTitle: file.basename,
				fileHash,
				embeddingModel: embeddingService.getEmbeddingModel(),
				retrievalMode: "embedding",
				chunkCount: 0,
				indexedAt: now,
			};

			await this.store.upsertFileIndex(indexedFile, []);

			return indexedFile;
		}

		const embeddingResult = await embeddingService.embedTexts(chunkerChunks.map((chunk) => chunk.text));
		const chunks: AiWritingBuddyRagChunk[] = chunkerChunks.map((chunk, index) => ({
			...chunk,
			fileHash,
			embedding: embeddingResult.embeddings[index],
			embeddingDimension: embeddingResult.dimension,
			retrievalMode: "embedding",
			updatedAt: now,
		}));
		const indexedFile: AiWritingBuddyRagIndexedFile = {
			filePath: file.path,
			fileTitle: file.basename,
			fileHash,
			embeddingModel: embeddingResult.model,
			embeddingDimension: embeddingResult.dimension,
			retrievalMode: "embedding",
			chunkCount: chunks.length,
			indexedAt: now,
		};

		await this.store.upsertFileIndex(indexedFile, chunks);

		return indexedFile;
	}

	private async indexFileWithKeywords(file: TFile, content: string, fileHash: string): Promise<AiWritingBuddyRagIndexedFile> {
		const chunkerChunks = this.chunker.chunk(file, content);
		const now = Date.now();
		const chunks: AiWritingBuddyRagChunk[] = chunkerChunks.map((chunk) => ({
			...chunk,
			fileHash,
			retrievalMode: "keyword",
			updatedAt: now,
		}));
		const indexedFile: AiWritingBuddyRagIndexedFile = {
			filePath: file.path,
			fileTitle: file.basename,
			fileHash,
			retrievalMode: "keyword",
			chunkCount: chunks.length,
			indexedAt: now,
		};

		await this.store.upsertFileIndex(indexedFile, chunks);

		return indexedFile;
	}

	private createEmbeddingService(): EmbeddingService {
		return new EmbeddingService(this.settings);
	}

	private async hashText(text: string): Promise<string> {
		const data = new TextEncoder().encode(text);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashBytes = Array.from(new Uint8Array(hashBuffer));

		return hashBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
	}

}
