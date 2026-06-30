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
import { RagService } from "../services/rag-service";
import type { RagIndexStore } from "../services/rag-index-store";
import { AiMemoryService } from "../services/ai-memory-service";
import { SelectionEditService } from "../services/selection-edit-service";
import { AiVisibleMemoryUpdateService } from "../services/visible-memory-update-service";
import type { AiWritingBuddyChatNoteContext, AiWritingBuddyContextScope } from "../types/ai-writing-buddy-context";
import { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import { AiWritingBuddyCurrentSessionData, AiWritingBuddyMemorySummary, AiWritingBuddySessionListItem } from "../types/ai-writing-buddy-plugin-data";
import { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { AiWritingBuddySessionController } from "../controllers/session-controller";
import { SavedSessionsModal } from "../modals/saved-sessions-modal";
import type { AiWritingBuddyVisibleMemoryContext } from "../types/ai-writing-buddy-visible-memory";
import type { ErrorDebugLogOperation } from "../types/error-debug-log";

export const AI_WRITING_BUDDY_VIEW_TYPE = "ai-writing-buddy-view";

type SessionSaveHandler = (entries: AiWritingBuddyEntry[], memorySummary?: AiWritingBuddyMemorySummary) => void;
type NewSessionHandler = (sessionTitle?: string) => Promise<void>;
type SessionListProvider = () => AiWritingBuddySessionListItem[];
type RestoreSessionHandler = (sessionId: string) => Promise<AiWritingBuddyCurrentSessionData | null>;
type DeleteSavedSessionHandler = (sessionId: string) => Promise<AiWritingBuddySessionListItem[]>;
type SavedSessionProvider = (sessionId: string) => Promise<AiWritingBuddyCurrentSessionData | null>;
type CurrentSessionTitleProvider = () => string | undefined;
type RenameSavedSessionHandler = (sessionId: string, title: string) => Promise<AiWritingBuddySessionListItem[]>;
type CurrentSessionProvider = () => AiWritingBuddyCurrentSessionData | null;
type RenameCurrentSessionHandler = (title: string) => AiWritingBuddyCurrentSessionData;
type DeleteCurrentSessionHandler = () => Promise<AiWritingBuddyCurrentSessionData>;
type SettingsSaveHandler = () => Promise<void>;
type ProviderErrorLogHandler = (error: unknown, operation: ErrorDebugLogOperation) => void;

export class AiWritingBuddyView extends ItemView {
	private readonly sessionController: AiWritingBuddySessionController;
	private readonly clipboardService: ClipboardService;
	private readonly selectionEditService: SelectionEditService;
	private readonly ragService: RagService;
	private readonly aiMemoryService: AiMemoryService;
	private readonly visibleMemoryUpdateService: AiVisibleMemoryUpdateService;
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
		private readonly onGetSavedSession: SavedSessionProvider,
		private readonly onRenameSavedSession: RenameSavedSessionHandler,
		private readonly getCurrentSessionTitle: CurrentSessionTitleProvider,
		private readonly onGetCurrentSession: CurrentSessionProvider,
		private readonly onRenameCurrentSession: RenameCurrentSessionHandler,
		private readonly onDeleteCurrentSession: DeleteCurrentSessionHandler,
		private readonly onSaveSettings: SettingsSaveHandler,
		ragIndexStore: RagIndexStore,
		private readonly onProviderError?: ProviderErrorLogHandler,
	) {
		super(leaf);

		this.clipboardService = new ClipboardService();
		this.selectionEditService = new SelectionEditService(this.app);
		this.ragService = new RagService(this.app, this.settings, ragIndexStore);
		this.aiMemoryService = new AiMemoryService(this.app);
		this.visibleMemoryUpdateService = new AiVisibleMemoryUpdateService(this.aiMemoryService, this.getAiResponseService, this.settings, this.onSaveSettings);

		this.sessionController = new AiWritingBuddySessionController(
			this.getAiResponseService,
			(scrollToBottom) => {
				if (scrollToBottom) {
					this.restoreComposerFocusAfterNextRenderIfNeeded();
					this.render();
					this.scrollToBottom();
					return;
				}

				this.renderPreservingScroll();
			},

			onSaveSession,
			onNewSession,
			(message) => this.getChatNoteContext(message),
			() => this.getChatVisibleMemory(),
			(entry, assistantResponseText) => {
				void this.visibleMemoryUpdateService.updateAfterChatResponse({
					entry,
					assistantResponseText,
				});
			},
			this.settings,
			initialEntries,
			initialMemorySummary,
			this.onProviderError,
		);

		this.entryRenderer = new AiWritingBuddyEntryRenderer(
			this.app,
			this.clipboardService,
			this.selectionEditService,
			(entryId) => {
				this.sessionController.setReplyToEntry(entryId);
				this.chatComposerRenderer.requestFocusOnNextRender();
				this.render();
			},
			(entryId, change) => {
				this.sessionController.rejectResponseChange(entryId, change);
			},
			(entryId) => {
				this.sessionController.cancelResponse(entryId);
			},
		);

		this.chatComposerRenderer = new AiWritingBuddyChatComposerRenderer(
			(message) => {
				void this.sessionController.addChatEntry(message);
			},
			() => {
				this.sessionController.clearReplyToEntry();
			},
			() => this.settings.promptTemplates,
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
		this.restoreComposerFocusAfterNextRenderIfNeeded();

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
				void this.restoreSession(sessionId);
			},
			onManageSavedSessions: () => {
				this.manageSavedSessions();
			},
			contextEnabled: this.settings.contextOptions.enabled,
			contextScope: this.settings.contextOptions.scope,
			contextIncludeIndexedRag: this.settings.contextOptions.includeIndexedRag,
			onContextEnabledChange: (enabled) => {
				void this.setContextEnabled(enabled);
			},
			onContextScopeChange: (scope) => {
				void this.setContextScope(scope);
			},
			onContextIncludeIndexedRagChange: (enabled) => {
				void this.setContextIncludeIndexedRag(enabled);
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
			void this.sessionController.startNewSession();
			return;
		}

		new ConfirmNewSessionModal(this.app, this.getDefaultSessionTitle(), (sessionTitle) => {
			void this.sessionController.startNewSession(sessionTitle);
		}).open();
	}

	private getDefaultSessionTitle(): string {
		const currentSessionTitle = this.getCurrentSessionTitle();

		if (currentSessionTitle?.trim()) {
			return currentSessionTitle.trim();
		}

		return new Date().toLocaleString();
	}

	private async restoreSession(sessionId: string): Promise<void> {
		const restoredSession = await this.onRestoreSession(sessionId);

		if (!restoredSession) {
			return;
		}

		this.sessionController.replaceCurrentSessionEntries(restoredSession.entries, restoredSession.memorySummary);
	}

	private manageSavedSessions(): void {
		new SavedSessionsModal(this.app, {
			currentSession: this.onGetCurrentSession(),
			savedSessions: this.getSessionListItems(),
			onOpenSession: async (sessionId) => {
				await this.restoreSession(sessionId);
				this.render();
			},
			onDeleteSavedSession: async (sessionId) => {
				await this.onDeleteSavedSession(sessionId);
				this.render();

				return this.getSessionListItems();
			},
			onLoadSavedSession: (sessionId) => this.onGetSavedSession(sessionId),
			onRenameSavedSession: async (sessionId, title) => {
				const savedSessions = await this.onRenameSavedSession(sessionId, title);
				this.render();

				return savedSessions;
			},
			onRenameCurrentSession: (title) => {
				const currentSession = this.onRenameCurrentSession(title);
				this.render();

				return currentSession;
			},
			onDeleteCurrentSession: async () => {
				const newSession = await this.onDeleteCurrentSession();

				this.sessionController.replaceCurrentSessionEntries(newSession.entries, newSession.memorySummary);
				this.render();

				return newSession;
			},
		}).open();
	}

	private async setContextEnabled(enabled: boolean): Promise<void> {
		this.settings.contextOptions = {
			...this.settings.contextOptions,
			enabled,
		};

		await this.onSaveSettings();
		this.renderPreservingScroll();
	}

	private async setContextScope(scope: AiWritingBuddyContextScope): Promise<void> {
		this.settings.contextOptions = {
			...this.settings.contextOptions,
			scope,
		};

		await this.onSaveSettings();
		this.renderPreservingScroll();
	}

	private async setContextIncludeIndexedRag(includeIndexedRag: boolean): Promise<void> {
		this.settings.contextOptions = {
			...this.settings.contextOptions,
			includeIndexedRag,
		};

		await this.onSaveSettings();
		this.renderPreservingScroll();
	}

	private async getChatNoteContext(message: string): Promise<AiWritingBuddyChatNoteContext | undefined> {
		if (!this.settings.contextOptions.enabled) {
			return undefined;
		}

		try {
			return await this.ragService.getContext(this.settings.contextOptions.scope, message, this.settings.contextOptions.includeIndexedRag);
		} catch (error) {
			console.error("AI Writing Buddy RAG context failed", error);
			return undefined;
		}
	}

	private async getChatVisibleMemory(): Promise<AiWritingBuddyVisibleMemoryContext | undefined> {
		if (!this.settings.aiMemoryEnabled) {
			return undefined;
		}

		try {
			return await this.aiMemoryService.readMemoryNote(this.settings);
		} catch (error) {
			console.warn("AI Writing Buddy visible memory read failed", error);
			return undefined;
		}
	}

	private restoreComposerFocusAfterNextRenderIfNeeded(): void {
		if (this.chatComposerRenderer.isInputFocused(this.contentEl)) {
			this.chatComposerRenderer.requestFocusOnNextRender();
		}
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
