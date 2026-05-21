import { App, Editor, EditorPosition, EventRef, MarkdownView, Menu, Notice, Plugin } from "obsidian";
import { DraftBenchPromptBuilder } from "./DraftBenchPromptBuilder";
import { AiPromptModal, AiPromptModalSubmitValue } from "../modals/AiPromptModal";
import { AiDraftBenchSettings } from "../config/defaultSettings";
import { DraftBenchViewService } from "./DraftBenchViewService";

type EditorMenuWorkspace = {
	on(name: "editor-menu", callback: (menu: Menu, editor: Editor, view: MarkdownView) => void): EventRef;
};

type AiDraftBenchPluginWithSettings = Plugin & {
	settings: AiDraftBenchSettings;
};

export class EditorMenuService {
	private readonly plugin: AiDraftBenchPluginWithSettings;
	private readonly app: App;

	constructor(
		plugin: AiDraftBenchPluginWithSettings,
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
		new AiPromptModal(this.app, selectedText, this.plugin.settings.promptTemplates, (value) => {
			void this.handlePromptSubmit(value, sourcePath, selectionStart, selectionEnd);
		}).open();
	}

	private async handlePromptSubmit(value: AiPromptModalSubmitValue, sourcePath: string, selectionStart: EditorPosition, selectionEnd: EditorPosition): Promise<void> {
		const draftBenchView = await this.draftBenchViewService.openView();

		const request = {
			instruction: value.instruction,
			selectedText: value.selectedText,
			sourcePath,
			selectionStart,
			selectionEnd,
			createdAt: new Date().toISOString(),
			templateId: value.template?.id,
			templateName: value.template?.name,
			templatePrompt: value.template?.prompt,
			returnsReplacementTextOnly: value.template?.returnsReplacementTextOnly,
			highlightChanges: value.template?.highlightChanges,
			temperature: value.template?.temperature,
		};

		const promptBuilder = new DraftBenchPromptBuilder(this.plugin.settings);
		const promptPreview = promptBuilder.formatPromptPreview(promptBuilder.buildSelectionPrompt(request));

		draftBenchView.setRequest({
			...request,
			promptPreview,
		});
	}
}
