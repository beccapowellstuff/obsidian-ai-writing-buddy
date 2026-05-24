import { App, Modal } from "obsidian";

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
			text: "Clear current session?",
		});

		contentEl.createEl("p", {
			text: "This removes the visible entries from the current panel.",
		});

		const buttonRow = contentEl.createEl("div", {
			cls: "ai-writing-buddy-modal-button-row",
		});

		const cancelButton = buttonRow.createEl("button", {
			text: "Cancel",
		});

		cancelButton.type = "button";
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const clearButton = buttonRow.createEl("button", {
			text: "Clear session",
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
