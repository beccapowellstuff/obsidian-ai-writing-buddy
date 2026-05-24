import { Notice, Setting } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";
import type AiWritingBuddyPlugin from "../main";
import { PromptTemplate } from "../types/prompt-template";

export class TemplateSettingsRenderer {
	constructor(private readonly plugin: AiWritingBuddyPlugin) {}

	render(containerEl: HTMLElement, refresh: () => void): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.templates.heading).setHeading();

		const builtInTemplates = this.plugin.settings.promptTemplates.filter((template) => template.isBuiltIn);
		const userTemplates = this.plugin.settings.promptTemplates.filter((template) => !template.isBuiltIn);

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.userTemplates)
			.setDesc(userTemplates.length === 0 ? INTERFACE_TEXT.settings.templates.noUserTemplates : INTERFACE_TEXT.settings.templates.userTemplatesSaved(userTemplates.length));

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.createTemplate)
			.setDesc(INTERFACE_TEXT.settings.templates.createTemplateDescription)
			.addButton((button) => {
				button
					.setButtonText(INTERFACE_TEXT.settings.templates.addTemplate)
					.setCta()
					.onClick(async () => {
						this.plugin.settings.promptTemplates.push(this.createBlankUserTemplate());
						await this.plugin.saveSettings();

						new Notice(INTERFACE_TEXT.notices.templateAdded);
						refresh();
					});
			});

		new Setting(containerEl).setName(INTERFACE_TEXT.settings.templates.builtInTemplates).setHeading();

		for (const template of builtInTemplates) {
			new Setting(containerEl)
				.setName(template.name)
				.setDesc(template.description)
				.addButton((button) => {
					button.setButtonText(INTERFACE_TEXT.settings.templates.copyToMyTemplates).onClick(async () => {
						this.plugin.settings.promptTemplates.push(this.copyBuiltInTemplate(template));
						await this.plugin.saveSettings();

						new Notice(INTERFACE_TEXT.notices.templateCopied);
						refresh();
					});
				});
		}

		for (const template of userTemplates) {
			new Setting(containerEl).setName(template.name).setHeading();

			this.renderUserTemplateFields(containerEl, template, refresh);
		}
	}

	private renderUserTemplateFields(containerEl: HTMLElement, template: PromptTemplate, refresh: () => void): void {
		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.name)
			.setDesc(INTERFACE_TEXT.settings.templates.nameDescription)
			.addText((text) => {
				text.setValue(template.name).onChange(async (value) => {
					template.name = value.trim() || "Untitled template";
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.description)
			.setDesc(INTERFACE_TEXT.settings.templates.descriptionDescription)
			.addTextArea((text) => {
				text.setValue(template.description).onChange(async (value) => {
					template.description = value;
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});

				text.inputEl.rows = 2;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.templatePrompt)
			.setDesc(INTERFACE_TEXT.settings.templates.templatePromptDescription)
			.addTextArea((text) => {
				text.setValue(template.prompt).onChange(async (value) => {
					template.prompt = value;
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});

				text.inputEl.rows = 6;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.replacementTextOnly)
			.setDesc(INTERFACE_TEXT.settings.templates.replacementTextOnlyDescription)
			.addToggle((toggle) => {
				toggle.setValue(template.returnsReplacementTextOnly).onChange(async (value) => {
					template.returnsReplacementTextOnly = value;
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.highlightChanges)
			.setDesc(INTERFACE_TEXT.settings.templates.highlightChangesDescription)
			.addToggle((toggle) => {
				toggle.setValue(template.highlightChanges).onChange(async (value) => {
					template.highlightChanges = value;
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.temperature)
			.setDesc(INTERFACE_TEXT.settings.templates.temperatureDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.templates.temperaturePlaceholder)
					.setValue(String(template.temperature ?? 0.7))
					.onChange(async (value) => {
						const parsedValue = Number.parseFloat(value);

						if (Number.isNaN(parsedValue)) {
							return;
						}

						template.temperature = Math.min(2, Math.max(0, parsedValue));
						template.updatedAt = new Date().toISOString();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.deleteTemplate)
			.setDesc(INTERFACE_TEXT.settings.templates.deleteTemplateDescription)
			.addButton((button) => {
				button
					.setButtonText(INTERFACE_TEXT.settings.templates.delete)
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.promptTemplates = this.plugin.settings.promptTemplates.filter((existingTemplate) => existingTemplate.id !== template.id);

						await this.plugin.saveSettings();

						new Notice(INTERFACE_TEXT.notices.templateDeleted);
						refresh();
					});
			});
	}

	private createBlankUserTemplate(): PromptTemplate {
		const createdAt = new Date().toISOString();

		return {
			id: crypto.randomUUID(),
			name: "New template",
			description: "User-created template.",
			scope: "selection",
			prompt: "Write your template prompt here.",
			returnsReplacementTextOnly: false,
			highlightChanges: false,
			temperature: 0.7,
			isBuiltIn: false,
			createdAt,
			updatedAt: createdAt,
		};
	}

	private copyBuiltInTemplate(template: PromptTemplate): PromptTemplate {
		const createdAt = new Date().toISOString();

		return {
			...template,
			id: crypto.randomUUID(),
			name: `${template.name} copy`,
			isBuiltIn: false,
			createdAt,
			updatedAt: createdAt,
		};
	}
}
