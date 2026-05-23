import { ItemView, setIcon, setTooltip, WorkspaceLeaf } from "obsidian";
import { AiDraftBenchSettings } from "../config/default-settings";
import { PLUGIN_DISPLAY } from "../config/plugin-display";
import { ConfirmClearSessionModal } from "../modals/confirm-clear-session-modal";
import { ConfirmNewSessionModal } from "../modals/confirm-new-session-modal";
import { DraftBenchChatComposerRenderer } from "../renderers/chat-composer-renderer";
import { DraftBenchEntryRenderer } from "../renderers/entry-renderer";
import { DraftBenchHeaderRenderer } from "../renderers/header-renderer";
import type { AiResponseService } from "../services/ai-response-service";
import { ClipboardService } from "../services/clipboard-service";
import { SelectionEditService } from "../services/selection-edit-service";
import { AiDraftBenchEntry } from "../types/ai-writing-buddy-entry";
import { AiDraftBenchCurrentSessionData, AiDraftBenchMemorySummary, AiDraftBenchSessionListItem } from "../types/ai-writing-buddy-plugin-data";
import { AiDraftBenchRequest } from "../types/ai-writing-buddy-request";
import { DraftBenchSessionController } from "../controllers/session-controller";
import { SavedSessionsModal } from "../modals/saved-sessions-modal";

export const AI_DRAFT_BENCH_VIEW_TYPE = "ai-draft-bench-view";

type SessionSaveHandler = (entries: AiDraftBenchEntry[], memorySummary?: AiDraftBenchMemorySummary) => void;
type NewSessionHandler = (sessionTitle?: string) => void;
type SessionListProvider = () => AiDraftBenchSessionListItem[];
type RestoreSessionHandler = (sessionId: string) => AiDraftBenchCurrentSessionData | null;
type DeleteSavedSessionHandler = (sessionId: string) => AiDraftBenchSessionListItem[];
type SavedSessionsProvider = () => AiDraftBenchCurrentSessionData[];
type CurrentSessionTitleProvider = () => string | undefined;
type RenameSavedSessionHandler = (sessionId: string, title: string) => AiDraftBenchCurrentSessionData[];
type CurrentSessionProvider = () => AiDraftBenchCurrentSessionData | null;
type RenameCurrentSessionHandler = (title: string) => AiDraftBenchCurrentSessionData;
type DeleteCurrentSessionHandler = () => AiDraftBenchCurrentSessionData;

