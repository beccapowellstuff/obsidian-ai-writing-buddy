import { App, Notice, PluginSettingTab } from "obsidian";
import type AiWritingBuddyPlugin from "../main";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { AiMemoryService } from "../services/ai-memory-service";
import { TemplateSettingsRenderer } from "./template-settings-renderer";
import { ConnectionSettingsRenderer } from "./connection-settings-renderer";
import { PromptSettingsRenderer } from "./prompt-settings-renderer";
import { RagSettingsRenderer } from "./rag-settings-renderer";
import { AiMemorySettingsRenderer } from "./ai-memory-settings-renderer";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { UnsavedChangesModal } from "../modals/unsaved-changes-modal";

export class AiWritingBuddySettingTab extends PluginSettingTab {
	private availableModels: string[] = [];
	private availableEmbeddingModels: string[] = [];
	private readonly templateSettingsRenderer: TemplateSettingsRenderer;
	private draftSettings: AiWritingBuddySettings;
	private savedDraftSignature: string;
	private forceHide = false;

	constructor(
		app: App,
		private readonly plugin: AiWritingBuddyPlugin,
	) {
		super(app, plugin);
		this.templateSettingsRenderer = new TemplateSettingsRenderer(this.plugin);
		this.draftSettings = this.cloneSettings(this.plugin.settings);
		this.savedDraftSignature = this.getSettingsSignature(this.draftSettings);
	}

	display(): void {
		this.syncDraftFromSavedIfClean();

		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass("ai-writing-buddy-settings");

		const introEl = containerEl.createEl("div", {
			cls: "ai-writing-buddy-settings-hero",
		});

		introEl.createEl("div", {
			cls: "ai-writing-buddy-settings-title",
			text: INTERFACE_TEXT.app.name,
		});

		introEl.createEl("p", {
			text: INTERFACE_TEXT.app.settingsIntroduction(INTERFACE_TEXT.app.name),
		});

		this.renderSettingsActions(containerEl);

		new ConnectionSettingsRenderer(this.plugin, this.draftSettings, this.availableModels, () => this.display()).render(containerEl);
		new RagSettingsRenderer(this.plugin, this.draftSettings, this.availableEmbeddingModels, () => this.display()).render(containerEl);
		new AiMemorySettingsRenderer(this.plugin, this.draftSettings, () => this.display(), () => this.saveDraftSettings(false, false)).render(containerEl);
		new PromptSettingsRenderer(this.draftSettings, () => this.display()).render(containerEl);
		this.templateSettingsRenderer.render(containerEl, () => this.display());
	}

	hide(): void {
		if (this.forceHide || !this.hasUnsavedChanges()) {
			this.containerEl.empty();
			return;
		}

		this.openUnsavedSettingsModal(() => {
			this.forceHide = true;
			this.hide();
			this.forceHide = false;
		});
	}

