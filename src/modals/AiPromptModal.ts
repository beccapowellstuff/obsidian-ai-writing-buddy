import { App, Modal, Setting } from "obsidian";
import { PromptTemplate } from "../types/PromptTemplate";

export type AiPromptModalSubmitValue = {
	instruction: string;
	selectedText: string;
	template?: PromptTemplate;
};

export class AiPromptModal extends Modal {
	private readonly selectedText: string;
	private readonly templates: PromptTemplate[];
	private readonly onSubmit: (value: AiPromptModalSubmitValue) => void;

	constructor(app: App, selectedText: string, templates: PromptTemplate[], onSubmit: (value: AiPromptModalSubmitValue) => void) {
		super(app);
		this.selectedText = selectedText;
		this.templates = templates;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Ask AI about selection" });

		contentEl.createEl("p", {
			text: "Choose a template or enter your own instruction for the selected text.",
		});

		let instruction = "";
		let selectedTemplateId = "";

		const selectionTemplates = this.templates.filter((template) => template.scope === "selection");

		new Setting(contentEl)
			.setName("Template")
			.setDesc("Optional starting point for the request.")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "No template");

				for (const template of selectionTemplates) {
					dropdown.addOption(template.id, template.name);
				}

				dropdown.onChange((value) => {
					selectedTemplateId = value;
				});
			});

		new Setting(contentEl)
			.setName("Instruction")
			.setDesc("Add extra direction, or write your own instruction without a template.")
			.addTextArea((text) => {
				text.setPlaceholder("What should the AI do?").onChange((value) => {
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
					const selectedTemplate = selectionTemplates.find((template) => template.id === selectedTemplateId);
					const trimmedInstruction = instruction.trim();

					if (!selectedTemplate && !trimmedInstruction) {
						return;
					}

					this.close();

					this.onSubmit({
						instruction: trimmedInstruction,
						selectedText: this.selectedText,
						template: selectedTemplate,
					});
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
