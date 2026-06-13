import { Notice } from "obsidian";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { AiWritingBuddyChatEntry } from "../types/ai-writing-buddy-entry";
import { AiMemoryOperationParser, MEMORY_UPDATE_NO_CHANGE } from "./ai-memory-operation-parser";
import { AiMemoryPatchApplier } from "./ai-memory-patch-applier";
import { AiMemoryRemovalPolicy } from "./ai-memory-removal-policy";
import type { AiResponseService } from "./ai-response-service";
import { AiMemoryService } from "./ai-memory-service";

type AiResponseServiceProvider = () => AiResponseService;
type SettingsSaveHandler = () => Promise<void>;

export type AiVisibleMemoryUpdateRequest = {
	entry: AiWritingBuddyChatEntry;
	assistantResponseText: string;
};

export class AiVisibleMemoryUpdateService {
	private readonly activeEntryIds = new Set<string>();
	private readonly operationParser = new AiMemoryOperationParser();
	private readonly patchApplier = new AiMemoryPatchApplier();
	private readonly removalPolicy = new AiMemoryRemovalPolicy();

	constructor(
		private readonly aiMemoryService: AiMemoryService,
		private readonly getAiResponseService: AiResponseServiceProvider,
		private readonly settings: AiWritingBuddySettings,
		private readonly onSaveSettings: SettingsSaveHandler,
	) {}

	async updateAfterChatResponse(request: AiVisibleMemoryUpdateRequest): Promise<void> {
		if (!this.shouldUpdateMemory(request)) {
			return;
		}

		this.activeEntryIds.add(request.entry.id);

		try {
			const currentMemory = await this.aiMemoryService.readManagedBlockForUpdate(this.settings);

			if (!currentMemory) {
				return;
			}

			const providerResponse = await this.getAiResponseService().createMemoryUpdateResponse({
				currentManagedMemory: currentMemory.content,
				latestUserMessage: request.entry.message,
				latestAssistantResponse: request.assistantResponseText,
				usedContextSummary: this.formatUsedContextSummary(request.entry),
			});
			const parsedResponse = this.operationParser.parse(providerResponse);

			if (parsedResponse === MEMORY_UPDATE_NO_CHANGE || !parsedResponse) {
				return;
			}

			const removalAllowed = this.removalPolicy.allowsRemoval(request.entry.message);
			const updatedManagedBlock = this.patchApplier.apply(currentMemory.content, parsedResponse, removalAllowed);

			if (!updatedManagedBlock || updatedManagedBlock === currentMemory.content) {
				return;
			}

			const writeResult = await this.aiMemoryService.replaceManagedBlockIfUnchanged(this.settings, currentMemory.content, updatedManagedBlock);

			if (writeResult !== "updated") {
				console.warn("AI Writing Buddy memory update skipped", {
					reason: writeResult,
					filePath: currentMemory.filePath,
				});
				return;
			}

			this.settings.aiMemoryWriteCount += 1;
			await this.onSaveSettings();

			if (this.settings.aiMemoryCleanupEnabled && this.settings.aiMemoryWriteCount >= this.settings.aiMemoryCleanupWriteThreshold) {
				console.debug("AI Writing Buddy memory cleanup threshold reached; cleanup is reserved for a future step.");
			}

			if (this.settings.aiMemoryShowUpdateNotice) {
				new Notice(INTERFACE_TEXT.notices.aiMemoryUpdated);
			}
		} catch (error) {
			console.warn("AI Writing Buddy memory update failed", error);
		} finally {
			this.activeEntryIds.delete(request.entry.id);
		}
	}

	private shouldUpdateMemory(request: AiVisibleMemoryUpdateRequest): boolean {
		return (
			this.settings.aiMemoryEnabled &&
			this.settings.aiMemoryAutoUpdateEnabled &&
			!this.activeEntryIds.has(request.entry.id) &&
			Boolean(request.entry.message.trim()) &&
			Boolean(request.assistantResponseText.trim())
		);
	}

	private formatUsedContextSummary(entry: AiWritingBuddyChatEntry): string | undefined {
		const lines: string[] = [];

		if (entry.usedMemory) {
			lines.push(`Visible memory was included from ${entry.usedMemory.filePath}${entry.usedMemory.wasTruncated ? " and was shortened" : ""}.`);
		}

		if (entry.usedContext) {
			const noteCount = entry.usedContext.notes.length;
			const chunkCount = entry.usedContext.notes.reduce((sum, note) => sum + (note.retrievedChunkCount ?? 0), 0);
			const contextParts: string[] = [entry.usedContext.scope];

			if (entry.usedContext.includeIndexedRag) {
				contextParts.push("RAG");
			}

			lines.push(`RAG/note context was used: ${contextParts.join(" + ")}; ${noteCount} notes; ${chunkCount} retrieved chunks.`);
		}

		return lines.length > 0 ? lines.join("\n") : undefined;
	}
}
