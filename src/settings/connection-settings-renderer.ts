import { Notice, Setting } from "obsidian";
import type AiWritingBuddyPlugin from "../main";

export class ConnectionSettingsRenderer {
	constructor(
		private readonly plugin: AiWritingBuddyPlugin,
		private readonly availableModels: string[],
		private readonly refresh: () => void,
	) {}

	render(containerEl: HTMLElement): void {
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

		this.renderModelSetting(containerEl);
		this.renderAvailableModelsSetting(containerEl);

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

		new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Send a small test request using the current provider settings.")
			.addButton((button) => {
				button.setButtonText("Test connection").onClick(async () => {
					button.setDisabled(true);
					button.setButtonText("Testing...");

					try {
						const message = await this.plugin.testProviderConnection();
						new Notice(message);
					} catch (error) {
						console.error("AI Writing Buddy connection test failed", error);

						const message = error instanceof Error ? error.message : "Connection test failed.";
						new Notice(`Connection test failed: ${message}`);
					} finally {
						button.setDisabled(false);
						button.setButtonText("Test connection");
					}
				});
			});
	}

	private renderModelSetting(containerEl: HTMLElement): void {
		if (this.availableModels.length > 0) {
			new Setting(containerEl)
				.setName("Model")
				.setDesc("Choose a model returned by the provider.")
				.addDropdown((dropdown) => {
					for (const modelName of this.availableModels) {
						dropdown.addOption(modelName, modelName);
					}

					dropdown.setValue(this.plugin.settings.modelName).onChange(async (value) => {
						this.plugin.settings.modelName = value;
						await this.plugin.saveSettings();
					});
				});

			return;
		}

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Type a model name manually, or load available models below.")
			.addText((text) => {
				text.setPlaceholder("Model name")
					.setValue(this.plugin.settings.modelName)
					.onChange(async (value) => {
						this.plugin.settings.modelName = value.trim();
						await this.plugin.saveSettings();
					});
			});
	}

	private renderAvailableModelsSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Available models")
			.setDesc("Load models from the configured provider.")
			.addButton((button) => {
				const setIdleButtonText = (): void => {
					button.setButtonText(this.availableModels.length > 0 ? "Refresh models" : "Load models");
				};

				setIdleButtonText();

				button.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText("Loading");

					try {
						this.availableModels.length = 0;
						this.availableModels.push(...(await this.plugin.listAvailableModels()));

						if (!this.plugin.settings.modelName && this.availableModels[0]) {
							this.plugin.settings.modelName = this.availableModels[0];
							await this.plugin.saveSettings();
						}

						new Notice("Models loaded.");
						this.refresh();
					} catch (error) {
						console.error("AI Writing Buddy model loading failed", error);

						const message = error instanceof Error ? error.message : "Model loading failed.";
						new Notice(`Model loading failed: ${message}`);
					} finally {
						button.setDisabled(false);
						setIdleButtonText();
					}
				});
			});
	}
}