export class AiDraftBenchView extends ItemView {
	private readonly sessionController: DraftBenchSessionController;
	private readonly clipboardService: ClipboardService;
	private readonly selectionEditService: SelectionEditService;
	private readonly entryRenderer: DraftBenchEntryRenderer;
	private readonly headerRenderer = new DraftBenchHeaderRenderer();
	private readonly chatComposerRenderer: DraftBenchChatComposerRenderer;
	private scrollButtonEl: HTMLButtonElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly getAiResponseService: () => AiResponseService,
		private readonly settings: AiDraftBenchSettings,
		initialEntries: AiDraftBenchEntry[],
		initialMemorySummary: AiDraftBenchMemorySummary | undefined,
		onSaveSession: SessionSaveHandler,
		onNewSession: NewSessionHandler,
		private readonly getSessionListItems: SessionListProvider,
		private readonly onRestoreSession: RestoreSessionHandler,
		private readonly onDeleteSavedSession: DeleteSavedSessionHandler,
		private readonly onGetSavedSessions: SavedSessionsProvider,
		private readonly onRenameSavedSession: RenameSavedSessionHandler,
		private readonly getCurrentSessionTitle: CurrentSessionTitleProvider,
		private readonly onGetCurrentSession: CurrentSessionProvider,
		private readonly onRenameCurrentSession: RenameCurrentSessionHandler,
		private readonly onDeleteCurrentSession: DeleteCurrentSessionHandler,
	) {
		super(leaf);

		this.sessionController = new DraftBenchSessionController(
			this.getAiResponseService,
			(scrollToBottom) => {
				if (scrollToBottom) {
					this.render();
					this.scrollToBottom();
					return;
				}

				this.renderPreservingScroll();
			},

			onSaveSession,
			onNewSession,
			this.settings,
			initialEntries,
			initialMemorySummary,
		);

		this.clipboardService = new ClipboardService();
		this.selectionEditService = new SelectionEditService(this.app);

		this.entryRenderer = new DraftBenchEntryRenderer(this.app, this.clipboardService, this.selectionEditService, (entryId) => {
			this.sessionController.setReplyToEntry(entryId);
			this.chatComposerRenderer.requestFocusOnNextRender();
			this.render();
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
			currentSessionTitle: this.getCurrentSessionTitle(),
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
			onManageSavedSessions: () => {
				this.manageSavedSessions();
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

		this.renderScrollToBottomButton(container, entriesEl);

		this.chatComposerRenderer.render(container, this.sessionController.getReplyContextText());

		window.setTimeout(() => {
			this.updateScrollToBottomButton(entriesEl);
		}, 0);
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

		new ConfirmNewSessionModal(this.app, this.getDefaultSessionTitle(), (sessionTitle) => {
			this.sessionController.startNewSession(sessionTitle);
		}).open();
	}

	private getDefaultSessionTitle(): string {
		const currentSessionTitle = this.getCurrentSessionTitle();

		if (currentSessionTitle?.trim()) {
			return currentSessionTitle.trim();
		}

		return new Date().toLocaleString();
	}

	private restoreSession(sessionId: string): void {
		const restoredSession = this.onRestoreSession(sessionId);

		if (!restoredSession) {
			return;
		}

		this.sessionController.replaceCurrentSessionEntries(restoredSession.entries, restoredSession.memorySummary);
	}

	private manageSavedSessions(): void {
		new SavedSessionsModal(this.app, {
			currentSession: this.onGetCurrentSession(),
			savedSessions: this.onGetSavedSessions(),
			onOpenSession: (sessionId) => {
				this.restoreSession(sessionId);
			},
			onDeleteSavedSession: (sessionId) => {
				this.onDeleteSavedSession(sessionId);
				return this.onGetSavedSessions();
			},
			onRenameSavedSession: (sessionId, title) => {
				return this.onRenameSavedSession(sessionId, title);
			},
			onRenameCurrentSession: (title) => {
				return this.onRenameCurrentSession(title);
			},
			onDeleteCurrentSession: () => {
				const newSession = this.onDeleteCurrentSession();
				this.sessionController.replaceCurrentSessionEntries(newSession.entries, newSession.memorySummary);
				return newSession.entryCount > 0 || newSession.entries.length > 0 ? newSession : null;
			},
		}).open();
	}

	private renderScrollToBottomButton(container: HTMLElement, entriesEl: HTMLElement): void {
		const scrollButtonEl = container.createEl("button", {
			cls: "ai-draft-bench-scroll-bottom-button",
			attr: {
				"aria-label": "Scroll to latest response",
			},
		});

		setIcon(scrollButtonEl, "arrow-down");
		setTooltip(scrollButtonEl, "Scroll to latest response");

		scrollButtonEl.addEventListener("click", () => {
			this.smoothScrollToBottom();
		});

		entriesEl.addEventListener("scroll", () => {
			this.updateScrollToBottomButton(entriesEl);
		});

		this.scrollButtonEl = scrollButtonEl;
	}

	private updateScrollToBottomButton(entriesEl: HTMLElement): void {
		if (!this.scrollButtonEl) {
			return;
		}

		const distanceFromBottom = entriesEl.scrollHeight - entriesEl.scrollTop - entriesEl.clientHeight;
		const isScrollable = entriesEl.scrollHeight > entriesEl.clientHeight + 8;
		const isNearBottom = distanceFromBottom < 48;

		this.scrollButtonEl.toggleClass("is-visible", isScrollable && !isNearBottom);
	}

	private scrollToBottom(): void {
		const entriesEl = this.contentEl.querySelector(".ai-draft-bench-entries");

		if (!(entriesEl instanceof HTMLElement)) {
			return;
		}

		entriesEl.scrollTop = entriesEl.scrollHeight;
		this.updateScrollToBottomButton(entriesEl);

		window.requestAnimationFrame(() => {
			entriesEl.scrollTop = entriesEl.scrollHeight;
			this.updateScrollToBottomButton(entriesEl);
		});
	}

	private smoothScrollToBottom(): void {
		const entriesEl = this.contentEl.querySelector(".ai-draft-bench-entries");

		if (!(entriesEl instanceof HTMLElement)) {
			return;
		}

		entriesEl.scrollTo({
			top: entriesEl.scrollHeight,
			behavior: "smooth",
		});

		this.updateScrollToBottomButton(entriesEl);
	}
}
