import { ItemView, WorkspaceLeaf } from "obsidian";
import { ConfirmClearSessionModal } from "../modals/ConfirmClearSessionModal";
import { ConfirmNewSessionModal } from "../modals/ConfirmNewSessionModal";
import { DraftBenchChatComposerRenderer } from "../renderers/DraftBenchChatComposerRenderer";
import { DraftBenchEntryRenderer } from "../renderers/DraftBenchEntryRenderer";
import { DraftBenchHeaderRenderer } from "../renderers/DraftBenchHeaderRenderer";
import type { AiResponseService } from "../services/AiResponseService";
import { ClipboardService } from "../services/ClipboardService";
import { SelectionEditService } from "../services/SelectionEditService";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { DraftBenchSessionController } from "../controllers/DraftBenchSessionController";
import { PLUGIN_DISPLAY } from "../config/pluginDisplay";
import { AiDraftBenchCurrentSessionData, AiDraftBenchSessionListItem } from "../types/AiDraftBenchPluginData";

export const AI_DRAFT_BENCH_VIEW_TYPE = "ai-draft-bench-view";

type SessionSaveHandler = (entries: AiDraftBenchEntry[]) => void;
type NewSessionHandler = () => void;
type SessionListProvider = () => AiDraftBenchSessionListItem[];
type RestoreSessionHandler = (sessionId: string) => AiDraftBenchCurrentSessionData | null;

export class AiDraftBenchView extends ItemView {
	private readonly sessionController: DraftBenchSessionController;
	private readonly clipboardService: ClipboardService;
	private readonly selectionEditService: SelectionEditService;
	private readonly entryRenderer: DraftBenchEntryRenderer;
	private readonly headerRenderer = new DraftBenchHeaderRenderer();
	private readonly chatComposerRenderer: DraftBenchChatComposerRenderer;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly aiResponseService: AiResponseService,
		initialEntries: AiDraftBenchEntry[],
		onSaveSession: SessionSaveHandler,
		onNewSession: NewSessionHandler,
		private readonly getSessionListItems: SessionListProvider,
		private readonly onRestoreSession: RestoreSessionHandler,
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

		this.clipboardService = new ClipboardService();
		this.selectionEditService = new SelectionEditService(this.app);

		this.entryRenderer = new DraftBenchEntryRenderer(this.app, this.clipboardService, this.selectionEditService, (entryId) => {
			this.sessionController.setReplyToEntry(entryId);
		});

		this.chatComposerRenderer = new DraftBenchChatComposerRenderer(
			(message) => {
				void this.sessionController.addChatEntry(message);
			},
			() => {
				this.sessionController.clearReplyToEntry();
			},
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

		this.headerRenderer.render(container, {
			hasEntries: this.sessionController.hasEntries(),
			sessionListItems: this.getSessionListItems(),
			onClearSession: () => {
				this.clearCurrentSession();
			},
			onStartNewSession: () => {
				this.startNewSession();
			},
			onRestoreSession: (sessionId) => {
				this.restoreSession(sessionId);
			},
		});

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

	private restoreSession(sessionId: string): void {
		const restoredSession = this.onRestoreSession(sessionId);

		if (!restoredSession) {
			return;
		}

		this.sessionController.replaceCurrentSessionEntries(restoredSession.entries);
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
