import { normalizePath } from "obsidian";
import {
	DEFAULT_AI_MEMORY_FILE_NAME,
	MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD,
	MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS,
} from "../config/ai-memory";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../config/default-settings";
import { DEFAULT_PROMPT_TEMPLATES } from "../config/default-prompt-templates";
import { normaliseAiMemoryFileName } from "../utils/normalise-ai-memory-file-name";

export class AiWritingBuddySettingsService {
	createDefaultSettings(): AiWritingBuddySettings {
		return this.normaliseSettings({});
	}

	normaliseSettings(settings: Partial<AiWritingBuddySettings> | null | undefined): AiWritingBuddySettings {
		const savedContextOptions = settings?.contextOptions;
		const hadIndexedNotesScope = savedContextOptions?.scope === "indexed-notes";
		const mergedSettings = {
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			...(settings ?? {}),
			contextOptions: {
				...DEFAULT_AI_WRITING_BUDDY_SETTINGS.contextOptions,
				...(savedContextOptions ?? {}),
				scope: hadIndexedNotesScope ? "current-note" : (savedContextOptions?.scope ?? DEFAULT_AI_WRITING_BUDDY_SETTINGS.contextOptions.scope),
				includeIndexedRag: hadIndexedNotesScope || (savedContextOptions?.includeIndexedRag ?? DEFAULT_AI_WRITING_BUDDY_SETTINGS.contextOptions.includeIndexedRag),
			},
			promptTemplates: this.mergePromptTemplates(settings?.promptTemplates ?? []),
		};

		return {
			...mergedSettings,
			aiMemoryFolderPath: this.normaliseFolderPath(mergedSettings.aiMemoryFolderPath),
			aiMemoryFileName: this.normaliseMemoryFileName(mergedSettings.aiMemoryFileName),
			aiMemoryMaxPromptCharacters: this.getMinimumNumber(mergedSettings.aiMemoryMaxPromptCharacters, MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS),
			aiMemoryCleanupWriteThreshold: this.getMinimumNumber(mergedSettings.aiMemoryCleanupWriteThreshold, MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD),
		};
	}

	private normaliseFolderPath(folderPath: unknown): string {
		if (typeof folderPath !== "string") {
			return DEFAULT_AI_WRITING_BUDDY_SETTINGS.aiMemoryFolderPath;
		}

		return normalizePath(folderPath.trim()).replace(/^\/+|\/+$/g, "");
	}

	private normaliseMemoryFileName(fileName: unknown): string {
		if (typeof fileName !== "string") {
			return DEFAULT_AI_MEMORY_FILE_NAME;
		}

		return normaliseAiMemoryFileName(fileName);
	}

	private getMinimumNumber(value: unknown, minimum: number): number {
		if (typeof value !== "number") {
			return minimum;
		}

		if (!Number.isFinite(value)) {
			return minimum;
		}

		return Math.max(minimum, Math.floor(value));
	}

	private mergePromptTemplates(savedTemplates: AiWritingBuddySettings["promptTemplates"]): AiWritingBuddySettings["promptTemplates"] {
		const savedUserTemplates = savedTemplates.filter((template) => !template.isBuiltIn);
		const savedBuiltInTemplates = savedTemplates.filter((template) => template.isBuiltIn);

		const mergedBuiltInTemplates = DEFAULT_PROMPT_TEMPLATES.map((defaultTemplate) => {
			const savedTemplate = savedBuiltInTemplates.find((template) => template.id === defaultTemplate.id);

			return {
				...defaultTemplate,
				...(savedTemplate ?? {}),
				highlightChanges: defaultTemplate.highlightChanges,
				temperature: defaultTemplate.temperature,
				prompt: defaultTemplate.prompt,
				returnsReplacementTextOnly: defaultTemplate.returnsReplacementTextOnly,
				updatedAt: defaultTemplate.updatedAt,
			};
		});

		return [...mergedBuiltInTemplates, ...savedUserTemplates];
	}
}
