import { Setting } from "obsidian";
import type AiWritingBuddyPlugin from "../main";

export class PromptSettingsRenderer {
	constructor(private readonly plugin: AiWritingBuddyPlugin) {}

	render(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Prompts").setHeading();

		new Setting(containerEl)
			.setName("Open chat system prompt")
			.setDesc("Used for general chat prompts that are not based on selected text.")
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.openChatSystemPrompt).onChange(async (value) => {
					this.plugin.settings.openChatSystemPrompt = value;
					await this.plugin.saveSettings();
				});

				text.inputEl.rows = 6;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName("Selected text system prompt")
			.setDesc("Used when asking the model to work with selected note text.")
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.selectionSystemPrompt).onChange(async (value) => {
					this.plugin.settings.selectionSystemPrompt = value;
					await this.plugin.saveSettings();
				});

				text.inputEl.rows = 6;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName("Enable personality prompt")
			.setDesc("Add the personality prompt to requests.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.personalityEnabled).onChange(async (value) => {
					this.plugin.settings.personalityEnabled = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Personality prompt")
			.setDesc("Optional tone and style guidance added when enabled.")
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
