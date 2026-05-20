import { Plugin } from "obsidian";
import { AiDraftBenchSettings, DEFAULT_AI_DRAFT_BENCH_SETTINGS } from "./config/defaultSettings";
import { PLUGIN_DISPLAY } from "./config/pluginDisplay";
import { DraftBenchViewService } from "./services/DraftBenchViewService";
import { EditorMenuService } from "./services/EditorMenuService";
import { AI_DRAFT_BENCH_VIEW_TYPE, AiDraftBenchView } from "./views/AiDraftBenchView";
import { AiDraftBenchSettingTab } from "./settings/AiDraftBenchSettingTab";

export default class AiDraftBenchPlugin extends Plugin {
	private draftBenchViewService!: DraftBenchViewService;
	settings!: AiDraftBenchSettings;

	async onload() {
		console.debug("AI Draft Bench loaded");

		await this.loadSettings();
		this.addSettingTab(new AiDraftBenchSettingTab(this.app, this));

		this.draftBenchViewService = new DraftBenchViewService(this.app);

		this.registerView(AI_DRAFT_BENCH_VIEW_TYPE, (leaf) => new AiDraftBenchView(leaf));

		this.addRibbonIcon(PLUGIN_DISPLAY.ribbonIcon, PLUGIN_DISPLAY.ribbonTooltip, () => {
			void this.draftBenchViewService.openView();
		});

		const editorMenuService = new EditorMenuService(this, this.draftBenchViewService);

		editorMenuService.register();
	}

	onunload() {
		console.debug("AI Draft Bench unloaded");
	}

	async loadSettings(): Promise<void> {
		const savedSettings = (await this.loadData()) as Partial<AiDraftBenchSettings> | null;

		this.settings = {
			...DEFAULT_AI_DRAFT_BENCH_SETTINGS,
			...(savedSettings ?? {}),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
