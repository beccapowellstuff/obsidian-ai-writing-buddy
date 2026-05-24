import type { AiWritingBuddySettings } from "../config/default-settings";
import type { AiResponseService } from "../services/ai-response-service";
import { AiWritingBuddySessionHistoryTrimmer } from "../services/session-history-trimmer";
import { AiWritingBuddySessionSummaryService } from "../services/session-summary-service";
import type { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import type { AiWritingBuddyMemorySummary } from "../types/ai-writing-buddy-plugin-data";
import type { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { createPlaceholderResponse } from "../utils/create-placeholder-response";
import { formatProviderErrorMessage } from "../utils/format-provider-error-message";

type SessionChangeHandler = (scrollToBottom: boolean) => void;
type SessionSaveHandler = (entries: AiWritingBuddyEntry[], memorySummary?: AiWritingBuddyMemorySummary) => void;
type NewSessionHandler = (sessionTitle?: string) => void;

export class AiWritingBuddySessionController {
	private entries: AiWritingBuddyEntry[];
	private replyToEntryId: string | null = null;
	private memorySummary: AiWritingBuddyMemorySummary | undefined;
	private readonly sessionHistoryTrimmer: AiWritingBuddySessionHistoryTrimmer;
	private readonly sessionSummaryService: AiWritingBuddySessionSummaryService;

	constructor(
		private readonly getAiResponseService: () => AiResponseService,
		private readonly onChange: SessionChangeHandler,
		private readonly onSave: SessionSaveHandler,
		private readonly onNewSession: NewSessionHandler,
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
			return "Replying to an earlier draft";
		}

		return `Replying to: ${this.getEntrySnippet(replyToEntry)}`;
	}

	async addSelectionEntry(request: AiWritingBuddyRequest): Promise<void> {
		const entry: AiWritingBuddyEntry = {
			id: crypto.randomUUID(),
			type: "selection",
			request,
			response: createPlaceholderResponse("Thinking..."),
			createdAt: new Date().toISOString(),
		};

		this.entries.push(entry);
		this.saveSession();
		this.onChange(true);

		try {
			entry.response = await this.getAiResponseService().createSelectionResponse(request);
		} catch (error) {
			console.error("AI Writing Buddy selection response failed", error);

			entry.response = createPlaceholderResponse(["AI provider error.", "", formatProviderErrorMessage(error)].join("\n"));
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

		const entry: AiWritingBuddyEntry = {
			id: crypto.randomUUID(),
			type: "chat",
			message: trimmedMessage,
			response: createPlaceholderResponse("Thinking..."),
			createdAt: new Date().toISOString(),
			replyToEntryId: replyToEntryId ?? undefined,
			replyToSnippet,
		};

		this.entries.push(entry);
		this.replyToEntryId = null;
		this.saveSession();
		this.onChange(true);

		try {
			entry.response = await this.getAiResponseService().createChatResponse({
				message: trimmedMessage,
				replyToEntry,
				recentEntries,
				memorySummary: this.memorySummary,
			});
		} catch (error) {
			console.error("AI Writing Buddy chat response failed", error);

			entry.response = createPlaceholderResponse(["AI provider error.", "", formatProviderErrorMessage(error)].join("\n"));
		}

		this.refreshMemorySummary();
		this.saveSession();
		this.onChange(true);
	}

	private refreshMemorySummary(): void {
		this.memorySummary = this.sessionSummaryService.createMemorySummary(this.entries);
	}

	private saveSession(): void {
		this.onSave([...this.entries], this.memorySummary);
	}

	private getEntrySnippet(entry: AiWritingBuddyEntry): string {
		const text = entry.response.text.replace(/\s+/g, " ").trim();

		if (!text) {
			return "Empty response";
		}

		if (text.length <= 90) {
			return text;
		}

		return `${text.slice(0, 87)}...`;
	}
}
