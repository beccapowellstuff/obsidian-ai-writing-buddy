import { App, WorkspaceLeaf } from "obsidian";
import { AI_DRAFT_BENCH_VIEW_TYPE, AiDraftBenchView } from "../views/AiDraftBenchView";

export class DraftBenchViewService {
	constructor(private readonly app: App) {}

	async openView(): Promise<AiDraftBenchView> {
		let leaf: WorkspaceLeaf | null | undefined = this.app.workspace.getLeavesOfType(AI_DRAFT_BENCH_VIEW_TYPE)[0];

		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);

			if (!leaf) {
				throw new Error("Could not create AI Draft Bench view.");
			}

			await leaf.setViewState({
				type: AI_DRAFT_BENCH_VIEW_TYPE,
				active: true,
			});
		}

		await this.app.workspace.revealLeaf(leaf);

		const view = leaf.view;

		if (!(view instanceof AiDraftBenchView)) {
			throw new Error("AI Draft Bench view was not created correctly.");
		}

		return view;
	}
}
