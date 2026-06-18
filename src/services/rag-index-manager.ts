import { Notice, TFile, type App, type TAbstractFile } from "obsidian";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { AiWritingBuddyContextRetrievalMode } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyRagIndexStatus } from "../types/rag-index";
import { RagFileIndexer } from "./rag-file-indexer";
import { RagIndexStore } from "./rag-index-store";

const FILE_UPDATE_DEBOUNCE_MS = 30000;

export class RagIndexManager {
	private readonly pendingUpdateTimers = new Map<string, number>();
	private readonly pendingIdleCallbacks = new Map<string, number>();
	private vaultIndexBuiltThisSession = false;
	private status: AiWritingBuddyRagIndexStatus = {
		state: "idle",
		indexedFileCount: 0,
		totalMarkdownFileCount: 0,
		processedFileCount: 0,
	};

	constructor(
		private readonly app: App,
		private readonly settings: AiWritingBuddySettings,
		private readonly store: RagIndexStore,
	) {}

	async getStatus(): Promise<AiWritingBuddyRagIndexStatus> {
		await this.refreshVaultIndexActivation();
		await this.refreshCounts();

		return { ...this.status };
	}

	getStatusSnapshot(): AiWritingBuddyRagIndexStatus {
		return { ...this.status };
	}

	async buildIndex(): Promise<AiWritingBuddyRagIndexStatus> {
		return await this.indexVaultMarkdownFiles(false);
	}

	async rebuildIndex(): Promise<AiWritingBuddyRagIndexStatus> {
		await this.store.clearIndex();

		return await this.indexVaultMarkdownFiles(true);
	}

	async clearIndex(): Promise<AiWritingBuddyRagIndexStatus> {
		await this.store.clearIndex();
		this.vaultIndexBuiltThisSession = false;
		this.status = {
			state: "idle",
			indexedFileCount: 0,
			totalMarkdownFileCount: this.getMarkdownFiles().length,
			processedFileCount: 0,
		};

		return { ...this.status };
	}

	handleVaultFileCreatedOrModified(file: TAbstractFile): void {
		if (!this.vaultIndexBuiltThisSession || !this.isMarkdownFile(file)) {
			return;
		}

		this.scheduleFileUpdate(file);
	}

	handleVaultFileDeleted(file: TAbstractFile): void {
		if (!this.vaultIndexBuiltThisSession || !this.isMarkdownFile(file)) {
			return;
		}

		void this.removeFileIndex(file.path);
	}

	handleVaultFileRenamed(file: TAbstractFile, oldPath: string): void {
		if (this.vaultIndexBuiltThisSession && oldPath.toLowerCase().endsWith(".md")) {
			void this.removeFileIndex(oldPath);
		}

		this.handleVaultFileCreatedOrModified(file);
	}

	dispose(): void {
		for (const timerId of this.pendingUpdateTimers.values()) {
			window.clearTimeout(timerId);
		}

		for (const idleCallbackId of this.pendingIdleCallbacks.values()) {
			this.cancelIdleCallback(idleCallbackId);
		}

		this.pendingUpdateTimers.clear();
		this.pendingIdleCallbacks.clear();
	}

	private async indexVaultMarkdownFiles(clearError: boolean): Promise<AiWritingBuddyRagIndexStatus> {
		const files = this.getMarkdownFiles();
		const totalMarkdownFileCount = files.length;
		let indexedFileCount = 0;
		let retrievalMode: AiWritingBuddyContextRetrievalMode | undefined;
		let lastError: string | undefined = clearError ? undefined : this.status.lastError;

		this.status = {
			state: "indexing",
			indexedFileCount: this.status.indexedFileCount,
			totalMarkdownFileCount,
			processedFileCount: 0,
			lastIndexedAt: this.status.lastIndexedAt,
			retrievalMode: this.status.retrievalMode,
			lastError,
		};

		try {
			const indexer = this.createFileIndexer();

			for (const [index, file] of files.entries()) {
				this.status = {
					...this.status,
					state: "indexing",
					totalMarkdownFileCount,
					processedFileCount: index,
					currentFilePath: file.path,
				};

				const result = await indexer.ensureFileIndexed(file);

				indexedFileCount += 1;
				retrievalMode = result.file.retrievalMode === "keyword" || retrievalMode === "keyword" ? "keyword" : "embedding";

				if (result.usedKeywordFallback && result.errorMessage) {
					lastError = result.errorMessage;
				}

				this.status = {
					...this.status,
					indexedFileCount,
					processedFileCount: index + 1,
					retrievalMode,
					lastError,
				};

				await this.yieldToUi();
			}

			await this.removeStaleIndexes(files);
			const lastIndexedAt = Date.now();
			await this.store.markVaultIndexBuilt(lastIndexedAt);
			await this.refreshCounts();
			this.vaultIndexBuiltThisSession = true;
			this.status = {
				...this.status,
				state: "completed",
				totalMarkdownFileCount,
				processedFileCount: totalMarkdownFileCount,
				currentFilePath: undefined,
				lastIndexedAt,
				retrievalMode,
				lastError,
			};

			if (lastError) {
				new Notice(INTERFACE_TEXT.settings.rag.keywordFallbackNotice);
			}

			return { ...this.status };
		} catch (error) {
			const errorMessage = this.extractErrorMessage(error);

			console.error("AI Writing Buddy RAG vault indexing failed", error);

			this.status = {
				...this.status,
				state: "failed",
				currentFilePath: undefined,
				lastError: errorMessage,
			};

			throw error;
		}
	}

