import { App, Modal } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";
import { AiWritingBuddyCurrentSessionData } from "../types/ai-writing-buddy-plugin-data";
import { SavedSessionPreviewModal } from "./saved-session-preview-modal";

type SavedSessionsModalOptions = {
	currentSession: AiWritingBuddyCurrentSessionData | null;
	savedSessions: AiWritingBuddyCurrentSessionData[];
	onOpenSession: (sessionId: string) => void;
	onDeleteSavedSession: (sessionId: string) => AiWritingBuddyCurrentSessionData[];
	onRenameSavedSession: (sessionId: string, title: string) => AiWritingBuddyCurrentSessionData[];
	onRenameCurrentSession: (title: string) => AiWritingBuddyCurrentSessionData;
	onDeleteCurrentSession: () => AiWritingBuddyCurrentSessionData | null;
};

type SessionRowKind = "current" | "saved";

export class SavedSessionsModal extends Modal {
	private currentSession: AiWritingBuddyCurrentSessionData | null;
	private savedSessions: AiWritingBuddyCurrentSessionData[];
	private editingSessionId: string | null = null;
	private deletingSessionId: string | null = null;

	constructor(
		app: App,
		private readonly options: SavedSessionsModalOptions,
	) {
		super(app);
		this.currentSession = options.currentSession;
		this.savedSessions = options.savedSessions;
	}

