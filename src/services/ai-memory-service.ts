import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import {
	AI_MEMORY_END_MARKER,
	AI_MEMORY_START_MARKER,
	DEFAULT_AI_MEMORY_FILE_NAME,
	DEFAULT_AI_MEMORY_MANAGED_BLOCK,
	DEFAULT_AI_MEMORY_NOTE_CONTENT,
	MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD,
	MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS,
} from "../config/ai-memory";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type {
	AiWritingBuddyManagedMemoryBlock,
	AiWritingBuddyManagedMemoryWriteResult,
	AiWritingBuddyVisibleMemoryContext,
} from "../types/ai-writing-buddy-visible-memory";

type ManagedBlockRange = {
	startIndex: number;
	endIndex: number;
	content: string;
};

export class AiMemoryService {
	constructor(private readonly app: App) {}

	resolveMemoryNotePath(settings: AiWritingBuddySettings): string {
		const folderPath = normalizePath(settings.aiMemoryFolderPath.trim()).replace(/^\/+|\/+$/g, "");
		const fileName = this.ensureMarkdownExtension(this.sanitiseFileName(settings.aiMemoryFileName));

		return normalizePath(folderPath ? `${folderPath}/${fileName}` : fileName);
	}

	normaliseMemorySettings(settings: AiWritingBuddySettings): AiWritingBuddySettings {
		return {
			...settings,
			aiMemoryFolderPath: normalizePath(settings.aiMemoryFolderPath.trim()).replace(/^\/+|\/+$/g, ""),
			aiMemoryFileName: this.ensureMarkdownExtension(this.sanitiseFileName(settings.aiMemoryFileName)),
			aiMemoryMaxPromptCharacters: this.getMinimumNumber(settings.aiMemoryMaxPromptCharacters, MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS),
			aiMemoryCleanupWriteThreshold: this.getMinimumNumber(settings.aiMemoryCleanupWriteThreshold, MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD),
		};
	}

	async createMemoryNote(settings: AiWritingBuddySettings): Promise<void> {
		const filePath = this.resolveMemoryNotePath(settings);
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile instanceof TFile) {
			new Notice(INTERFACE_TEXT.settings.aiMemory.memoryNoteAlreadyExists);
			await this.openFile(existingFile);
			return;
		}

		if (existingFile) {
			throw new Error(INTERFACE_TEXT.settings.aiMemory.memoryPathBlocked(filePath));
		}

		const folderPath = this.getFolderPath(filePath);

		if (folderPath) {
			await this.ensureFolderExists(folderPath);
		}

