import { App, Modal } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";

export class ConfirmClearSessionModal extends Modal {
	private onConfirm: () => void;

	constructor(app: App, onConfirm: () => void) {
		super(app);
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: INTERFACE_TEXT.sessionManager.clearTitle,
		});

		contentEl.createEl("p", {
			text: INTERFACE_TEXT.sessionManager.clearDescription,
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

		const clearButton = buttonRow.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.clearSession,
			cls: "mod-warning",
		});

		clearButton.type = "button";
		clearButton.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
