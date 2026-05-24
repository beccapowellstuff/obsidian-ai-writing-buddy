import { App, Modal, Setting } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { PromptTemplate } from "../types/prompt-template";

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

		contentEl.createEl("h2", { text: INTERFACE_TEXT.selectionPrompt.askAboutSelection });

		contentEl.createEl("p", {
			text: INTERFACE_TEXT.selectionPrompt.description,
		});

		let instruction = "";
		let selectedTemplateId = "";

		const selectionTemplates = this.templates.filter((template) => template.scope === "selection");

		new Setting(contentEl)
			.setName(INTERFACE_TEXT.selectionPrompt.template)
			.setDesc(INTERFACE_TEXT.selectionPrompt.templateDescription)
			.addDropdown((dropdown) => {
				dropdown.addOption("", INTERFACE_TEXT.selectionPrompt.noTemplate);

				for (const template of selectionTemplates) {
					dropdown.addOption(template.id, template.name);
				}

				dropdown.onChange((value) => {
					selectedTemplateId = value;
				});
			});

		new Setting(contentEl)
			.setName(INTERFACE_TEXT.selectionPrompt.instruction)
			.setDesc(INTERFACE_TEXT.selectionPrompt.instructionDescription)
			.addTextArea((text) => {
				text.setPlaceholder(INTERFACE_TEXT.selectionPrompt.instructionPlaceholder).onChange((value) => {
					instruction = value;
				});

				text.inputEl.rows = 5;
				text.inputEl.cols = 50;
			});

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText(INTERFACE_TEXT.selectionPrompt.ask)
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
