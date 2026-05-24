import { App, PluginSettingTab } from "obsidian";
import type AiWritingBuddyPlugin from "../main";
import { PLUGIN_DISPLAY } from "../config/plugin-display";
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
			text: PLUGIN_DISPLAY.name,
		});

		introEl.createEl("p", {
			text: `Connect your model provider and tune how ${PLUGIN_DISPLAY.name} helps with your notes.`,
		});

		new ConnectionSettingsRenderer(this.plugin, this.availableModels, () => this.display()).render(containerEl);
		new PromptSettingsRenderer(this.plugin).render(containerEl);
		new TemplateSettingsRenderer(this.plugin).render(containerEl, () => this.display());
	}
}
