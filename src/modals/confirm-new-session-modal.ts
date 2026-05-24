import { App, Modal } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";

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
			text: INTERFACE_TEXT.sessionManager.newSessionTitle,
		});

		contentEl.createEl("p", {
			text: INTERFACE_TEXT.sessionManager.newSessionDescription,
		});

		contentEl.createEl("p", {
			text: INTERFACE_TEXT.sessionManager.savedSessionName,
		});

		const inputEl = contentEl.createEl("input", {
			type: "text",
			value: this.defaultSessionTitle,
		});

		inputEl.maxLength = SESSION_TITLE_MAX_LENGTH;
		inputEl.addClass("ai-writing-buddy-session-title-input");

		const hintEl = contentEl.createEl("p", {
			cls: "ai-writing-buddy-session-title-hint",
		});

		const updateHint = (): void => {
			hintEl.setText(INTERFACE_TEXT.sessionManager.characters(inputEl.value.length, SESSION_TITLE_MAX_LENGTH));
		};

		inputEl.addEventListener("input", updateHint);
		updateHint();

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

		const startButton = buttonRow.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.start,
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