	private renderSettingsActions(containerEl: HTMLElement): void {
		const actionsEl = containerEl.createEl("div", {
			cls: "ai-writing-buddy-settings-actions",
		});

		const saveButtonEl = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.settings.actions.save,
			cls: "mod-cta",
		});
		saveButtonEl.type = "button";
		saveButtonEl.addEventListener("click", () => {
			void this.saveDraftSettings();
		});

		const closeButtonEl = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.settings.actions.close,
		});
		closeButtonEl.type = "button";
		closeButtonEl.addEventListener("click", () => {
			this.requestClose();
		});
	}

	private requestClose(): void {
		if (!this.hasUnsavedChanges()) {
			this.closeSettings();
			return;
		}

		this.openUnsavedSettingsModal(() => {
			this.closeSettings();
		});
	}

	private openUnsavedSettingsModal(afterSaveOrDiscard: () => void): void {
		new UnsavedChangesModal(this.app, {
			title: INTERFACE_TEXT.settings.actions.unsavedChangesTitle,
			description: INTERFACE_TEXT.settings.actions.unsavedChangesDescription,
			cancelText: INTERFACE_TEXT.sessionManager.cancel,
			discardText: INTERFACE_TEXT.settings.actions.discardChanges,
			saveText: INTERFACE_TEXT.settings.actions.saveChanges,
			onSave: async (): Promise<void> => {
				await this.saveDraftSettings();
				afterSaveOrDiscard();
			},
			onDiscard: () => {
				this.resetDraftFromSaved();
				afterSaveOrDiscard();
			},
			onCancel: () => {},
		}).open();
	}

	private async saveDraftSettings(showNotice = true, refreshAfterSave = true): Promise<void> {
		const normalisedDraftSettings = new AiMemoryService(this.app).normaliseMemorySettings(this.draftSettings);

		const nextSettings: AiWritingBuddySettings = {
			...this.cloneSettings(normalisedDraftSettings),
			contextOptions: this.plugin.settings.contextOptions,
			promptTemplates: this.plugin.settings.promptTemplates,
		};

		Object.assign(this.plugin.settings, nextSettings);

		await this.plugin.saveSettings();

		if (refreshAfterSave) {
			this.resetDraftFromSaved();
		} else {
			this.savedDraftSignature = this.getSettingsSignature(this.draftSettings);
		}

		if (showNotice) {
			new Notice(INTERFACE_TEXT.settings.actions.saved);
		}

		if (refreshAfterSave) {
			this.display();
		}
	}

	private resetDraftFromSaved(): void {
		this.draftSettings = this.cloneSettings(this.plugin.settings);
		this.savedDraftSignature = this.getSettingsSignature(this.draftSettings);
	}

	private syncDraftFromSavedIfClean(): void {
		if (!this.hasUnsavedChanges()) {
			this.resetDraftFromSaved();
		}
	}

	private hasUnsavedChanges(): boolean {
		return this.getSettingsSignature(this.draftSettings) !== this.savedDraftSignature;
	}

	private closeSettings(): void {
		const maybeSettings = (this.app as App & { setting?: { close: () => void } }).setting;

		if (maybeSettings) {
			maybeSettings.close();
			return;
		}

		this.hide();
	}

	private cloneSettings(settings: AiWritingBuddySettings): AiWritingBuddySettings {
		return {
			...settings,
			contextOptions: {
				...settings.contextOptions,
			},
			promptTemplates: settings.promptTemplates.map((template) => ({
				...template,
			})),
		};
	}

	private getSettingsSignature(settings: AiWritingBuddySettings): string {
		return JSON.stringify({
			provider: settings.provider,
			baseUrl: settings.baseUrl,
			modelName: settings.modelName,
			apiKey: settings.apiKey,
			embeddingBaseUrl: settings.embeddingBaseUrl,
			embeddingModelName: settings.embeddingModelName,
			embeddingApiKey: settings.embeddingApiKey,
			requestTimeoutMs: settings.requestTimeoutMs,
			maxPromptCharacters: settings.maxPromptCharacters,
			memoryEnabled: settings.memoryEnabled,
			memoryBudgetCharacters: settings.memoryBudgetCharacters,
			recentHistoryMaxEntries: settings.recentHistoryMaxEntries,
			aiMemoryEnabled: settings.aiMemoryEnabled,
			aiMemoryAutoUpdateEnabled: settings.aiMemoryAutoUpdateEnabled,
			aiMemoryFolderPath: settings.aiMemoryFolderPath,
			aiMemoryFileName: settings.aiMemoryFileName,
			aiMemoryMaxPromptCharacters: settings.aiMemoryMaxPromptCharacters,
			aiMemoryShowUpdateNotice: settings.aiMemoryShowUpdateNotice,
			aiMemoryWriteCount: settings.aiMemoryWriteCount,
			aiMemoryCleanupEnabled: settings.aiMemoryCleanupEnabled,
			aiMemoryCleanupWriteThreshold: settings.aiMemoryCleanupWriteThreshold,
			openChatSystemPrompt: settings.openChatSystemPrompt,
			selectionSystemPrompt: settings.selectionSystemPrompt,
			personalityEnabled: settings.personalityEnabled,
			personalityPrompt: settings.personalityPrompt,
		});
	}
}
