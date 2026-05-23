import { App, Modal } from "obsidian";
import { AiDraftBenchCurrentSessionData } from "../types/ai-writing-buddy-plugin-data";
import { ConfirmDeleteSavedSessionModal } from "./confirm-delete-saved-session-modal";
import { SavedSessionPreviewModal } from "./saved-session-preview-modal";

type SavedSessionsModalOptions = {
	sessions: AiDraftBenchCurrentSessionData[];
	onOpenSession: (sessionId: string) => void;
	onDeleteSession: (sessionId: string) => AiDraftBenchCurrentSessionData[];
	onRenameSession: (sessionId: string, title: string) => AiDraftBenchCurrentSessionData[];
};

export class SavedSessionsModal extends Modal {
	private sessions: AiDraftBenchCurrentSessionData[];
	private editingSessionId: string | null = null;

	constructor(
		app: App,
		private readonly options: SavedSessionsModalOptions,
	) {
		super(app);
		this.sessions = options.sessions;
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
			text: "Saved sessions",
		});

		if (this.sessions.length === 0) {
			contentEl.createEl("p", {
				text: "There are no saved sessions yet.",
			});
			return;
		}

		const listEl = contentEl.createEl("div", {
			cls: "ai-draft-bench-saved-sessions-list",
		});

		for (const session of this.sessions) {
			const rowEl = listEl.createEl("div", {
				cls: "ai-draft-bench-saved-session-row",
			});

			if (this.editingSessionId === session.id) {
				const inputEl = rowEl.createEl("input", {
					type: "text",
					value: session.userTitle ?? "",
					cls: "ai-draft-bench-saved-session-rename-input",
				});

				inputEl.maxLength = 25;

				const actionsEl = rowEl.createEl("div", {
					cls: "ai-draft-bench-saved-session-actions",
				});

				const saveButton = actionsEl.createEl("button", {
					text: "Save",
					cls: "mod-cta",
				});

				saveButton.type = "button";
				saveButton.addEventListener("click", () => {
					this.sessions = this.options.onRenameSession(session.id, inputEl.value);
					this.editingSessionId = null;
					this.renderContent();
				});

				const cancelButton = actionsEl.createEl("button", {
					text: "Cancel",
				});

				cancelButton.type = "button";
				cancelButton.addEventListener("click", () => {
					this.editingSessionId = null;
					this.renderContent();
				});

				inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						this.sessions = this.options.onRenameSession(session.id, inputEl.value);
						this.editingSessionId = null;
						this.renderContent();
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

				continue;
			}

			rowEl.createEl("div", {
				cls: "ai-draft-bench-saved-session-label",
				text: this.getSessionLabel(session),
			});

			const actionsEl = rowEl.createEl("div", {
				cls: "ai-draft-bench-saved-session-actions",
			});

			const renameButton = actionsEl.createEl("button", {
				text: "Rename",
			});

			renameButton.type = "button";
			renameButton.addEventListener("click", () => {
				this.editingSessionId = session.id;
				this.renderContent();
			});

			const previewButton = actionsEl.createEl("button", {
				text: "Preview",
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
						this.sessions = this.options.onDeleteSession(sessionId);
					},
					onClosePreview: () => {
						new SavedSessionsModal(this.app, {
							...this.options,
							sessions: this.sessions,
						}).open();
					},
				}).open();
			});

			const openButton = actionsEl.createEl("button", {
				text: "Open",
			});

			openButton.type = "button";
			openButton.addEventListener("click", () => {
				this.options.onOpenSession(session.id);
				this.close();
			});

			const deleteButton = actionsEl.createEl("button", {
				text: "Delete",
				cls: "mod-warning",
			});

			deleteButton.type = "button";
			deleteButton.addEventListener("click", () => {
				new ConfirmDeleteSavedSessionModal(this.app, this.getSessionLabel(session), () => {
					this.sessions = this.options.onDeleteSession(session.id);
					this.renderContent();
				}).open();
			});
		}
	}

	private getSessionLabel(session: AiDraftBenchCurrentSessionData): string {
		if (session.userTitle?.trim()) {
			return session.userTitle.trim();
		}

		const updatedAt = new Date(session.updatedAt);

		if (Number.isNaN(updatedAt.getTime())) {
			return `${session.entryCount} entries`;
		}

		return `${updatedAt.toLocaleString()} · ${session.entryCount} entries`;
	}
}
