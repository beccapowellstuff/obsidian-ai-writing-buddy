import { ItemView, WorkspaceLeaf } from "obsidian";
import { PLUGIN_DISPLAY } from "../config/pluginDisplay";
import { ClipboardService } from "../services/ClipboardService";
import { SelectionEditService } from "../services/SelectionEditService";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { DraftBenchEntryRenderer } from "../renderers/DraftBenchEntryRenderer";

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

	constructor(leaf: WorkspaceLeaf) {
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
		const response: AiDraftBenchResponse = {
			text: `Fake AI response for: ${request.instruction}`,
			createdAt: new Date().toISOString(),
			isPlaceholder: true,
		};

		this.entries.push({
			id: crypto.randomUUID(),
			type: "selection",
			request,
			response,
			createdAt: new Date().toISOString(),
		});

		this.render();
		this.scrollToBottom();
	}

	private addChatEntry(message: string): void {
		const trimmedMessage = message.trim();

		if (!trimmedMessage) {
			return;
		}

		const replyToEntryId = this.replyToEntryId;

		const response: AiDraftBenchResponse = {
			text: replyToEntryId ? `Mock follow-up response: ${trimmedMessage}` : `Mock chat response: ${trimmedMessage}`,
			createdAt: new Date().toISOString(),
			isPlaceholder: true,
		};

		this.entries.push({
			id: crypto.randomUUID(),
			type: "chat",
			message: trimmedMessage,
			response,
			createdAt: new Date().toISOString(),
			replyToEntryId: replyToEntryId ?? undefined,
		});

		this.replyToEntryId = null;

		this.render();
		this.scrollToBottom();
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

		this.renderChatComposer(container);
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

	private renderChatComposer(container: HTMLElement): void {
		const composerEl = container.createEl("div", {
			cls: "ai-draft-bench-chat-composer",
		});

		if (this.replyToEntryId) {
			const replyEl = composerEl.createEl("div", {
				cls: "ai-draft-bench-reply-context",
			});

			replyEl.createSpan({
				text: "Replying to an earlier draft",
			});

			const cancelButtonEl = replyEl.createEl("button", {
				text: "Cancel",
				cls: "ai-draft-bench-reply-cancel",
			});

			cancelButtonEl.addEventListener("click", () => {
				this.replyToEntryId = null;
				this.render();
			});
		}

		const inputEl = composerEl.createEl("textarea", {
			cls: "ai-draft-bench-chat-input",
			attr: {
				placeholder: "Ask about your draft...",
				rows: "2",
			},
		});

		const sendButtonEl = composerEl.createEl("button", {
			cls: "ai-draft-bench-chat-send",
			text: "Send",
		});

		sendButtonEl.addEventListener("click", () => {
			this.addChatEntry(inputEl.value);
		});

		inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				this.addChatEntry(inputEl.value);
			}
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
