import { Notice, Setting } from "obsidian";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type AiWritingBuddyPlugin from "../main";

export class ConnectionSettingsRenderer {
	constructor(
		private readonly plugin: AiWritingBuddyPlugin,
		private readonly settings: AiWritingBuddySettings,
		private readonly availableModels: string[],
		private readonly refresh: () => void,
	) {}

	render(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.connection.heading).setHeading();

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.connection.provider)
			.setDesc(INTERFACE_TEXT.settings.connection.providerDescription)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("mock", INTERFACE_TEXT.settings.connection.mockProvider)
					.addOption("openai-compatible", INTERFACE_TEXT.settings.connection.compatibleProvider)
					.setValue(this.settings.provider)
					.onChange((value) => {
						this.settings.provider = value === "openai-compatible" ? "openai-compatible" : "mock";
					});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.connection.serverAddress)
			.setDesc(INTERFACE_TEXT.settings.connection.serverAddressDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.connection.serverAddress)
					.setValue(this.settings.baseUrl)
					.onChange((value) => {
						this.settings.baseUrl = value.trim();
					});
			});

		this.renderModelSetting(containerEl);
		this.renderAvailableModelsSetting(containerEl);

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.connection.secretKey)
			.setDesc(INTERFACE_TEXT.settings.connection.secretKeyDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.connection.optional)
					.setValue(this.settings.apiKey)
					.onChange((value) => {
						this.settings.apiKey = value;
					});

				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.connection.requestTimeout)
			.setDesc(INTERFACE_TEXT.settings.connection.requestTimeoutDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.connection.requestTimeoutPlaceholder)
					.setValue(String(this.settings.requestTimeoutMs))
					.onChange((value) => {
						const parsedValue = Number.parseInt(value, 10);

						if (Number.isNaN(parsedValue) || parsedValue <= 0) {
							return;
						}

						this.settings.requestTimeoutMs = parsedValue;
					});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.connection.testConnection)
			.setDesc(INTERFACE_TEXT.settings.connection.testConnectionDescription)
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.connection.testConnection).onClick(async () => {
					button.setDisabled(true);
					button.setButtonText(INTERFACE_TEXT.settings.connection.testing);

					try {
						const message = await this.plugin.testProviderConnection(this.settings);
						new Notice(message);
					} catch (error) {
						console.error("AI Writing Buddy connection test failed", error);

						const message = error instanceof Error ? error.message : INTERFACE_TEXT.errors.connectionTestFailed;
						new Notice(INTERFACE_TEXT.errors.connectionTestFailure(message));
					} finally {
						button.setDisabled(false);
						button.setButtonText(INTERFACE_TEXT.settings.connection.testConnection);
					}
				});
			});
	}

	private renderModelSetting(containerEl: HTMLElement): void {
		if (this.availableModels.length > 0) {
			new Setting(containerEl)
				.setName(INTERFACE_TEXT.settings.connection.model)
				.setDesc(INTERFACE_TEXT.settings.connection.modelSelectionDescription)
				.addDropdown((dropdown) => {
					for (const modelName of this.availableModels) {
						dropdown.addOption(modelName, modelName);
					}

					dropdown.setValue(this.settings.modelName).onChange((value) => {
						this.settings.modelName = value;
					});
				});

			return;
		}

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.connection.model)
			.setDesc(INTERFACE_TEXT.settings.connection.modelEntryDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.connection.modelName)
					.setValue(this.settings.modelName)
					.onChange((value) => {
						this.settings.modelName = value.trim();
					});
			});
	}

	private renderAvailableModelsSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.connection.availableModels)
			.setDesc(INTERFACE_TEXT.settings.connection.availableModelsDescription)
			.addButton((button) => {
				const setIdleButtonText = (): void => {
					button.setButtonText(this.availableModels.length > 0 ? INTERFACE_TEXT.settings.connection.refreshModels : INTERFACE_TEXT.settings.connection.loadModels);
				};

				setIdleButtonText();

				button.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText(INTERFACE_TEXT.settings.connection.loading);

					try {
						this.availableModels.length = 0;
						this.availableModels.push(...(await this.plugin.listAvailableModels(this.settings)));

						if (!this.settings.modelName && this.availableModels[0]) {
							this.settings.modelName = this.availableModels[0];
						}

						new Notice(INTERFACE_TEXT.notices.modelsLoaded);
						this.refresh();
					} catch (error) {
						console.error("AI Writing Buddy model loading failed", error);

						const message = error instanceof Error ? error.message : INTERFACE_TEXT.errors.modelLoadingFailed;
						new Notice(INTERFACE_TEXT.errors.modelLoadingFailure(message));
					} finally {
						button.setDisabled(false);
						setIdleButtonText();
					}
				});
			});
	}
}
