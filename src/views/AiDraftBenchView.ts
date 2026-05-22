import { ItemView, WorkspaceLeaf } from "obsidian";
import { ConfirmClearSessionModal } from "../modals/ConfirmClearSessionModal";
import { ConfirmNewSessionModal } from "../modals/ConfirmNewSessionModal";
import { PLUGIN_DISPLAY } from "../config/pluginDisplay";
import { DraftBenchChatComposerRenderer } from "../renderers/DraftBenchChatComposerRenderer";
import { DraftBenchEntryRenderer } from "../renderers/DraftBenchEntryRenderer";
import type { AiResponseService } from "../services/AiResponseService";
import { ClipboardService } from "../services/ClipboardService";
import { SelectionEditService } from "../services/SelectionEditService";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { DraftBenchSessionController } from "../controllers/DraftBenchSessionController";

export const AI_DRAFT_BENCH_VIEW_TYPE = "ai-draft-bench-view";

type SessionSaveHandler = (entries: AiDraftBenchEntry[]) => void;
type NewSessionHandler = () => void;

export class AiDraftBenchView extends ItemView {
	private readonly sessionController: DraftBenchSessionController;
	private readonly clipboardService = new ClipboardService();
	private readonly selectionEditService = new SelectionEditService(this.app);
	private readonly entryRenderer = new DraftBenchEntryRenderer(this.app, this.clipboardService, this.selectionEditService, (entryId) => {
		this.sessionController.setReplyToEntry(entryId);
	});
	private readonly chatComposerRenderer = new DraftBenchChatComposerRenderer(
		(message) => {
			void this.sessionController.addChatEntry(message);
		},
		() => {
			this.sessionController.clearReplyToEntry();
		},
	);

	constructor(
		leaf: WorkspaceLeaf,
		private readonly aiResponseService: AiResponseService,
		initialEntries: AiDraftBenchEntry[],
		onSaveSession: SessionSaveHandler,
		onNewSession: NewSessionHandler,
	) {
		super(leaf);

		this.sessionController = new DraftBenchSessionController(
			this.aiResponseService,
			(scrollToBottom) => {
				this.render();

				if (scrollToBottom) {
					this.scrollToBottom();
					return;
				}

				this.renderPreservingScroll();
			},
			onSaveSession,
			onNewSession,
			initialEntries,
		);
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
		void this.sessionController.addSelectionEntry(request);
	}

	private renderPreservingScroll(): void {
		const entriesEl = this.contentEl.querySelector(".ai-draft-bench-entries");
		const previousScrollTop = entriesEl instanceof HTMLElement ? entriesEl.scrollTop : null;

		this.render();

		if (previousScrollTop === null) {
			return;
		}

		window.setTimeout(() => {
			const newEntriesEl = this.contentEl.querySelector(".ai-draft-bench-entries");

			if (!(newEntriesEl instanceof HTMLElement)) {
				return;
			}

			newEntriesEl.scrollTop = previousScrollTop;
		}, 0);
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("ai-draft-bench-view");

		this.renderHeader(container);

		const entriesEl = container.createEl("div", {
			cls: "ai-draft-bench-entries",
		});

		const entries = this.sessionController.getEntries();

		if (entries.length === 0) {
			entriesEl.createEl("p", {
				cls: "ai-draft-bench-empty",
				text: "Select text in a note, right click, and ask AI about it. Or use the chat box below.",
			});
		}

		for (const entry of entries) {
			this.entryRenderer.renderEntry(entriesEl, entry);
		}

		this.chatComposerRenderer.render(container, this.sessionController.getReplyContextText());
	}

	private renderHeader(container: HTMLElement): void {
		const headerEl = container.createEl("div", {
			cls: "ai-draft-bench-header",
		});

		const headerTopEl = headerEl.createEl("div", {
			cls: "ai-draft-bench-header-top",
		});

		const titleGroupEl = headerTopEl.createEl("div", {
			cls: "ai-draft-bench-header-title-group",
		});

		titleGroupEl.createEl("div", {
			cls: "ai-draft-bench-header-kicker",
			text: PLUGIN_DISPLAY.headerKicker,
		});

		titleGroupEl.createEl("h2", {
			text: PLUGIN_DISPLAY.name,
		});

		const actionsEl = headerTopEl.createEl("div", {
			cls: "ai-draft-bench-header-actions",
		});

		const newSessionButton = actionsEl.createEl("button", {
			cls: "ai-draft-bench-session-button",
			text: "Start a new session",
		});
		newSessionButton.type = "button";
		newSessionButton.title = "Start a new session";
		newSessionButton.addEventListener("click", () => {
			this.startNewSession();
		});

		const clearButton = actionsEl.createEl("button", {
			cls: "ai-draft-bench-session-button",
			text: "Clear the current session",
		});
		clearButton.type = "button";
		clearButton.title = "Clear the current session";
		clearButton.disabled = !this.sessionController.hasEntries();
		clearButton.addEventListener("click", () => {
			this.clearCurrentSession();
		});

		headerEl.createEl("p", {
			text: PLUGIN_DISPLAY.headerDescription,
		});
	}

	private clearCurrentSession(): void {
		if (!this.sessionController.hasEntries()) {
			return;
		}

		new ConfirmClearSessionModal(this.app, () => {
			this.sessionController.clearCurrentSession();
		}).open();
	}

	private startNewSession(): void {
		if (!this.sessionController.hasEntries()) {
			this.sessionController.startNewSession();
			return;
		}

		new ConfirmNewSessionModal(this.app, () => {
			this.sessionController.startNewSession();
		}).open();
	}

	private scrollToBottom(): void {
		window.setTimeout(() => {
			const entriesEl = this.contentEl.querySelector(".ai-draft-bench-entries");

			if (!(entriesEl instanceof HTMLElement)) {
				return;
			}

			entriesEl.scrollTop = entriesEl.scrollHeight;
		}, 0);
	}
}
