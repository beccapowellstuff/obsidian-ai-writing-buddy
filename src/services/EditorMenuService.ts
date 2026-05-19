import { App, Editor, EditorPosition, EventRef, MarkdownView, Menu, Notice, Plugin } from "obsidian";

import { AiPromptModal } from "../modals/AiPromptModal";
import { DraftBenchViewService } from "./DraftBenchViewService";

type EditorMenuWorkspace = {
	on(name: "editor-menu", callback: (menu: Menu, editor: Editor, view: MarkdownView) => void): EventRef;
};

export class EditorMenuService {
	private readonly plugin: Plugin;
	private readonly app: App;

	constructor(
		plugin: Plugin,
		private readonly draftBenchViewService: DraftBenchViewService,
	) {
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

	private handleEditorMenu(menu: Menu, editor: Editor, view: MarkdownView): void {
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
						new Notice("Could not find source note for selected text.");
						return;
					}

					this.openPromptModal(selectedText, sourcePath, editor.getCursor("from"), editor.getCursor("to"));
				});
		});
	}

	private openPromptModal(selectedText: string, sourcePath: string, selectionStart: EditorPosition, selectionEnd: EditorPosition): void {
		new AiPromptModal(this.app, selectedText, (instruction, text) => {
			void this.handlePromptSubmit(instruction, text, sourcePath, selectionStart, selectionEnd);
		}).open();
	}

	private async handlePromptSubmit(instruction: string, selectedText: string, sourcePath: string, selectionStart: EditorPosition, selectionEnd: EditorPosition): Promise<void> {
		const draftBenchView = await this.draftBenchViewService.openView();

		draftBenchView.setRequest({
			instruction,
			selectedText,
			sourcePath,
			selectionStart,
			selectionEnd,
			createdAt: new Date().toISOString(),
		});
	}
}
