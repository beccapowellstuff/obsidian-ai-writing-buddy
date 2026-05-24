import { App, Modal } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";
import { AiWritingBuddyCurrentSessionData } from "../types/ai-writing-buddy-plugin-data";
import { ConfirmDeleteSavedSessionModal } from "./confirm-delete-saved-session-modal";

type SavedSessionPreviewModalOptions = {
	session: AiWritingBuddyCurrentSessionData;
	sessionLabel: string;
	onOpenSession: (sessionId: string) => void;
	onDeleteSession: (sessionId: string) => void;
	onClosePreview: () => void;
};

export class SavedSessionPreviewModal extends Modal {
	private shouldReturnToSessionManager = true;

	constructor(
		app: App,
		private readonly options: SavedSessionPreviewModalOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: INTERFACE_TEXT.sessionManager.previewTitle,
		});

		contentEl.createEl("p", {
			cls: "ai-writing-buddy-saved-session-preview-meta",
			text: this.options.sessionLabel,
		});

		const entriesEl = contentEl.createEl("div", {
			cls: "ai-writing-buddy-saved-session-preview-entries",
		});

		for (const entry of this.options.session.entries) {
			const entryEl = entriesEl.createEl("div", {
				cls: "ai-writing-buddy-saved-session-preview-entry",
			});

			if (entry.type === "chat") {
				entryEl.createEl("h3", {
					text: INTERFACE_TEXT.entries.chat,
				});

				entryEl.createEl("p", {
					text: entry.message,
				});
			} else {
				entryEl.createEl("h3", {
					text: INTERFACE_TEXT.entries.selectedText,
				});

				entryEl.createEl("p", {
					text: entry.request.selectedText,
				});

				if (entry.request.templateName) {
					entryEl.createEl("p", {
						cls: "ai-writing-buddy-saved-session-preview-template",
						text: INTERFACE_TEXT.entries.template(entry.request.templateName),
					});
				}
			}

			entryEl.createEl("h3", {
				text: INTERFACE_TEXT.entries.response,
			});

			entryEl.createEl("p", {
				text: entry.response.text,
			});
		}

		const buttonRow = contentEl.createEl("div", {
			cls: "ai-writing-buddy-modal-button-row",
		});

		const closeButton = buttonRow.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.close,
		});

		closeButton.type = "button";
		closeButton.addEventListener("click", () => {
			this.close();
		});

		const openButton = buttonRow.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.openSession,
			cls: "mod-cta",
		});

		openButton.type = "button";
		openButton.addEventListener("click", () => {
			this.shouldReturnToSessionManager = false;
			this.options.onOpenSession(this.options.session.id);
			this.close();
		});

		const deleteButton = buttonRow.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.deleteSavedSession,
			cls: "mod-warning",
		});

		deleteButton.type = "button";
		deleteButton.addEventListener("click", () => {
			new ConfirmDeleteSavedSessionModal(this.app, this.options.sessionLabel, () => {
				this.options.onDeleteSession(this.options.session.id);
				this.close();
			}).open();
		});
	}

	onClose(): void {
		this.contentEl.empty();

		if (this.shouldReturnToSessionManager) {
			this.options.onClosePreview();
		}
	}
}
