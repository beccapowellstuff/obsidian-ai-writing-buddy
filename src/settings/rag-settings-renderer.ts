import { Notice, Setting } from "obsidian";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type AiWritingBuddyPlugin from "../main";
import { runSettingsButtonTask } from "./run-settings-button-task";

export class RagSettingsRenderer {
	constructor(
		private readonly plugin: AiWritingBuddyPlugin,
		private readonly settings: AiWritingBuddySettings,
		private readonly availableEmbeddingModels: string[],
		private readonly refresh: () => void,
	) {}

	render(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.rag.heading).setHeading();

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.rag.embeddingServerAddress)
			.setDesc(INTERFACE_TEXT.settings.rag.embeddingServerAddressDescription)
			.addText((text) => {
				text.setPlaceholder(this.settings.baseUrl || INTERFACE_TEXT.settings.connection.serverAddress)
					.setValue(this.settings.embeddingBaseUrl)
					.onChange((value) => {
						this.settings.embeddingBaseUrl = value.trim();
					});
			});

		this.renderEmbeddingModelSetting(containerEl);
		this.renderAvailableEmbeddingModelsSetting(containerEl);

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.rag.embeddingSecretKey)
			.setDesc(INTERFACE_TEXT.settings.rag.embeddingSecretKeyDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.connection.optional)
					.setValue(this.settings.embeddingApiKey)
					.onChange((value) => {
						this.settings.embeddingApiKey = value;
					});

				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.rag.testEmbeddingConnection)
			.setDesc(INTERFACE_TEXT.settings.rag.testEmbeddingConnectionDescription)
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.rag.testEmbeddingConnection).onClick(async () => {
					button.setDisabled(true);
					button.setButtonText(INTERFACE_TEXT.settings.connection.testing);

					try {
						const message = await this.plugin.testEmbeddingConnection(this.settings);
						new Notice(message);
					} catch (error) {
						console.error("AI Writing Buddy embedding connection test failed", error);

						const message = error instanceof Error ? error.message : INTERFACE_TEXT.errors.embeddingConnectionTestFailed;
						new Notice(INTERFACE_TEXT.errors.embeddingConnectionTestFailure(message));
					} finally {
						button.setDisabled(false);
						button.setButtonText(INTERFACE_TEXT.settings.rag.testEmbeddingConnection);
					}
				});
			});
	}

	private renderEmbeddingModelSetting(containerEl: HTMLElement): void {
		if (this.availableEmbeddingModels.length > 0) {
			new Setting(containerEl)
				.setName(INTERFACE_TEXT.settings.rag.embeddingModel)
				.setDesc(INTERFACE_TEXT.settings.rag.embeddingModelSelectionDescription)
				.addDropdown((dropdown) => {
					for (const modelName of this.availableEmbeddingModels) {
						dropdown.addOption(modelName, modelName);
					}

					dropdown.setValue(this.settings.embeddingModelName).onChange((value) => {
						this.settings.embeddingModelName = value;
					});
				});

			return;
		}

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.rag.embeddingModel)
			.setDesc(INTERFACE_TEXT.settings.rag.embeddingModelDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.connection.modelName)
					.setValue(this.settings.embeddingModelName)
					.onChange((value) => {
						this.settings.embeddingModelName = value.trim();
					});
			});
	}

	private renderAvailableEmbeddingModelsSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.rag.availableEmbeddingModels)
			.setDesc(INTERFACE_TEXT.settings.rag.availableEmbeddingModelsDescription)
			.addButton((button) => {
				const setIdleButtonText = (): void => {
					button.setButtonText(this.availableEmbeddingModels.length > 0 ? INTERFACE_TEXT.settings.rag.refreshEmbeddingModels : INTERFACE_TEXT.settings.rag.loadEmbeddingModels);
				};

				setIdleButtonText();

				button.onClick(async () => {
					await runSettingsButtonTask({
						button,
						busyText: INTERFACE_TEXT.settings.connection.loading,
						restoreButtonText: setIdleButtonText,
						logMessage: "AI Writing Buddy embedding model loading failed",
						fallbackErrorMessage: INTERFACE_TEXT.errors.modelLoadingFailed,
						formatFailureNotice: INTERFACE_TEXT.errors.modelLoadingFailure,
						run: async () => {
							this.availableEmbeddingModels.length = 0;
							this.availableEmbeddingModels.push(...(await this.plugin.listAvailableEmbeddingModels(this.settings)));

							if (!this.settings.embeddingModelName && this.availableEmbeddingModels[0]) {
								this.settings.embeddingModelName = this.availableEmbeddingModels[0];
							}

							new Notice(INTERFACE_TEXT.notices.modelsLoaded);
							this.refresh();
						},
					});
				});
			});
	}
}
