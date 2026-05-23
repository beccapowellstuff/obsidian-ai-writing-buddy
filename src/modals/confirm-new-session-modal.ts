import { App, Modal } from "obsidian";

export class ConfirmNewSessionModal extends Modal {
	constructor(
		app: App,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: "Start new session?",
		});

		contentEl.createEl("p", {
			text: "This starts a blank current session. Session history will be added in a later task.",
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

		const newSessionButton = buttonRow.createEl("button", {
			text: "Start new session",
			cls: "mod-warning",
		});
		newSessionButton.type = "button";
		newSessionButton.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
