import { App, Modal } from "obsidian";

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
			text: "Delete saved session?",
		});

		contentEl.createEl("p", {
			text: `This will permanently delete "${this.sessionLabel}" from your saved sessions. Your current session will not be changed.`,
		});

		const buttonRow = contentEl.createEl("div", {
			cls: "ai-draft-bench-modal-button-row",
		});

		const cancelButton = buttonRow.createEl("button", {
			text: "Cancel",
		});

		cancelButton.type = "button";
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const deleteButton = buttonRow.createEl("button", {
			text: "Delete saved session",
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
