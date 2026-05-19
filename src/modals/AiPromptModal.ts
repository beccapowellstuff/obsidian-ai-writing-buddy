import { App, Modal, Setting } from "obsidian";

export class AiPromptModal extends Modal {
	private readonly selectedText: string;
	private readonly onSubmit: (instruction: string, selectedText: string) => void;

	constructor(
		app: App,
		selectedText: string,
		onSubmit: (instruction: string, selectedText: string) => void
	) {
		super(app);
		this.selectedText = selectedText;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Ask AI about selection" });

		contentEl.createEl("p", {
			text: "Enter what you want the AI to do with the selected text.",
		});

		let instruction = "";

		new Setting(contentEl)
			.setName("Instruction")
			.setDesc("For example: fix grammar, make this clearer, summarise this, critique this.")
			.addTextArea((text) => {
				text
					.setPlaceholder("What should the AI do?")
					.onChange((value) => {
						instruction = value;
					});

				text.inputEl.rows = 5;
				text.inputEl.cols = 50;
			});

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText("Ask")
				.setCta()
				.onClick(() => {
					const trimmedInstruction = instruction.trim();

					if (!trimmedInstruction) {
						return;
					}

					this.close();
					this.onSubmit(trimmedInstruction, this.selectedText);
				});
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}