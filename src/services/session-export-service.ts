import { App, Notice, TFolder, normalizePath } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import { AiWritingBuddyCurrentSessionData } from "../types/ai-writing-buddy-plugin-data";

export class AiWritingBuddySessionExportService {
	constructor(private readonly app: App) {}

	async saveSessionToNote(session: AiWritingBuddyCurrentSessionData, sessionLabel: string): Promise<void> {
		const folderPath = INTERFACE_TEXT.sessionExport.folderPath;
		const fileName = `${this.sanitiseFileName(sessionLabel)}.md`;
		const filePath = await this.getAvailableFilePath(`${folderPath}/${fileName}`);
		const content = this.buildSessionMarkdown(session, sessionLabel);

		await this.ensureFolderExists(folderPath);
		await this.app.vault.create(filePath, content);

		new Notice(INTERFACE_TEXT.sessionExport.saveSucceeded(filePath));
	}

	private buildSessionMarkdown(session: AiWritingBuddyCurrentSessionData, sessionLabel: string): string {
		const lines: string[] = [
			`# ${sessionLabel}`,
			"",
			INTERFACE_TEXT.sessionExport.createdLabel(this.formatDate(session.createdAt)),
			INTERFACE_TEXT.sessionExport.updatedLabel(this.formatDate(session.updatedAt)),
			INTERFACE_TEXT.sessionExport.entriesLabel(session.entryCount),
			"",
			"---",
			"",
		];

		for (const entry of session.entries) {
			lines.push(...this.formatEntry(entry));
		}

		return lines.join("\n").trim() + "\n";
	}

	private formatEntry(entry: AiWritingBuddyEntry): string[] {
		if (entry.type === "chat") {
			return [
				INTERFACE_TEXT.sessionExport.userHeading,
				"",
				entry.message?.trim() || INTERFACE_TEXT.sessionExport.noMessageRecorded,
				"",
				INTERFACE_TEXT.sessionExport.assistantHeading,
				"",
				...this.formatResponse(entry.response.commentText, entry.response.text),
				"",
				"---",
				"",
			];
		}

		return [
			INTERFACE_TEXT.sessionExport.selectedTextRequestHeading,
			"",
			INTERFACE_TEXT.sessionExport.sourceLabel(entry.request?.sourcePath ?? INTERFACE_TEXT.sessionExport.unknownSource),
			"",
			INTERFACE_TEXT.sessionExport.templateHeading,
			"",
			entry.request?.templateName?.trim() || INTERFACE_TEXT.sessionExport.noTemplateRecorded,
			"",
			INTERFACE_TEXT.sessionExport.additionalInstructionHeading,
			"",
			entry.request?.instruction?.trim() || INTERFACE_TEXT.sessionExport.noAdditionalInstructionRecorded,
			"",
			INTERFACE_TEXT.sessionExport.promptSentHeading,
			"",
			"```text",
			entry.request?.promptPreview?.trim() || INTERFACE_TEXT.sessionExport.noPromptPreviewRecorded,
			"```",
			"",
			INTERFACE_TEXT.sessionExport.selectedTextHeading,
			"",
			entry.request?.selectedText?.trim() || INTERFACE_TEXT.sessionExport.noSelectedTextRecorded,
			"",
			INTERFACE_TEXT.sessionExport.assistantHeading,
			"",
			...this.formatResponse(entry.response.commentText, entry.response.text),
			"",
			"---",
			"",
		];
	}

	private formatResponse(commentText: string | undefined, responseText: string): string[] {
		const trimmedCommentText = commentText?.trim();
		const trimmedResponseText = responseText.trim();

		if (!trimmedCommentText) {
			return [trimmedResponseText || INTERFACE_TEXT.sessionExport.noResponseRecorded];
		}

		if (!trimmedResponseText) {
			return [INTERFACE_TEXT.sessionExport.assistantCommentsHeading, "", trimmedCommentText];
		}

		return [
			INTERFACE_TEXT.sessionExport.assistantCommentsHeading,
			"",
			trimmedCommentText,
			"",
			INTERFACE_TEXT.sessionExport.proposedContentHeading,
			"",
			trimmedResponseText,
		];
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalisedFolderPath = normalizePath(folderPath);
		const parts = normalisedFolderPath.split("/");
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;

			const existingFile = this.app.vault.getAbstractFileByPath(currentPath);

			if (existingFile instanceof TFolder) {
				continue;
			}

			if (existingFile) {
				throw new Error(INTERFACE_TEXT.sessionExport.folderPathBlocked(currentPath));
			}

			await this.app.vault.createFolder(currentPath);
		}
	}

	private async getAvailableFilePath(filePath: string): Promise<string> {
		const normalisedFilePath = normalizePath(filePath);

		if (!this.app.vault.getAbstractFileByPath(normalisedFilePath)) {
			return normalisedFilePath;
		}

		const dotIndex = normalisedFilePath.lastIndexOf(".");
		const basePath = dotIndex >= 0 ? normalisedFilePath.slice(0, dotIndex) : normalisedFilePath;
		const extension = dotIndex >= 0 ? normalisedFilePath.slice(dotIndex) : "";

		for (let index = 2; index < 1000; index += 1) {
			const candidatePath = `${basePath} ${index}${extension}`;

			if (!this.app.vault.getAbstractFileByPath(candidatePath)) {
				return candidatePath;
			}
		}

		throw new Error(INTERFACE_TEXT.sessionExport.noAvailableFileName);
	}

	private sanitiseFileName(fileName: string): string {
		const cleanedFileName = fileName
			.replace(/[\\/:*?"<>|#^[\]]/g, " ")
			.replace(/\s+/g, " ")
			.trim();

		return cleanedFileName || INTERFACE_TEXT.sessionExport.untitledSessionFileName;
	}

	private formatDate(value: string): string {
		const date = new Date(value);

		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return date.toLocaleString();
	}
}
