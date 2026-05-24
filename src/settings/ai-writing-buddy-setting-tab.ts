import { App, PluginSettingTab } from "obsidian";
import type AiWritingBuddyPlugin from "../main";
import { INTERFACE_TEXT } from "../config/interface-text";
import { TemplateSettingsRenderer } from "./template-settings-renderer";
import { ConnectionSettingsRenderer } from "./connection-settings-renderer";
import { PromptSettingsRenderer } from "./prompt-settings-renderer";

export class AiWritingBuddySettingTab extends PluginSettingTab {
	private availableModels: string[] = [];

	constructor(
		app: App,
		private readonly plugin: AiWritingBuddyPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
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

		new ConnectionSettingsRenderer(this.plugin, this.availableModels, () => this.display()).render(containerEl);
		new PromptSettingsRenderer(this.plugin).render(containerEl);
		new TemplateSettingsRenderer(this.plugin).render(containerEl, () => this.display());
	}
}
