import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AiDraftBenchPlugin from "../main";
import { PromptTemplate } from "../types/PromptTemplate";

export class AiDraftBenchSettingTab extends PluginSettingTab {
	private availableModels: string[] = [];

	constructor(
		app: App,
		private readonly plugin: AiDraftBenchPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass("ai-draft-bench-settings");

		const introEl = containerEl.createEl("div", {
			cls: "ai-draft-bench-settings-hero",
		});

		introEl.createEl("div", {
			cls: "ai-draft-bench-settings-kicker",
			text: "Writing assistant",
		});

		introEl.createEl("div", {
			cls: "ai-draft-bench-settings-title",
			text: "Draft bench",
		});

		introEl.createEl("p", {
			text: "Connect your model provider, tune prompt behaviour, and keep draft changes safely under your control.",
		});

		this.renderConnectionSettings(containerEl);
		this.renderPromptSettings(containerEl);
		this.renderTemplateSettings(containerEl);
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
						console.error("AI Draft Bench connection test failed", error);

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
						this.availableModels = await this.plugin.listAvailableModels();

						if (!this.plugin.settings.modelName && this.availableModels[0]) {
							this.plugin.settings.modelName = this.availableModels[0];
							await this.plugin.saveSettings();
						}

						new Notice("Models loaded.");
						this.display();
					} catch (error) {
						console.error("AI Draft Bench model loading failed", error);

						const message = error instanceof Error ? error.message : "Model loading failed.";
						new Notice(`Model loading failed: ${message}`);
					} finally {
						button.setDisabled(false);
						setIdleButtonText();
					}
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

	private renderTemplateSettings(containerEl: HTMLElement): void {
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
						this.display();
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
						this.display();
					});
				});
		}

		for (const template of userTemplates) {
			new Setting(containerEl).setName(template.name).setHeading();

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
							this.display();
						});
				});
		}
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
