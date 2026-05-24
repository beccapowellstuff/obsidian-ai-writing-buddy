import { Setting } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type AiWritingBuddyPlugin from "../main";

export class PromptSettingsRenderer {
	constructor(private readonly plugin: AiWritingBuddyPlugin) {}

	render(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.prompts.heading).setHeading();

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.prompts.openChatSystemPrompt)
			.setDesc(INTERFACE_TEXT.settings.prompts.openChatDescription)
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.openChatSystemPrompt).onChange(async (value) => {
					this.plugin.settings.openChatSystemPrompt = value;
					await this.plugin.saveSettings();
				});

				text.inputEl.rows = 6;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.prompts.selectedTextSystemPrompt)
			.setDesc(INTERFACE_TEXT.settings.prompts.selectedTextDescription)
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.selectionSystemPrompt).onChange(async (value) => {
					this.plugin.settings.selectionSystemPrompt = value;
					await this.plugin.saveSettings();
				});

				text.inputEl.rows = 6;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.prompts.enablePersonalityPrompt)
			.setDesc(INTERFACE_TEXT.settings.prompts.enablePersonalityDescription)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.personalityEnabled).onChange(async (value) => {
					this.plugin.settings.personalityEnabled = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.prompts.personalityPrompt)
			.setDesc(INTERFACE_TEXT.settings.prompts.personalityDescription)
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.personalityPrompt).onChange(async (value) => {
					this.plugin.settings.personalityPrompt = value;
					await this.plugin.saveSettings();
				});

				text.inputEl.rows = 5;
				text.inputEl.cols = 50;
			});
	}
}
