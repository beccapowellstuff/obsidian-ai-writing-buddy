import { App, PluginSettingTab, Setting } from "obsidian";
import type AiDraftBenchPlugin from "../main";

export class AiDraftBenchSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: AiDraftBenchPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		this.renderConnectionSettings(containerEl);
		this.renderPromptSettings(containerEl);
	}

	private renderConnectionSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Connection").setHeading();

		new Setting(containerEl)
			.setName("Provider")
			.setDesc("Choose which model provider to use.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("mock", "Mock provider")
					.addOption("openai-compatible", "Compatible provider")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						this.plugin.settings.provider = value === "openai-compatible" ? "openai-compatible" : "mock";

						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Server address")
			.setDesc("For local model servers.")
			.addText((text) => {
				text.setPlaceholder("Server address")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Model name")
			.setDesc("The model name to send to the provider.")
			.addText((text) => {
				text.setPlaceholder("Model name")
					.setValue(this.plugin.settings.modelName)
					.onChange(async (value) => {
						this.plugin.settings.modelName = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Secret key")
			.setDesc("Optional for local providers. Required for some hosted providers.")
			.addText((text) => {
				text.setPlaceholder("Optional")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});

				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Request timeout")
			.setDesc("How long to wait for a response, in milliseconds.")
			.addText((text) => {
				text.setPlaceholder("60000")
					.setValue(String(this.plugin.settings.requestTimeoutMs))
					.onChange(async (value) => {
						const parsedValue = Number.parseInt(value, 10);

						if (Number.isNaN(parsedValue) || parsedValue <= 0) {
							return;
						}

						this.plugin.settings.requestTimeoutMs = parsedValue;
						await this.plugin.saveSettings();
					});
			});
	}

	private renderPromptSettings(containerEl: HTMLElement): void {
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
