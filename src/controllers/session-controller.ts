import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { AiResponseService } from "../services/ai-response-service";
import { AiWritingBuddySessionHistoryTrimmer } from "../services/session-history-trimmer";
import { AiWritingBuddySessionSummaryService } from "../services/session-summary-service";
import type { AiWritingBuddyChatNoteContext, AiWritingBuddyUsedContext } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyChatEntry, AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import type { AiWritingBuddyMemorySummary } from "../types/ai-writing-buddy-plugin-data";
import type { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import type { AiWritingBuddyUsedMemory, AiWritingBuddyVisibleMemoryContext } from "../types/ai-writing-buddy-visible-memory";
import type { ResponseDiffChangeRejection } from "../types/response-diff-change";
import { createPlaceholderResponse } from "../utils/create-placeholder-response";
import { formatProviderErrorMessage } from "../utils/format-provider-error-message";

type SessionChangeHandler = (scrollToBottom: boolean) => void;
type SessionSaveHandler = (entries: AiWritingBuddyEntry[], memorySummary?: AiWritingBuddyMemorySummary) => void;
type NewSessionHandler = (sessionTitle?: string) => void;
type NoteContextProvider = (message: string) => Promise<AiWritingBuddyChatNoteContext | undefined>;
type VisibleMemoryProvider = () => Promise<AiWritingBuddyVisibleMemoryContext | undefined>;
type ChatResponseCompletedHandler = (entry: AiWritingBuddyChatEntry, assistantResponseText: string) => void;

export class AiWritingBuddySessionController {
	private entries: AiWritingBuddyEntry[];
	private readonly cancelledEntryIds = new Set<string>();
	private readonly activeResponseControllers = new Map<string, AbortController>();
	private replyToEntryId: string | null = null;
	private memorySummary: AiWritingBuddyMemorySummary | undefined;
	private readonly sessionHistoryTrimmer: AiWritingBuddySessionHistoryTrimmer;
	private readonly sessionSummaryService: AiWritingBuddySessionSummaryService;

	constructor(
		private readonly getAiResponseService: () => AiResponseService,
		private readonly onChange: SessionChangeHandler,
		private readonly onSave: SessionSaveHandler,
		private readonly onNewSession: NewSessionHandler,
		private readonly getNoteContext: NoteContextProvider,
		private readonly getVisibleMemory: VisibleMemoryProvider,
		private readonly onChatResponseCompleted: ChatResponseCompletedHandler,
		settings: AiWritingBuddySettings,
		initialEntries: AiWritingBuddyEntry[] = [],
		initialMemorySummary?: AiWritingBuddyMemorySummary,
	) {
		this.entries = [...initialEntries];
		this.memorySummary = initialMemorySummary;
		this.sessionHistoryTrimmer = new AiWritingBuddySessionHistoryTrimmer(settings);
		this.sessionSummaryService = new AiWritingBuddySessionSummaryService(settings);
	}

	getEntries(): AiWritingBuddyEntry[] {
		return this.entries;
	}

	hasEntries(): boolean {
		return this.entries.length > 0;
	}

	clearCurrentSession(): void {
		this.entries = [];
		this.replyToEntryId = null;
		this.memorySummary = undefined;
		this.saveSession();
		this.onChange(false);
	}

	startNewSession(sessionTitle?: string): void {
		this.entries = [];
		this.replyToEntryId = null;
		this.memorySummary = undefined;
		this.onNewSession(sessionTitle);
		this.onChange(false);
	}

	replaceCurrentSessionEntries(entries: AiWritingBuddyEntry[], memorySummary?: AiWritingBuddyMemorySummary): void {
		this.entries = [...entries];
		this.replyToEntryId = null;
		this.memorySummary = memorySummary;
		this.onChange(false);
	}

	setReplyToEntry(entryId: string): void {
		this.replyToEntryId = entryId;
		this.onChange(false);
	}

	clearReplyToEntry(): void {
		this.replyToEntryId = null;
		this.onChange(false);
	}

	getReplyContextText(): string | null {
		if (!this.replyToEntryId) {
			return null;
		}

		const replyToEntry = this.entries.find((entry) => entry.id === this.replyToEntryId);

		if (!replyToEntry) {
			return INTERFACE_TEXT.chat.replyingToEarlierDraft;
		}

		return INTERFACE_TEXT.chat.replyingTo(this.getEntrySnippet(replyToEntry));
	}

	rejectResponseChange(entryId: string, change: ResponseDiffChangeRejection): void {
		const entry = this.entries.find((candidate) => candidate.id === entryId);

		if (!entry || entry.response.isPlaceholder || !this.isValidChangeRejection(entry.response.text, change)) {
			return;
		}

		entry.response.text = [entry.response.text.slice(0, change.responseStartIndex), change.originalText, entry.response.text.slice(change.responseEndIndex)].join("");
		this.refreshMemorySummary();
		this.saveSession();
		this.onChange(false);
	}

	cancelResponse(entryId: string): void {
		const entry = this.entries.find((candidate) => candidate.id === entryId);

		if (!entry || !this.isPendingResponse(entry)) {
			return;
		}

		this.cancelledEntryIds.add(entryId);
		this.activeResponseControllers.get(entryId)?.abort();
		entry.response = createPlaceholderResponse(INTERFACE_TEXT.responses.cancelled);
		this.saveSession();
		this.onChange(false);
	}

	async addSelectionEntry(request: AiWritingBuddyRequest): Promise<void> {
		const entry: AiWritingBuddyEntry = {
			id: crypto.randomUUID(),
			type: "selection",
			request,
			response: createPlaceholderResponse(INTERFACE_TEXT.responses.thinking),
			createdAt: new Date().toISOString(),
		};

		this.entries.push(entry);
		const abortController = this.registerActiveResponse(entry.id);
		this.saveSession();
		this.onChange(true);

		try {
			const response = await this.getAiResponseService().createSelectionResponse(request, {
				signal: abortController.signal,
			});

			if (this.wasEntryCancelled(entry.id)) {
				return;
			}

			entry.response = response;
		} catch (error) {
			if (!this.setProviderErrorResponse(entry, error, "AI Writing Buddy selection response failed")) {
				return;
			}
		} finally {
			this.activeResponseControllers.delete(entry.id);
		}

		this.refreshMemorySummary();
		this.saveSession();
		this.onChange(true);
	}

	async addChatEntry(message: string): Promise<void> {
		const trimmedMessage = message.trim();

		if (!trimmedMessage) {
			return;
		}

		const replyToEntryId = this.replyToEntryId;
		const replyToEntry = replyToEntryId ? this.entries.find((entry) => entry.id === replyToEntryId) : undefined;
		const replyToSnippet = replyToEntry ? this.getEntrySnippet(replyToEntry) : undefined;
		const recentEntries = this.sessionHistoryTrimmer.getRecentEntries(this.entries, {
			excludeEntryId: replyToEntryId ?? undefined,
		});
		const noteContext = await this.getNoteContext(trimmedMessage);
		const visibleMemory = await this.getVisibleMemory();

		const entry: AiWritingBuddyChatEntry = {
			id: crypto.randomUUID(),
			type: "chat",
			message: trimmedMessage,
			response: createPlaceholderResponse(INTERFACE_TEXT.responses.thinking),
			createdAt: new Date().toISOString(),
			replyToEntryId: replyToEntryId ?? undefined,
			replyToSnippet,
			usedMemory: this.createUsedMemory(visibleMemory),
			usedContext: this.createUsedContext(noteContext),
		};

		this.entries.push(entry);
		const abortController = this.registerActiveResponse(entry.id);
		this.replyToEntryId = null;
		let completedChatResponseText: string | null = null;
		this.saveSession();
		this.onChange(true);

		try {
			const response = await this.getAiResponseService().createChatResponse({
				message: trimmedMessage,
				replyToEntry,
				recentEntries,
				memorySummary: this.memorySummary,
				visibleMemory,
				noteContext,
			}, {
				signal: abortController.signal,
			});

			if (this.wasEntryCancelled(entry.id)) {
				return;
			}

			entry.response = response;
			completedChatResponseText = [response.commentText, response.text].filter(Boolean).join("\n\n").trim();
		} catch (error) {
			if (!this.setProviderErrorResponse(entry, error, "AI Writing Buddy chat response failed")) {
				return;
			}
		} finally {
			this.activeResponseControllers.delete(entry.id);
		}

		this.refreshMemorySummary();
		this.saveSession();
		this.onChange(true);

		if (completedChatResponseText) {
			this.onChatResponseCompleted(entry, completedChatResponseText);
		}
	}

	private refreshMemorySummary(): void {
		this.memorySummary = this.sessionSummaryService.createMemorySummary(this.entries);
	}

	private isPendingResponse(entry: AiWritingBuddyEntry): boolean {
		return entry.response.isPlaceholder && entry.response.text === INTERFACE_TEXT.responses.thinking;
	}

	private registerActiveResponse(entryId: string): AbortController {
		const abortController = new AbortController();

		this.activeResponseControllers.set(entryId, abortController);

		return abortController;
	}

	private wasEntryCancelled(entryId: string): boolean {
		if (!this.cancelledEntryIds.has(entryId)) {
			return false;
		}

		this.cancelledEntryIds.delete(entryId);
		return true;
	}

	private setProviderErrorResponse(entry: AiWritingBuddyEntry, error: unknown, logMessage: string): boolean {
		if (this.wasEntryCancelled(entry.id)) {
			return false;
		}

		console.error(logMessage, error);
		entry.response = createPlaceholderResponse([INTERFACE_TEXT.responses.providerErrorHeading, "", formatProviderErrorMessage(error)].join("\n"));

		return true;
	}

	private createUsedContext(noteContext: AiWritingBuddyChatNoteContext | undefined): AiWritingBuddyUsedContext | undefined {
		if (!noteContext || noteContext.notes.length === 0) {
			return undefined;
		}

		return {
			scope: noteContext.scope,
			retrievalMode: noteContext.retrievalMode,
			usedKeywordFallback: noteContext.usedKeywordFallback,
			includeIndexedRag: noteContext.includeIndexedRag,
			notes: noteContext.notes.map((note) => ({
				title: note.title,
				path: note.path,
				contentIncluded: note.content.trim().length > 0,
				wasTruncated: note.wasTruncated,
				contentSource: note.contentSource,
				retrievalMode: note.retrievalMode,
				retrievedChunkCount: note.retrievedChunkCount,
				totalChunkCount: note.totalChunkCount,
			})),
		};
	}

	private createUsedMemory(visibleMemory: AiWritingBuddyVisibleMemoryContext | undefined): AiWritingBuddyUsedMemory | undefined {
		if (!visibleMemory || !visibleMemory.content.trim()) {
			return undefined;
		}

		return {
			filePath: visibleMemory.filePath,
			wasTruncated: visibleMemory.wasTruncated,
		};
	}

	private isValidChangeRejection(responseText: string, change: ResponseDiffChangeRejection): boolean {
		return (
			Number.isInteger(change.responseStartIndex) &&
			Number.isInteger(change.responseEndIndex) &&
			change.responseStartIndex >= 0 &&
			change.responseEndIndex >= change.responseStartIndex &&
			change.responseEndIndex <= responseText.length
		);
	}

	private saveSession(): void {
		this.onSave([...this.entries], this.memorySummary);
	}

	private getEntrySnippet(entry: AiWritingBuddyEntry): string {
		const text = [entry.response.commentText, entry.response.text].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

		if (!text) {
			return INTERFACE_TEXT.chat.emptyResponse;
		}

		if (text.length <= 90) {
			return text;
		}

		return `${text.slice(0, 87)}...`;
	}
}
