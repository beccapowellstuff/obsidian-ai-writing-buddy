import { ItemView, setIcon, setTooltip, WorkspaceLeaf } from "obsidian";
import { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { PLUGIN_DISPLAY } from "../config/plugin-display";
import { ConfirmClearSessionModal } from "../modals/confirm-clear-session-modal";
import { ConfirmNewSessionModal } from "../modals/confirm-new-session-modal";
import { AiWritingBuddyChatComposerRenderer } from "../renderers/chat-composer-renderer";
import { AiWritingBuddyEntryRenderer } from "../renderers/entry-renderer";
import { AiWritingBuddyHeaderRenderer } from "../renderers/header-renderer";
import type { AiResponseService } from "../services/ai-response-service";
import { ClipboardService } from "../services/clipboard-service";
import { SelectionEditService } from "../services/selection-edit-service";
import { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import { AiWritingBuddyCurrentSessionData, AiWritingBuddyMemorySummary, AiWritingBuddySessionListItem } from "../types/ai-writing-buddy-plugin-data";
import { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { AiWritingBuddySessionController } from "../controllers/session-controller";
import { SavedSessionsModal } from "../modals/saved-sessions-modal";

export const AI_WRITING_BUDDY_VIEW_TYPE = "ai-writing-buddy-view";

type SessionSaveHandler = (entries: AiWritingBuddyEntry[], memorySummary?: AiWritingBuddyMemorySummary) => void;
type NewSessionHandler = (sessionTitle?: string) => void;
type SessionListProvider = () => AiWritingBuddySessionListItem[];
type RestoreSessionHandler = (sessionId: string) => AiWritingBuddyCurrentSessionData | null;
type DeleteSavedSessionHandler = (sessionId: string) => AiWritingBuddySessionListItem[];
type SavedSessionsProvider = () => AiWritingBuddyCurrentSessionData[];
type CurrentSessionTitleProvider = () => string | undefined;
type RenameSavedSessionHandler = (sessionId: string, title: string) => AiWritingBuddyCurrentSessionData[];
type CurrentSessionProvider = () => AiWritingBuddyCurrentSessionData | null;
type RenameCurrentSessionHandler = (title: string) => AiWritingBuddyCurrentSessionData;
type DeleteCurrentSessionHandler = () => AiWritingBuddyCurrentSessionData;

export class AiWritingBuddyView extends ItemView {
	private readonly sessionController: AiWritingBuddySessionController;
	private readonly clipboardService: ClipboardService;
	private readonly selectionEditService: SelectionEditService;
	private readonly entryRenderer: AiWritingBuddyEntryRenderer;
	private readonly headerRenderer = new AiWritingBuddyHeaderRenderer();
	private readonly chatComposerRenderer: AiWritingBuddyChatComposerRenderer;
	private scrollButtonEl: HTMLButtonElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly getAiResponseService: () => AiResponseService,
		private readonly settings: AiWritingBuddySettings,
		initialEntries: AiWritingBuddyEntry[],
		initialMemorySummary: AiWritingBuddyMemorySummary | undefined,
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

		this.sessionController = new AiWritingBuddySessionController(
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

		this.entryRenderer = new AiWritingBuddyEntryRenderer(this.app, this.clipboardService, this.selectionEditService, (entryId) => {
			this.sessionController.setReplyToEntry(entryId);
			this.chatComposerRenderer.requestFocusOnNextRender();
			this.render();
		});

		this.chatComposerRenderer = new AiWritingBuddyChatComposerRenderer(
			(message) => {
				void this.sessionController.addChatEntry(message);
			},
			() => {
				this.sessionController.clearReplyToEntry();
			},
		);
	}

	getViewType(): string {
		return AI_WRITING_BUDDY_VIEW_TYPE;
	}

	getDisplayText(): string {
		return INTERFACE_TEXT.app.name;
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

	setRequest(request: AiWritingBuddyRequest): void {
		void this.sessionController.addSelectionEntry(request);
	}

	private renderPreservingScroll(): void {
		const entriesEl = this.contentEl.querySelector(".ai-writing-buddy-entries");
		const previousScrollTop = entriesEl instanceof HTMLElement ? entriesEl.scrollTop : null;

		this.render();

		if (previousScrollTop === null) {
			return;
		}

		window.setTimeout(() => {
			const newEntriesEl = this.contentEl.querySelector(".ai-writing-buddy-entries");

			if (!(newEntriesEl instanceof HTMLElement)) {
				return;
			}

			newEntriesEl.scrollTop = previousScrollTop;
		}, 0);
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("ai-writing-buddy-view");

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
			cls: "ai-writing-buddy-entries",
		});

		const entries = this.sessionController.getEntries();

		if (entries.length === 0) {
			entriesEl.createEl("p", {
				cls: "ai-writing-buddy-empty",
				text: INTERFACE_TEXT.entries.empty,
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
				this.render();
			},
			onDeleteSavedSession: (sessionId) => {
				this.onDeleteSavedSession(sessionId);
				this.render();

				return this.onGetSavedSessions();
			},
			onRenameSavedSession: (sessionId, title) => {
				const savedSessions = this.onRenameSavedSession(sessionId, title);
				this.render();

				return savedSessions;
			},
			onRenameCurrentSession: (title) => {
				const currentSession = this.onRenameCurrentSession(title);
				this.render();

				return currentSession;
			},
			onDeleteCurrentSession: () => {
				const newSession = this.onDeleteCurrentSession();
				this.sessionController.replaceCurrentSessionEntries(newSession.entries, newSession.memorySummary);
				this.render();

				return newSession.entryCount > 0 || newSession.entries.length > 0 ? newSession : null;
			},
		}).open();
	}

	private renderScrollToBottomButton(container: HTMLElement, entriesEl: HTMLElement): void {
		const scrollButtonEl = container.createEl("button", {
			cls: "ai-writing-buddy-scroll-bottom-button",
			attr: {
				"aria-label": INTERFACE_TEXT.entries.scrollToLatestResponse,
			},
		});

		setIcon(scrollButtonEl, "arrow-down");
		setTooltip(scrollButtonEl, INTERFACE_TEXT.entries.scrollToLatestResponse);

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
		const entriesEl = this.contentEl.querySelector(".ai-writing-buddy-entries");

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
		const entriesEl = this.contentEl.querySelector(".ai-writing-buddy-entries");

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