		const file = await this.app.vault.create(filePath, `${DEFAULT_AI_MEMORY_NOTE_CONTENT}\n`);
		new Notice(INTERFACE_TEXT.settings.aiMemory.memoryNoteCreated(filePath));
		await this.openFile(file);
	}

	async openMemoryNote(settings: AiWritingBuddySettings): Promise<void> {
		const filePath = this.resolveMemoryNotePath(settings);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			new Notice(INTERFACE_TEXT.settings.aiMemory.memoryNoteMissing);
			return;
		}

		await this.openFile(file);
	}

	async repairMemoryNoteManagedBlock(settings: AiWritingBuddySettings): Promise<void> {
		const filePath = this.resolveMemoryNotePath(settings);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			new Notice(INTERFACE_TEXT.settings.aiMemory.memoryNoteMissing);
			return;
		}

		const content = await this.app.vault.read(file);

		if (this.hasManagedBlockMarkers(content)) {
			new Notice(INTERFACE_TEXT.settings.aiMemory.memoryManagedBlockAlreadyExists);
			await this.openFile(file);
			return;
		}

		await this.app.vault.modify(file, this.ensureManagedBlock(content));
		new Notice(INTERFACE_TEXT.settings.aiMemory.memoryManagedBlockAdded);
		await this.openFile(file);
	}

	async readMemoryNote(settings: AiWritingBuddySettings): Promise<AiWritingBuddyVisibleMemoryContext | undefined> {
		const filePath = this.resolveMemoryNotePath(settings);

		if (!settings.aiMemoryEnabled) {
			return undefined;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		const fileExists = file instanceof TFile;

		if (!fileExists) {
			return undefined;
		}

		const content = await this.app.vault.cachedRead(file);
		const managedContent = this.extractManagedBlock(content);
		const isMeaningful = this.isMeaningfulMemoryContent(managedContent);

		if (!isMeaningful) {
			return undefined;
		}

		const maxCharacters = this.getMinimumNumber(settings.aiMemoryMaxPromptCharacters, MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS);
		const result = {
			filePath,
			content: managedContent.slice(0, maxCharacters),
			wasTruncated: managedContent.length > maxCharacters,
		};

		return result;
	}

	async readManagedBlockForUpdate(settings: AiWritingBuddySettings): Promise<AiWritingBuddyManagedMemoryBlock | undefined> {
		const filePath = this.resolveMemoryNotePath(settings);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			return undefined;
		}

		const content = await this.app.vault.cachedRead(file);
		const managedBlock = this.extractManagedBlockRange(content);

		if (!managedBlock) {
			return undefined;
		}

		return {
			filePath,
			content: managedBlock.content,
		};
	}

	async replaceManagedBlockIfUnchanged(
		settings: AiWritingBuddySettings,
		expectedManagedBlock: string,
		replacementManagedBlock: string,
	): Promise<AiWritingBuddyManagedMemoryWriteResult> {
		const filePath = this.resolveMemoryNotePath(settings);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			return "missing";
		}

		const content = await this.app.vault.read(file);
		const managedBlock = this.extractManagedBlockRange(content);

		if (!managedBlock) {
			return "markers-missing";
		}

		if (managedBlock.content !== expectedManagedBlock) {
			return "changed";
		}

		const replacementContent = this.formatReplacementManagedBlock(replacementManagedBlock);
		const nextContent = [content.slice(0, managedBlock.startIndex), replacementContent, content.slice(managedBlock.endIndex)].join("");

		await this.app.vault.modify(file, nextContent);

		return "updated";
	}

	extractManagedBlock(content: string): string {
		const managedBlock = this.extractManagedBlockRange(content);

		return managedBlock?.content.trim() ?? "";
	}

	ensureManagedBlock(content: string): string {
		if (this.hasManagedBlockMarkers(content)) {
			return content;
		}

		const separator = content.endsWith("\n") ? "\n" : "\n\n";
		return `${content}${separator}${DEFAULT_AI_MEMORY_MANAGED_BLOCK}\n`;
	}

	isMeaningfulMemoryContent(content: string): boolean {
		return content
			.split("\n")
			.map((line) => line.trim())
			.some((line) => Boolean(line) && !/^#+\s+/.test(line) && !/^[-*+]\s*$/.test(line) && line !== AI_MEMORY_START_MARKER && line !== AI_MEMORY_END_MARKER);
	}

	private extractManagedBlockRange(content: string): ManagedBlockRange | null {
		const startMarkerIndex = content.indexOf(AI_MEMORY_START_MARKER);
		const endMarkerIndex = content.indexOf(AI_MEMORY_END_MARKER);

		if (startMarkerIndex < 0 || endMarkerIndex < 0 || endMarkerIndex <= startMarkerIndex) {
			return null;
		}

		const startIndex = startMarkerIndex + AI_MEMORY_START_MARKER.length;

		return {
			startIndex,
			endIndex: endMarkerIndex,
			content: content.slice(startIndex, endMarkerIndex),
		};
	}

	private formatReplacementManagedBlock(content: string): string {
		const trimmedContent = content.trim();

		return trimmedContent ? `\n${trimmedContent}\n` : "\n";
	}

	private hasManagedBlockMarkers(content: string): boolean {
		const startIndex = content.indexOf(AI_MEMORY_START_MARKER);
		const endIndex = content.indexOf(AI_MEMORY_END_MARKER);

		return startIndex >= 0 && endIndex > startIndex;
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalisedFolderPath = normalizePath(folderPath);
		const parts = normalisedFolderPath.split("/").filter(Boolean);
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;

			const existingFile = this.app.vault.getAbstractFileByPath(currentPath);

			if (existingFile instanceof TFolder) {
				continue;
			}

			if (existingFile) {
				throw new Error(INTERFACE_TEXT.settings.aiMemory.memoryFolderPathBlocked(currentPath));
			}

			await this.app.vault.createFolder(currentPath);
		}
	}

	private async openFile(file: TFile): Promise<void> {
		await this.app.workspace.getLeaf(false).openFile(file);
	}

	private getFolderPath(filePath: string): string {
		const slashIndex = filePath.lastIndexOf("/");

		return slashIndex >= 0 ? filePath.slice(0, slashIndex) : "";
	}

	private sanitiseFileName(fileName: string): string {
		const cleanedFileName = fileName
			.replace(/[\\/]/g, " ")
			.replace(/\s+/g, " ")
			.trim();

		return cleanedFileName || DEFAULT_AI_MEMORY_FILE_NAME;
	}

	private ensureMarkdownExtension(fileName: string): string {
		return fileName.toLowerCase().endsWith(".md") ? fileName : `${fileName}.md`;
	}

	private getMinimumNumber(value: number, minimum: number): number {
		if (!Number.isFinite(value)) {
			return minimum;
		}

		return Math.max(minimum, Math.floor(value));
	}
}
