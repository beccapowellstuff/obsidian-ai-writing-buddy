import { App, Modal, Notice, PluginSettingTab } from "obsidian";
import type AiWritingBuddyPlugin from "../main";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { TemplateSettingsRenderer } from "./template-settings-renderer";
import { ConnectionSettingsRenderer } from "./connection-settings-renderer";
import { PromptSettingsRenderer } from "./prompt-settings-renderer";
import type { AiWritingBuddySettings } from "../config/default-settings";

export class AiWritingBuddySettingTab extends PluginSettingTab {
	private availableModels: string[] = [];
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
		new UnsavedSettingsModal(this.app, {
			onSave: async () => {
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

	private async saveDraftSettings(): Promise<void> {
		this.plugin.settings = {
			...this.cloneSettings(this.draftSettings),
			promptTemplates: this.plugin.settings.promptTemplates,
		};
		await this.plugin.saveSettings();
		this.resetDraftFromSaved();
		new Notice(INTERFACE_TEXT.settings.actions.saved);
		this.display();
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
			requestTimeoutMs: settings.requestTimeoutMs,
			maxPromptCharacters: settings.maxPromptCharacters,
			memoryEnabled: settings.memoryEnabled,
			memoryBudgetCharacters: settings.memoryBudgetCharacters,
			recentHistoryMaxEntries: settings.recentHistoryMaxEntries,
			openChatSystemPrompt: settings.openChatSystemPrompt,
			selectionSystemPrompt: settings.selectionSystemPrompt,
			personalityEnabled: settings.personalityEnabled,
			personalityPrompt: settings.personalityPrompt,
		});
	}
}

class UnsavedSettingsModal extends Modal {
	constructor(
		app: App,
		private readonly options: {
			onSave: () => Promise<void>;
			onDiscard: () => void;
			onCancel: () => void;
		},
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: INTERFACE_TEXT.settings.actions.unsavedChangesTitle,
		});

		contentEl.createEl("p", {
			text: INTERFACE_TEXT.settings.actions.unsavedChangesDescription,
		});

		const buttonRowEl = contentEl.createEl("div", {
			cls: "ai-writing-buddy-modal-button-row",
		});

		const cancelButtonEl = buttonRowEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.cancel,
		});
		cancelButtonEl.type = "button";
		cancelButtonEl.addEventListener("click", () => {
			this.options.onCancel();
			this.close();
		});

		const discardButtonEl = buttonRowEl.createEl("button", {
			text: INTERFACE_TEXT.settings.actions.discardChanges,
			cls: "mod-warning",
		});
		discardButtonEl.type = "button";
		discardButtonEl.addEventListener("click", () => {
			this.options.onDiscard();
			this.close();
		});

		const saveButtonEl = buttonRowEl.createEl("button", {
			text: INTERFACE_TEXT.settings.actions.saveChanges,
			cls: "mod-cta",
		});
		saveButtonEl.type = "button";
		saveButtonEl.addEventListener("click", () => {
			void this.options.onSave().then(() => {
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
