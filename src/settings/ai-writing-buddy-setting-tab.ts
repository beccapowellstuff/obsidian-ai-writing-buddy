import { App, PluginSettingTab } from "obsidian";
import type AiDraftBenchPlugin from "../main";
import { TemplateSettingsRenderer } from "./template-settings-renderer";
import { ConnectionSettingsRenderer } from "./connection-settings-renderer";
import { PromptSettingsRenderer } from "./prompt-settings-renderer";

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

		new ConnectionSettingsRenderer(this.plugin, this.availableModels, () => this.display()).render(containerEl);
		new PromptSettingsRenderer(this.plugin).render(containerEl);
		new TemplateSettingsRenderer(this.plugin).render(containerEl, () => this.display());
	}
}
