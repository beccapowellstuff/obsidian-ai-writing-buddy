import { Plugin } from "obsidian";
import { PLUGIN_DISPLAY } from "./config/pluginDisplay";
import { EditorMenuService } from "./services/EditorMenuService";
import { DraftBenchViewService } from "./services/DraftBenchViewService";
import { AI_DRAFT_BENCH_VIEW_TYPE, AiDraftBenchView } from "./views/AiDraftBenchView";

export default class AiDraftBenchPlugin extends Plugin {
	private draftBenchViewService!: DraftBenchViewService;

	async onload() {
		console.debug("AI Draft Bench loaded");

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
}
