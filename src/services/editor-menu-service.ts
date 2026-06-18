import { App, Editor, EditorPosition, EventRef, MarkdownView, Menu, MenuItem, Notice, Plugin } from "obsidian";
import { AiPromptModal, AiPromptModalSubmitValue } from "../modals/ai-prompt-modal";
import { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { AiWritingBuddyViewService } from "./view-service";
import type { PromptTemplate } from "../types/prompt-template";
import type { AiWritingBuddyCurrentSessionData } from "../types/ai-writing-buddy-plugin-data";
import type { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";

type EditorMenuWorkspace = {
	on(name: "editor-menu", callback: (menu: Menu, editor: Editor, view: MarkdownView) => void): EventRef;
};

type AiWritingBuddyPluginWithSettings = Plugin & {
	settings: AiWritingBuddySettings;
	currentSession: AiWritingBuddyCurrentSessionData;
};

type SelectionRequestTemplate = Pick<PromptTemplate, "id" | "name" | "prompt" | "returnsReplacementTextOnly" | "highlightChanges" | "temperature">;
type MenuItemWithSubmenu = MenuItem & {
	setSubmenu?: () => Menu;
};

export class EditorMenuService {
	private readonly plugin: AiWritingBuddyPluginWithSettings;
	private readonly app: App;
	private templateMenu: Menu | null = null;

	constructor(
		plugin: AiWritingBuddyPluginWithSettings,
		private readonly aiWritingBuddyViewService: AiWritingBuddyViewService,
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
			item.setTitle(INTERFACE_TEXT.selectionPrompt.askAboutSelectionWithOptions)
				.setIcon("sparkles")
				.onClick(() => {
					const sourcePath = view.file?.path;

					if (!sourcePath) {
						new Notice(INTERFACE_TEXT.notices.selectedTextSourceNoteNotFound);
						return;
					}

					this.openPromptModal(selectedText, sourcePath, editor.getCursor("from"), editor.getCursor("to"));
				});
		});

		const lastSelectionRequest = this.getLastSelectionRequest();

		if (lastSelectionRequest) {
			menu.addItem((item) => {
				item.setTitle(INTERFACE_TEXT.selectionPrompt.rerunLastRequest)
					.setIcon("repeat")
					.onClick(() => {
						const sourcePath = view.file?.path;

						if (!sourcePath) {
							new Notice(INTERFACE_TEXT.notices.selectedTextSourceNoteNotFound);
							return;
						}

						void this.handleRerunLastRequest(lastSelectionRequest, selectedText, sourcePath, editor.getCursor("from"), editor.getCursor("to"));
					});
			});
		}

		const selectionTemplates = this.plugin.settings.promptTemplates.filter((template) => template.scope === "selection");

		if (selectionTemplates.length === 0) {
			return;
		}

		menu.addItem((item) => {
			item.setTitle(INTERFACE_TEXT.selectionPrompt.askWithTemplateMenu).setIcon("wand-sparkles");

			const submenu = this.createNativeSubmenu(item);

			if (submenu) {
				this.addTemplateMenuItems(submenu, selectionTemplates, selectedText, editor, view);
				return;
			}

			item.onClick((event) => {
					this.openTemplateMenu(event, selectionTemplates, selectedText, editor, view);
				});
		});
	}

	private getLastSelectionRequest(): AiWritingBuddyRequest | null {
		const entries = this.plugin.currentSession.entries;

		for (const entry of [...entries].reverse()) {
			if (entry.type === "selection") {
				return entry.request;
			}
		}

		return null;
	}

	private openPromptModal(selectedText: string, sourcePath: string, selectionStart: EditorPosition, selectionEnd: EditorPosition): void {
		new AiPromptModal(this.app, selectedText, this.plugin.settings.promptTemplates, (value) => {
			void this.handlePromptSubmit(value, sourcePath, selectionStart, selectionEnd);
		}).open();
	}

	private async handlePromptSubmit(value: AiPromptModalSubmitValue, sourcePath: string, selectionStart: EditorPosition, selectionEnd: EditorPosition): Promise<void> {
		await this.submitSelectionRequest(value.instruction, value.selectedText, sourcePath, selectionStart, selectionEnd, value.template);
	}

	private async handleTemplateMenuSubmit(
		template: PromptTemplate,
		selectedText: string,
		sourcePath: string,
		selectionStart: EditorPosition,
		selectionEnd: EditorPosition,
	): Promise<void> {
		await this.submitSelectionRequest("", selectedText, sourcePath, selectionStart, selectionEnd, template);
	}

	private async handleRerunLastRequest(
		lastRequest: AiWritingBuddyRequest,
		selectedText: string,
		sourcePath: string,
		selectionStart: EditorPosition,
		selectionEnd: EditorPosition,
	): Promise<void> {
		await this.submitSelectionRequest(lastRequest.instruction, selectedText, sourcePath, selectionStart, selectionEnd, this.getTemplateForRerun(lastRequest));
	}

	private getTemplateForRerun(request: AiWritingBuddyRequest): SelectionRequestTemplate | undefined {
		if (!request.templateId && !request.templatePrompt) {
			return undefined;
		}

		const currentTemplate = request.templateId ? this.plugin.settings.promptTemplates.find((template) => template.id === request.templateId && template.scope === "selection") : undefined;

		if (currentTemplate) {
			return currentTemplate;
		}

		if (!request.templatePrompt) {
			return undefined;
		}

		return {
			id: request.templateId ?? "previous-template",
			name: request.templateName ?? INTERFACE_TEXT.selectionPrompt.previousTemplate,
			prompt: request.templatePrompt,
			returnsReplacementTextOnly: request.returnsReplacementTextOnly ?? false,
			highlightChanges: request.highlightChanges ?? false,
			temperature: request.temperature ?? 0.7,
		};
	}

	private openTemplateMenu(
		event: MouseEvent | KeyboardEvent,
		templates: PromptTemplate[],
		selectedText: string,
		editor: Editor,
		view: MarkdownView,
	): void {
		this.openTemplateMenuAtTarget(templates, selectedText, editor, view, event);
	}

	private openTemplateMenuAtTarget(
		templates: PromptTemplate[],
		selectedText: string,
		editor: Editor,
		view: MarkdownView,
		event?: MouseEvent | KeyboardEvent,
		anchorEl?: HTMLElement,
	): void {
		const sourcePath = view.file?.path;

		if (!sourcePath) {
			new Notice(INTERFACE_TEXT.notices.selectedTextSourceNoteNotFound);
			return;
		}

		this.templateMenu?.close();

		const templateMenu = new Menu();
		this.templateMenu = templateMenu;

		this.addTemplateMenuItems(templateMenu, templates, selectedText, editor, view);

		const anchorRect = anchorEl?.getBoundingClientRect();

		if (anchorRect) {
			templateMenu.showAtPosition({
				x: anchorRect.right,
				y: anchorRect.top,
				left: false,
			});
			return;
		}

		if (event instanceof MouseEvent) {
			const targetEl = event.currentTarget instanceof HTMLElement ? event.currentTarget : event.target instanceof HTMLElement ? event.target : null;
			const rect = targetEl?.getBoundingClientRect();

			templateMenu.showAtPosition({
				x: rect?.right ?? event.clientX,
				y: rect?.top ?? event.clientY,
				left: false,
			});
			return;
		}

		const targetEl = event?.target instanceof HTMLElement ? event.target : null;
		const rect = targetEl?.getBoundingClientRect();

		templateMenu.showAtPosition({
			x: rect?.right ?? 0,
			y: rect?.top ?? 0,
			left: false,
		});
	}

	private createNativeSubmenu(item: MenuItem): Menu | null {
		return (item as MenuItemWithSubmenu).setSubmenu?.() ?? null;
	}

	private addTemplateMenuItems(menu: Menu, templates: PromptTemplate[], selectedText: string, editor: Editor, view: MarkdownView): void {
		const sourcePath = view.file?.path;

		if (!sourcePath) {
			return;
		}

		for (const template of templates) {
			menu.addItem((item) => {
				item.setTitle(template.name)
					.setIcon("wand-sparkles")
					.onClick(() => {
						void this.handleTemplateMenuSubmit(template, selectedText, sourcePath, editor.getCursor("from"), editor.getCursor("to"));
					});
			});
		}
	}

	private async submitSelectionRequest(
		instruction: string,
		selectedText: string,
		sourcePath: string,
		selectionStart: EditorPosition,
		selectionEnd: EditorPosition,
		template?: SelectionRequestTemplate,
	): Promise<void> {
		const aiWritingBuddyView = await this.aiWritingBuddyViewService.openView();

		const request = {
			instruction,
			selectedText,
			sourcePath,
			selectionStart,
			selectionEnd,
			createdAt: new Date().toISOString(),
			templateId: template?.id,
			templateName: template?.name,
			templatePrompt: template?.prompt,
			returnsReplacementTextOnly: template?.returnsReplacementTextOnly,
			highlightChanges: template?.highlightChanges,
			temperature: template?.temperature,
		};

		aiWritingBuddyView.setRequest(request);
	}
}
