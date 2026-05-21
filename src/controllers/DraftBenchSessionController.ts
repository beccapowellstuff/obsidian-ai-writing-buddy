import type { AiResponseService } from "../services/AiResponseService";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { createPlaceholderResponse } from "../utils/createPlaceholderResponse";

type SessionChangeHandler = (scrollToBottom: boolean) => void;

export class DraftBenchSessionController {
	private entries: AiDraftBenchEntry[] = [];
	private replyToEntryId: string | null = null;

	constructor(
		private readonly aiResponseService: AiResponseService,
		private readonly onChange: SessionChangeHandler,
	) {}

	getEntries(): AiDraftBenchEntry[] {
		return this.entries;
	}

	hasEntries(): boolean {
		return this.entries.length > 0;
	}

	clearCurrentSession(): void {
		this.entries = [];
		this.replyToEntryId = null;
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

	async addSelectionEntry(request: AiDraftBenchRequest): Promise<void> {
		const entry: AiDraftBenchEntry = {
			id: crypto.randomUUID(),
			type: "selection",
			request,
			response: createPlaceholderResponse("Thinking..."),
			createdAt: new Date().toISOString(),
		};

		this.entries.push(entry);
		this.onChange(true);

		try {
			entry.response = await this.aiResponseService.createSelectionResponse(request);
		} catch (error) {
			console.error("AI Draft Bench selection response failed", error);

			entry.response = createPlaceholderResponse(["AI provider error.", "", this.getErrorMessage(error), "", "Check your provider settings, server address, and selected model."].join("\n"));
		}

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

		const entry: AiDraftBenchEntry = {
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
		this.onChange(true);

		try {
			entry.response = await this.aiResponseService.createChatResponse({
				message: trimmedMessage,
				replyToEntry,
			});
		} catch (error) {
			console.error("AI Draft Bench chat response failed", error);

			entry.response = createPlaceholderResponse(["AI provider error.", "", this.getErrorMessage(error), "", "Check your provider settings, server address, and selected model."].join("\n"));
		}

		this.onChange(true);
	}

	private getEntrySnippet(entry: AiDraftBenchEntry): string {
		const text = entry.response.text.replace(/\s+/g, " ").trim();

		if (!text) {
			return "Empty response";
		}

		if (text.length <= 90) {
			return text;
		}

		return `${text.slice(0, 87)}...`;
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message.trim()) {
			return error.message.trim();
		}

		return "Unknown provider error.";
	}
}
