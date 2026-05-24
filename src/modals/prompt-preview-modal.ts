import { App, Modal, Setting } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";

export class PromptPreviewModal extends Modal {
	constructor(
		app: App,
		private readonly promptPreview: string,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();

		contentEl.createEl("h2", {
			text: INTERFACE_TEXT.selectionPrompt.fullPrompt,
		});

		contentEl.createEl("p", {
			text: INTERFACE_TEXT.selectionPrompt.fullPromptDescription,
		});

		const textAreaEl = contentEl.createEl("textarea", {
			cls: "ai-writing-buddy-prompt-preview-textarea",
		});

		textAreaEl.value = this.promptPreview;
		textAreaEl.readOnly = true;
		textAreaEl.rows = 18;

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText(INTERFACE_TEXT.selectionPrompt.close)
				.setCta()
				.onClick(() => {
					this.close();
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
