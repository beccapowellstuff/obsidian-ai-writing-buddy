import { App, Modal, Setting } from "obsidian";

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
			text: "Full prompt",
		});

		contentEl.createEl("p", {
			text: "This is the prompt content sent for this selected-text request. You can select and copy any part of it.",
		});

		const textAreaEl = contentEl.createEl("textarea", {
			cls: "ai-writing-buddy-prompt-preview-textarea",
		});

		textAreaEl.value = this.promptPreview;
		textAreaEl.readOnly = true;
		textAreaEl.rows = 18;

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText("Close")
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
