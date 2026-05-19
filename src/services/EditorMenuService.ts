import {
	App,
	Editor,
	EditorPosition,
	EventRef,
	MarkdownView,
	Menu,
	Notice,
	Plugin,
	WorkspaceLeaf,
} from "obsidian";

import { AiPromptModal } from "../modals/AiPromptModal";
import {
	AI_DRAFT_BENCH_VIEW_TYPE,
	AiDraftBenchView,
} from "../views/AiDraftBenchView";

type EditorMenuWorkspace = {
	on(
		name: "editor-menu",
		callback: (menu: Menu, editor: Editor, view: MarkdownView) => void,
	): EventRef;
};

export class EditorMenuService {
	private readonly plugin: Plugin;
	private readonly app: App;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	register(): void {
		const workspace = this.app.workspace as unknown as EditorMenuWorkspace;

		this.plugin.registerEvent(
			workspace.on("editor-menu", (menu, editor, view) => {
				this.handleEditorMenu(menu, editor, view);
			}),
		);
	}

	private handleEditorMenu(
		menu: Menu,
		editor: Editor,
		view: MarkdownView,
	): void {
		const selectedText = editor.getSelection();

		if (!selectedText || !selectedText.trim()) {
			return;
		}

		menu.addItem((item) => {
			item.setTitle("Ask AI about selection")
				.setIcon("sparkles")
				.onClick(() => {
					const sourcePath = view.file?.path;

					if (!sourcePath) {
						new Notice(
							"Could not find source note for selected text.",
						);
						return;
					}

					this.openPromptModal(
						selectedText,
						sourcePath,
						editor.getCursor("from"),
						editor.getCursor("to"),
					);
				});
		});
	}

	private openPromptModal(
		selectedText: string,
		sourcePath: string,
		selectionStart: EditorPosition,
		selectionEnd: EditorPosition,
	): void {
		new AiPromptModal(this.app, selectedText, (instruction, text) => {
			void this.handlePromptSubmit(
				instruction,
				text,
				sourcePath,
				selectionStart,
				selectionEnd,
			);
		}).open();
	}

	private async handlePromptSubmit(
		instruction: string,
		selectedText: string,
		sourcePath: string,
		selectionStart: EditorPosition,
		selectionEnd: EditorPosition,
	): Promise<void> {
		const draftBenchView = await this.openDraftBenchView();

		draftBenchView.setRequest({
			instruction,
			selectedText,
			sourcePath,
			selectionStart,
			selectionEnd,
			createdAt: new Date().toISOString(),
		});
	}

	private async openDraftBenchView(): Promise<AiDraftBenchView> {
		let leaf: WorkspaceLeaf | null | undefined =
			this.app.workspace.getLeavesOfType(AI_DRAFT_BENCH_VIEW_TYPE)[0];

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
