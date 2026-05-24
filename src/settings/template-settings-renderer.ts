import { Notice, Setting } from "obsidian";
import type AiWritingBuddyPlugin from "../main";
import { PromptTemplate } from "../types/prompt-template";

export class TemplateSettingsRenderer {
	constructor(private readonly plugin: AiWritingBuddyPlugin) {}

	render(containerEl: HTMLElement, refresh: () => void): void {
		new Setting(containerEl).setName("Templates").setHeading();

		const builtInTemplates = this.plugin.settings.promptTemplates.filter((template) => template.isBuiltIn);
		const userTemplates = this.plugin.settings.promptTemplates.filter((template) => !template.isBuiltIn);

		new Setting(containerEl).setName("User templates").setDesc(userTemplates.length === 0 ? "No user templates yet." : `${userTemplates.length} user templates saved.`);

		new Setting(containerEl)
			.setName("Create template")
			.setDesc("Add a custom selected-text template.")
			.addButton((button) => {
				button
					.setButtonText("Add template")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.promptTemplates.push(this.createBlankUserTemplate());
						await this.plugin.saveSettings();

						new Notice("Template added.");
						refresh();
					});
			});

		new Setting(containerEl).setName("Built-in templates").setHeading();

		for (const template of builtInTemplates) {
			new Setting(containerEl)
				.setName(template.name)
				.setDesc(template.description)
				.addButton((button) => {
					button.setButtonText("Copy to my templates").onClick(async () => {
						this.plugin.settings.promptTemplates.push(this.copyBuiltInTemplate(template));
						await this.plugin.saveSettings();

						new Notice("Template copied.");
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
			.setName("Name")
			.setDesc("Shown in the template selector.")
			.addText((text) => {
				text.setValue(template.name).onChange(async (value) => {
					template.name = value.trim() || "Untitled template";
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Description")
			.setDesc("Short explanation of what this template does.")
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
			.setName("Template prompt")
			.setDesc("Instruction sent to the AI when this template is selected.")
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
			.setName("Replacement text only")
			.setDesc("Use when the response should be safe to replace the selected text.")
			.addToggle((toggle) => {
				toggle.setValue(template.returnsReplacementTextOnly).onChange(async (value) => {
					template.returnsReplacementTextOnly = value;
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Highlight changes")
			.setDesc("Highlight changed words in the response. Best for spelling and grammar templates.")
			.addToggle((toggle) => {
				toggle.setValue(template.highlightChanges).onChange(async (value) => {
					template.highlightChanges = value;
					template.updatedAt = new Date().toISOString();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc("Lower is stricter. Higher is more creative.")
			.addText((text) => {
				text.setPlaceholder("0.7")
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
			.setName("Delete template")
			.setDesc("Remove this user-created template.")
			.addButton((button) => {
				button
					.setButtonText("Delete")
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.promptTemplates = this.plugin.settings.promptTemplates.filter((existingTemplate) => existingTemplate.id !== template.id);

						await this.plugin.saveSettings();

						new Notice("Template deleted.");
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
