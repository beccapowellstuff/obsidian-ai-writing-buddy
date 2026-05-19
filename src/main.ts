import { Plugin, WorkspaceLeaf } from "obsidian";
import { EditorMenuService } from "./services/EditorMenuService";
import { PLUGIN_DISPLAY } from "./config/pluginDisplay";
import {
	AI_DRAFT_BENCH_VIEW_TYPE,
	AiDraftBenchView,
} from "./views/AiDraftBenchView";

export default class AiDraftBenchPlugin extends Plugin {
	async onload() {
		console.debug("AI Draft Bench loaded");

		this.registerView(
			AI_DRAFT_BENCH_VIEW_TYPE,
			(leaf) => new AiDraftBenchView(leaf)
		);

		this.addRibbonIcon(
			PLUGIN_DISPLAY.ribbonIcon,
			PLUGIN_DISPLAY.ribbonTooltip,
			async () => {
				await this.openDraftBenchView();
			}
		);

		const editorMenuService = new EditorMenuService(this);
		editorMenuService.register();
	}

	onunload() {
		console.debug("AI Draft Bench unloaded");
	}

	private async openDraftBenchView(): Promise<void> {
		let leaf: WorkspaceLeaf | null | undefined =
			this.app.workspace.getLeavesOfType(AI_DRAFT_BENCH_VIEW_TYPE)[0];

		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: AI_DRAFT_BENCH_VIEW_TYPE,
				active: true,
			});
		}

		await this.app.workspace.revealLeaf(leaf);
	}
}