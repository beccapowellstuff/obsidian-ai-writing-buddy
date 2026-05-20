import { ItemView, WorkspaceLeaf } from "obsidian";
import { PLUGIN_DISPLAY } from "../config/pluginDisplay";
import { DraftBenchChatComposerRenderer } from "../renderers/DraftBenchChatComposerRenderer";
import { DraftBenchEntryRenderer } from "../renderers/DraftBenchEntryRenderer";
import type { AiResponseService } from "../services/AiResponseService";
import { ClipboardService } from "../services/ClipboardService";
import { SelectionEditService } from "../services/SelectionEditService";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { createPlaceholderResponse } from "../utils/createPlaceholderResponse";

export const AI_DRAFT_BENCH_VIEW_TYPE = "ai-draft-bench-view";

export class AiDraftBenchView extends ItemView {
	private entries: AiDraftBenchEntry[] = [];
	private replyToEntryId: string | null = null;
	private readonly clipboardService = new ClipboardService();
	private readonly selectionEditService = new SelectionEditService(this.app);
	private readonly entryRenderer = new DraftBenchEntryRenderer(this.clipboardService, this.selectionEditService, (entryId) => {
		this.replyToEntryId = entryId;
		this.render();
		this.scrollToBottom();
	});
	private readonly chatComposerRenderer = new DraftBenchChatComposerRenderer(
		(message) => {
			void this.addChatEntry(message);
		},
		() => {
			this.replyToEntryId = null;
			this.render();
		},
	);

	constructor(
		leaf: WorkspaceLeaf,
		private readonly aiResponseService: AiResponseService,
	) {
		super(leaf);
	}

	getViewType(): string {
		return AI_DRAFT_BENCH_VIEW_TYPE;
	}

	getDisplayText(): string {
		return PLUGIN_DISPLAY.name;
	}

	getIcon(): string {
		return PLUGIN_DISPLAY.viewIcon;
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		// Nothing to clean up yet.
	}

	setRequest(request: AiDraftBenchRequest): void {
		void this.addSelectionEntry(request);
	}

	private async addSelectionEntry(request: AiDraftBenchRequest): Promise<void> {
		const entry: AiDraftBenchEntry = {
			id: crypto.randomUUID(),
			type: "selection",
			request,
			response: createPlaceholderResponse("Thinking..."),
			createdAt: new Date().toISOString(),
		};

		this.entries.push(entry);
		this.render();
		this.scrollToBottom();

		try {
			entry.response = await this.aiResponseService.createSelectionResponse(request);
		} catch (error) {
			console.error("AI Draft Bench selection response failed", error);

			entry.response = createPlaceholderResponse("Sorry, AI Draft Bench could not create a response for this selection.");
		}

		this.render();
		this.scrollToBottom();
	}

	private async addChatEntry(message: string): Promise<void> {
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
		this.render();
		this.scrollToBottom();

		try {
			entry.response = await this.aiResponseService.createChatResponse({
				message: trimmedMessage,
				replyToEntry,
			});
		} catch (error) {
			console.error("AI Draft Bench chat response failed", error);

			entry.response = createPlaceholderResponse("Sorry, AI Draft Bench could not create a chat response.");
		}

		this.render();
		this.scrollToBottom();
	}

	private getReplyContextText(): string | null {
		if (!this.replyToEntryId) {
			return null;
		}

		const replyToEntry = this.entries.find((entry) => entry.id === this.replyToEntryId);

		if (!replyToEntry) {
			return "Replying to an earlier draft";
		}

		return `Replying to: ${this.getEntrySnippet(replyToEntry)}`;
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

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("ai-draft-bench-view");

		this.renderHeader(container);

		const entriesEl = container.createEl("div", {
			cls: "ai-draft-bench-entries",
		});

		if (this.entries.length === 0) {
			entriesEl.createEl("p", {
				cls: "ai-draft-bench-empty",
				text: "Select text in a note, right click, and ask AI about it. Or use the chat box below.",
			});
		}

		for (const entry of this.entries) {
			this.entryRenderer.renderEntry(entriesEl, entry);
		}

		this.chatComposerRenderer.render(container, this.getReplyContextText());
	}

	private renderHeader(container: HTMLElement): void {
		const headerEl = container.createEl("div", {
			cls: "ai-draft-bench-header",
		});

		headerEl.createEl("div", {
			cls: "ai-draft-bench-header-kicker",
			text: PLUGIN_DISPLAY.headerKicker,
		});

		headerEl.createEl("h2", {
			text: PLUGIN_DISPLAY.name,
		});

		headerEl.createEl("p", {
			text: PLUGIN_DISPLAY.headerDescription,
		});
	}

	private scrollToBottom(): void {
		window.setTimeout(() => {
			const entriesEl = this.contentEl.querySelector(".ai-draft-bench-entries");

			if (!(entriesEl instanceof HTMLElement)) {
				return;
			}

			entriesEl.scrollTo({
				top: entriesEl.scrollHeight,
				behavior: "smooth",
			});
		}, 0);
	}
}
