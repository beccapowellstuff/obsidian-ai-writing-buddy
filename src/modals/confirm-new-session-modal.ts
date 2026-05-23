import { App, Modal } from "obsidian";

const SESSION_TITLE_MAX_LENGTH = 25;

export class ConfirmNewSessionModal extends Modal {
	constructor(
		app: App,
		private readonly defaultSessionTitle: string,
		private readonly onConfirm: (sessionTitle: string) => void,
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
			text: "This will save the session you are currently working in, then open a blank new session.",
		});

		contentEl.createEl("p", {
			text: "Saved session name:",
		});

		const inputEl = contentEl.createEl("input", {
			type: "text",
			value: this.defaultSessionTitle,
		});

		inputEl.maxLength = SESSION_TITLE_MAX_LENGTH;
		inputEl.addClass("ai-draft-bench-session-title-input");

		const hintEl = contentEl.createEl("p", {
			cls: "ai-draft-bench-session-title-hint",
		});

		const updateHint = (): void => {
			hintEl.setText(`${inputEl.value.length}/${SESSION_TITLE_MAX_LENGTH} characters`);
		};

		inputEl.addEventListener("input", updateHint);
		updateHint();

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

		const startButton = buttonRow.createEl("button", {
			text: "Start",
			cls: "mod-cta",
		});

		startButton.type = "button";
		startButton.addEventListener("click", () => {
			this.onConfirm(inputEl.value.trim());
			this.close();
		});

		window.setTimeout(() => {
			inputEl.focus();
			inputEl.select();
		}, 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
