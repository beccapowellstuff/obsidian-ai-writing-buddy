import { App, Modal } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";

export class ConfirmDeleteSavedSessionModal extends Modal {
	constructor(
		app: App,
		private readonly sessionLabel: string,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: INTERFACE_TEXT.sessionManager.deleteTitle,
		});

		contentEl.createEl("p", {
			text: INTERFACE_TEXT.sessionManager.deleteDescription(this.sessionLabel),
		});

		const buttonRow = contentEl.createEl("div", {
			cls: "ai-writing-buddy-modal-button-row",
		});

		const cancelButton = buttonRow.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.cancel,
		});

		cancelButton.type = "button";
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const deleteButton = buttonRow.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.deleteSavedSession,
			cls: "mod-warning",
		});

		deleteButton.type = "button";
		deleteButton.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
