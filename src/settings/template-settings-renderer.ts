import { Notice, Setting } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type AiWritingBuddyPlugin from "../main";
import { UserTemplatesModal } from "../modals/user-templates-modal";
import type { PromptTemplate } from "../types/prompt-template";

export class TemplateSettingsRenderer {
	private builtInTemplatesExpanded = false;

	constructor(private readonly plugin: AiWritingBuddyPlugin) {}

	render(containerEl: HTMLElement, refresh: () => void): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.templates.heading).setHeading();

		const builtInTemplates = this.plugin.settings.promptTemplates.filter((template) => template.isBuiltIn);
		const userTemplates = this.plugin.settings.promptTemplates.filter((template) => !template.isBuiltIn);

		const userTemplatesSetting = new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.userTemplates)
			.setDesc(userTemplates.length === 0 ? INTERFACE_TEXT.settings.templates.noUserTemplates : INTERFACE_TEXT.settings.templates.userTemplatesSaved(userTemplates.length))
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.templates.openUserTemplates).setCta().onClick(() => {
					this.openUserTemplatesModal(refresh);
				});
			});

		userTemplatesSetting.settingEl.addClass("ai-writing-buddy-clickable-setting");
		userTemplatesSetting.settingEl.addEventListener("click", (event) => {
			if (event.target instanceof HTMLButtonElement) {
				return;
			}

			this.openUserTemplatesModal(refresh);
		});

		const builtInTemplatesSetting = new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.builtInTemplates)
			.setDesc(INTERFACE_TEXT.settings.templates.builtInTemplatesDescription)
			.addButton((button) => {
				const tooltip = this.builtInTemplatesExpanded ? INTERFACE_TEXT.settings.templates.hideBuiltInTemplates : INTERFACE_TEXT.settings.templates.showBuiltInTemplates;

				button
					.setIcon(this.builtInTemplatesExpanded ? "chevron-up" : "chevron-down")
					.setTooltip(tooltip)
					.onClick(() => {
						this.toggleBuiltInTemplates(refresh);
					});

				button.buttonEl.addClass("ai-writing-buddy-expand-button");
				button.buttonEl.setAttribute("aria-label", tooltip);
				button.buttonEl.addEventListener("click", (event) => {
					event.stopPropagation();
				});
			});

		builtInTemplatesSetting.settingEl.addClass("ai-writing-buddy-clickable-setting");
		builtInTemplatesSetting.settingEl.addEventListener("click", (event) => {
			if (event.target instanceof HTMLButtonElement) {
				return;
			}

			this.toggleBuiltInTemplates(refresh);
		});

		if (!this.builtInTemplatesExpanded) {
			return;
		}

		for (const template of builtInTemplates) {
			new Setting(containerEl)
				.setName(template.name)
				.setDesc(template.description)
				.setClass("ai-writing-buddy-built-in-template-row")
				.addButton((button) => {
					button.setButtonText(INTERFACE_TEXT.settings.templates.copyToMyTemplates).onClick(async () => {
						this.plugin.settings.promptTemplates.push(this.copyBuiltInTemplate(template));
						await this.plugin.saveSettings();

						new Notice(INTERFACE_TEXT.notices.templateCopied);
						refresh();
					});
				});
		}
	}

	private openUserTemplatesModal(refresh: () => void): void {
		new UserTemplatesModal(this.plugin.app, this.plugin, refresh).open();
	}

	private toggleBuiltInTemplates(refresh: () => void): void {
		this.builtInTemplatesExpanded = !this.builtInTemplatesExpanded;
		refresh();
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