	private scheduleFileUpdate(file: TFile): void {
		const existingTimerId = this.pendingUpdateTimers.get(file.path);

		if (existingTimerId !== undefined) {
			window.clearTimeout(existingTimerId);
		}

		const existingIdleCallbackId = this.pendingIdleCallbacks.get(file.path);

		if (existingIdleCallbackId !== undefined) {
			this.cancelIdleCallback(existingIdleCallbackId);
			this.pendingIdleCallbacks.delete(file.path);
		}

		const timerId = window.setTimeout(() => {
			this.pendingUpdateTimers.delete(file.path);
			this.scheduleIdleFileUpdate(file);
		}, FILE_UPDATE_DEBOUNCE_MS);

		this.pendingUpdateTimers.set(file.path, timerId);
	}

	private scheduleIdleFileUpdate(file: TFile): void {
		const run = (): void => {
			this.pendingIdleCallbacks.delete(file.path);
			void this.indexChangedFile(file);
		};

		if ("requestIdleCallback" in window) {
			const idleCallbackId = window.requestIdleCallback(run, {
				timeout: FILE_UPDATE_DEBOUNCE_MS,
			});

			this.pendingIdleCallbacks.set(file.path, idleCallbackId);
			return;
		}

		void this.indexChangedFile(file);
	}

	private async indexChangedFile(file: TFile): Promise<void> {
		try {
			const result = await this.createFileIndexer().ensureFileIndexed(file);
			const lastError = result.errorMessage ?? this.status.lastError;

			await this.refreshCounts();
			this.status = {
				...this.status,
				state: "completed",
				currentFilePath: undefined,
				lastIndexedAt: Date.now(),
				retrievalMode: result.file.retrievalMode,
				lastError,
			};
		} catch (error) {
			const errorMessage = this.extractErrorMessage(error);

			console.warn("AI Writing Buddy RAG file update failed", error);

			this.status = {
				...this.status,
				state: "failed",
				currentFilePath: undefined,
				lastError: errorMessage,
			};
		}
	}

	private async removeFileIndex(filePath: string): Promise<void> {
		await this.store.deleteFileIndex(filePath);
		await this.refreshCounts();
		this.status = {
			...this.status,
			state: "completed",
			currentFilePath: undefined,
			lastIndexedAt: Date.now(),
		};
	}

	private async removeStaleIndexes(markdownFiles: TFile[]): Promise<void> {
		const livePaths = new Set(markdownFiles.map((file) => file.path));
		const indexedPaths = await this.store.listIndexedFilePaths();

		for (const filePath of indexedPaths) {
			if (!livePaths.has(filePath)) {
				await this.store.deleteFileIndex(filePath);
			}
		}
	}

	private async refreshCounts(): Promise<void> {
		this.status = {
			...this.status,
			indexedFileCount: await this.store.countIndexedFiles(),
			totalMarkdownFileCount: this.getMarkdownFiles().length,
		};
	}

	private async refreshVaultIndexActivation(): Promise<void> {
		this.vaultIndexBuiltThisSession = await this.store.hasVaultIndexBeenBuilt();
	}

	private getMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	private createFileIndexer(): RagFileIndexer {
		return new RagFileIndexer(this.app, this.settings, this.store);
	}

	private isMarkdownFile(file: TAbstractFile | null | undefined): file is TFile {
		return file instanceof TFile && file.extension.toLowerCase() === "md";
	}

	private extractErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message.trim()) {
			return error.message.trim();
		}

		if (typeof error === "string" && error.trim()) {
			return error.trim();
		}

		return "RAG indexing failed.";
	}

	private async yieldToUi(): Promise<void> {
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, 0);
		});
	}

	private cancelIdleCallback(idleCallbackId: number): void {
		if ("cancelIdleCallback" in window) {
			window.cancelIdleCallback(idleCallbackId);
		}
	}
}
