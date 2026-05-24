import { App, WorkspaceLeaf } from "obsidian";
import { AI_WRITING_BUDDY_VIEW_TYPE, AiWritingBuddyView } from "../views/ai-writing-buddy-view";

export class AiWritingBuddyViewService {
	constructor(private readonly app: App) {}

	async openView(): Promise<AiWritingBuddyView> {
		let leaf: WorkspaceLeaf | null | undefined = this.app.workspace.getLeavesOfType(AI_WRITING_BUDDY_VIEW_TYPE)[0];

		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);

			if (!leaf) {
				throw new Error("Could not create AI Writing Buddy view.");
			}

			await leaf.setViewState({
				type: AI_WRITING_BUDDY_VIEW_TYPE,
				active: true,
			});
		}

		await this.app.workspace.revealLeaf(leaf);

		const view = leaf.view;

		if (!(view instanceof AiWritingBuddyView)) {
			throw new Error("AI Writing Buddy view was not created correctly.");
		}

		return view;
	}
}
