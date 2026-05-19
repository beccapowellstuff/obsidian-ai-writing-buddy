import { App, Notice, TFile } from "obsidian";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";

type ValidatedSelectionContext = {
	file: TFile;
	currentContent: string;
	startOffset: number;
	endOffset: number;
};

export class SelectionEditService {
	constructor(private readonly app: App) {}

	async replaceSelection(
		request: AiDraftBenchRequest,
		replacementText: string
	): Promise<void> {
		const context = await this.getValidatedSelectionContext(
			request,
			"Replacement cancelled."
		);

		if (!context) {
			return;
		}

		const updatedContent =
			context.currentContent.slice(0, context.startOffset) +
			replacementText +
			context.currentContent.slice(context.endOffset);

		await this.app.vault.modify(context.file, updatedContent);

		new Notice("Selection replaced.");
	}

	async insertAfterSelection(
		request: AiDraftBenchRequest,
		textToInsert: string
	): Promise<void> {
		const context = await this.getValidatedSelectionContext(
			request,
			"Insert cancelled."
		);

		if (!context) {
			return;
		}

		const updatedContent =
			context.currentContent.slice(0, context.endOffset) +
			"\n\n" +
			textToInsert +
			context.currentContent.slice(context.endOffset);

		await this.app.vault.modify(context.file, updatedContent);

		new Notice("Response inserted after selection.");
	}

	private async getValidatedSelectionContext(
		request: AiDraftBenchRequest,
		cancelMessage: string
	): Promise<ValidatedSelectionContext | null> {
		const file = this.app.vault.getAbstractFileByPath(request.sourcePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find the source note.");
			return null;
		}

		const currentContent = await this.app.vault.read(file);

		const startOffset = this.positionToOffset(
			currentContent,
			request.selectionStart.line,
			request.selectionStart.ch
		);

		const endOffset = this.positionToOffset(
			currentContent,
			request.selectionEnd.line,
			request.selectionEnd.ch
		);

		const currentSelectedText = currentContent.slice(startOffset, endOffset);

		if (currentSelectedText !== request.selectedText) {
			new Notice(`Original selected text has changed. ${cancelMessage}`);
			return null;
		}

		return {
			file,
			currentContent,
			startOffset,
			endOffset,
		};
	}

	private positionToOffset(content: string, line: number, ch: number): number {
		const lines = content.split("\n");

		let offset = 0;

		for (let i = 0; i < line; i++) {
			const currentLine = lines[i];

			if (currentLine === undefined) {
				return content.length;
			}

			offset += currentLine.length + 1;
		}

		return offset + ch;
	}
}