	onOpen(): void {
		this.renderContent();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: INTERFACE_TEXT.sessionManager.title,
		});

		if (!this.currentSession && this.savedSessions.length === 0) {
			contentEl.createEl("p", {
				text: INTERFACE_TEXT.sessionManager.empty,
			});
			return;
		}

		if (this.currentSession) {
			contentEl.createEl("h3", {
				cls: "ai-writing-buddy-session-manager-section-title",
				text: INTERFACE_TEXT.sessionManager.currentSession,
			});

			const currentListEl = contentEl.createEl("div", {
				cls: "ai-writing-buddy-saved-sessions-list",
			});

			this.renderSessionRow(currentListEl, this.currentSession, "current");
		}

		if (this.savedSessions.length > 0) {
			contentEl.createEl("h3", {
				cls: "ai-writing-buddy-session-manager-section-title",
				text: INTERFACE_TEXT.sessionManager.savedSessions,
			});

			const savedListEl = contentEl.createEl("div", {
				cls: "ai-writing-buddy-saved-sessions-list",
			});

			for (const session of this.savedSessions) {
				this.renderSessionRow(savedListEl, session, "saved");
			}
		}
	}

	private renderSessionRow(container: HTMLElement, session: AiWritingBuddyCurrentSessionData, kind: SessionRowKind): void {
		const rowEl = container.createEl("div", {
			cls: "ai-writing-buddy-saved-session-row",
		});

		if (this.deletingSessionId === session.id) {
			this.renderDeleteConfirmationRow(rowEl, session, kind);
			return;
		}

		if (this.editingSessionId === session.id) {
			this.renderRenameRow(rowEl, session, kind);
			return;
		}

		rowEl.createEl("div", {
			cls: "ai-writing-buddy-saved-session-label",
			text: this.getSessionLabel(session),
		});

		const actionsEl = rowEl.createEl("div", {
			cls: "ai-writing-buddy-saved-session-actions",
		});

		const renameButton = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.rename,
		});

		renameButton.type = "button";
		renameButton.addEventListener("click", () => {
			this.editingSessionId = session.id;
			this.deletingSessionId = null;
			this.renderContent();
		});

		const previewButton = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.preview,
		});

		previewButton.type = "button";
		previewButton.addEventListener("click", () => {
			this.close();

			new SavedSessionPreviewModal(this.app, {
				session,
				sessionLabel: this.getSessionLabel(session),
				onOpenSession: (sessionId) => {
					this.options.onOpenSession(sessionId);
				},
				onDeleteSession: (sessionId) => {
					if (kind === "current") {
						this.currentSession = this.options.onDeleteCurrentSession();
						return;
					}

					this.savedSessions = this.options.onDeleteSavedSession(sessionId);
				},
				onClosePreview: () => {
					new SavedSessionsModal(this.app, {
						...this.options,
						currentSession: this.currentSession,
						savedSessions: this.savedSessions,
					}).open();
				},
			}).open();
		});

		if (kind === "saved") {
			const openButton = actionsEl.createEl("button", {
				text: INTERFACE_TEXT.sessionManager.open,
			});

			openButton.type = "button";
			openButton.addEventListener("click", () => {
				this.options.onOpenSession(session.id);
				this.close();
			});
		}

		const deleteButton = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.delete,
			cls: "mod-warning",
		});

		deleteButton.type = "button";
		deleteButton.addEventListener("click", () => {
			this.deletingSessionId = session.id;
			this.editingSessionId = null;
			this.renderContent();
		});
	}

	private renderRenameRow(rowEl: HTMLElement, session: AiWritingBuddyCurrentSessionData, kind: SessionRowKind): void {
		const inputEl = rowEl.createEl("input", {
			type: "text",
			value: session.userTitle ?? "",
			cls: "ai-writing-buddy-saved-session-rename-input",
		});

		inputEl.maxLength = 25;

		const actionsEl = rowEl.createEl("div", {
			cls: "ai-writing-buddy-saved-session-actions",
		});

		const saveButton = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.save,
			cls: "mod-cta",
		});

		const saveRename = (): void => {
			if (kind === "current") {
				this.currentSession = this.options.onRenameCurrentSession(inputEl.value);
			} else {
				this.savedSessions = this.options.onRenameSavedSession(session.id, inputEl.value);
			}

			this.editingSessionId = null;
			this.renderContent();
		};

		saveButton.type = "button";
		saveButton.addEventListener("click", saveRename);

		const cancelButton = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.cancel,
		});

		cancelButton.type = "button";
		cancelButton.addEventListener("click", () => {
			this.editingSessionId = null;
			this.renderContent();
		});

		inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				saveRename();
			}

			if (event.key === "Escape") {
				event.preventDefault();
				this.editingSessionId = null;
				this.renderContent();
			}
		});

		window.setTimeout(() => {
			inputEl.focus();
			inputEl.select();
		}, 0);
	}

	private renderDeleteConfirmationRow(rowEl: HTMLElement, session: AiWritingBuddyCurrentSessionData, kind: SessionRowKind): void {
		rowEl.createEl("div", {
			cls: "ai-writing-buddy-saved-session-label ai-writing-buddy-session-delete-warning",
			text: kind === "current" ? INTERFACE_TEXT.sessionManager.deleteCurrentQuestion : INTERFACE_TEXT.sessionManager.deleteSavedQuestion,
		});

		const actionsEl = rowEl.createEl("div", {
			cls: "ai-writing-buddy-saved-session-actions",
		});

		const cancelButton = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.cancel,
		});

		cancelButton.type = "button";
		cancelButton.addEventListener("click", () => {
			this.deletingSessionId = null;
			this.renderContent();
		});

		const confirmDeleteButton = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.delete,
			cls: "mod-warning",
		});

		confirmDeleteButton.type = "button";
		confirmDeleteButton.addEventListener("click", () => {
			if (kind === "current") {
				this.currentSession = this.options.onDeleteCurrentSession();
			} else {
				this.savedSessions = this.options.onDeleteSavedSession(session.id);
			}

			this.deletingSessionId = null;
			this.renderContent();
		});
	}

	private getSessionLabel(session: AiWritingBuddyCurrentSessionData): string {
		if (session.userTitle?.trim()) {
			return session.userTitle.trim();
		}

		const updatedAt = new Date(session.updatedAt);

		if (Number.isNaN(updatedAt.getTime())) {
			return INTERFACE_TEXT.sessionManager.sessionLabel(null, session.entryCount);
		}

		return INTERFACE_TEXT.sessionManager.sessionLabel(updatedAt.toLocaleString(), session.entryCount);
	}
}
