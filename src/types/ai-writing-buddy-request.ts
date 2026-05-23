import { EditorPosition } from "obsidian";

export type AiDraftBenchRequest = {
	instruction: string;
	selectedText: string;
	sourcePath: string;
	selectionStart: EditorPosition;
	selectionEnd: EditorPosition;
	createdAt: string;
	templateId?: string;
	templateName?: string;
	templatePrompt?: string;
	returnsReplacementTextOnly?: boolean;
	highlightChanges?: boolean;
	promptPreview?: string;
	temperature?: number;
};
