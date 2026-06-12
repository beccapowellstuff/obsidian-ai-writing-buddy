import { normalizePath } from "obsidian";
import {
	DEFAULT_AI_MEMORY_FILE_NAME,
	MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD,
	MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS,
} from "../config/ai-memory";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../config/default-settings";
import { DEFAULT_PROMPT_TEMPLATES } from "../config/default-prompt-templates";
import type { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import type { AiWritingBuddyCurrentSessionData, AiWritingBuddyMemorySummary, AiWritingBuddyPluginData, AiWritingBuddySessionListItem } from "../types/ai-writing-buddy-plugin-data";
import { normaliseAiMemoryFileName } from "../utils/normalise-ai-memory-file-name";

type LegacyPluginData = Partial<AiWritingBuddySettings>;
type SavedPluginData = Partial<AiWritingBuddyPluginData> | LegacyPluginData | null;

type LoadedPluginData = {
	settings: AiWritingBuddySettings;
	currentSession: AiWritingBuddyCurrentSessionData;
	savedSessions: AiWritingBuddyCurrentSessionData[];
};

type SessionSwitchResult = {
	currentSession: AiWritingBuddyCurrentSessionData;
	savedSessions: AiWritingBuddyCurrentSessionData[];
};

type RawMemorySummary = Partial<AiWritingBuddyMemorySummary> | undefined;

export class AiWritingBuddyPluginDataService {
	load(rawData: unknown): LoadedPluginData {
		const savedData = rawData as SavedPluginData;
		const savedSettings = this.getSavedSettings(savedData);
		const mergedSettings = {
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			...(savedSettings ?? {}),
			contextOptions: {
				...DEFAULT_AI_WRITING_BUDDY_SETTINGS.contextOptions,
				...(savedSettings?.contextOptions ?? {}),
			},
			promptTemplates: this.mergePromptTemplates(savedSettings?.promptTemplates ?? []),
		};

		return {
			settings: this.normaliseSettings(mergedSettings),
			currentSession: this.getSavedCurrentSession(savedData),
			savedSessions: this.getSavedSessions(savedData),
		};
	}

	createSaveData(settings: AiWritingBuddySettings, currentSession: AiWritingBuddyCurrentSessionData, savedSessions: AiWritingBuddyCurrentSessionData[]): AiWritingBuddyPluginData {
		return {
			settings,
			currentSession,
			savedSessions,
		};
	}

	createEmptyCurrentSession(): AiWritingBuddyCurrentSessionData {
		const now = new Date().toISOString();

		return {
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now,
			entryCount: 0,
			userTitle: this.createDefaultSessionTitle(),
			entries: [],
		};
	}

	private createDefaultSessionTitle(): string {
		return new Date().toLocaleString().slice(0, 25);
	}

	withUpdatedCurrentSessionEntries(currentSession: AiWritingBuddyCurrentSessionData, entries: AiWritingBuddyEntry[], memorySummary?: AiWritingBuddyMemorySummary): AiWritingBuddyCurrentSessionData {
		return {
			...currentSession,
			updatedAt: new Date().toISOString(),
			entryCount: entries.length,
			memorySummary,
			entries,
		};
	}

	getSessionListItems(savedSessions: AiWritingBuddyCurrentSessionData[]): AiWritingBuddySessionListItem[] {
		return savedSessions.map((session) => ({
			id: session.id,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			entryCount: session.entryCount,
			userTitle: session.userTitle,
		}));
	}

	startNewSession(currentSession: AiWritingBuddyCurrentSessionData, savedSessions: AiWritingBuddyCurrentSessionData[], sessionTitle?: string): SessionSwitchResult {
		return {
			currentSession: this.createEmptyCurrentSession(),
			savedSessions: this.archiveSession(currentSession, savedSessions, sessionTitle),
		};
	}

	restoreSavedSession(sessionId: string, currentSession: AiWritingBuddyCurrentSessionData, savedSessions: AiWritingBuddyCurrentSessionData[]): SessionSwitchResult | null {
		const selectedSession = savedSessions.find((session) => session.id === sessionId);

		if (!selectedSession) {
			return null;
		}

		const remainingSavedSessions = savedSessions.filter((session) => session.id !== sessionId);

		return {
			currentSession: selectedSession,
			savedSessions: this.archiveSession(currentSession, remainingSavedSessions),
		};
	}

	deleteSavedSession(sessionId: string, savedSessions: AiWritingBuddyCurrentSessionData[]): AiWritingBuddyCurrentSessionData[] {
		return savedSessions.filter((session) => session.id !== sessionId);
	}

	renameSavedSession(sessionId: string, title: string, savedSessions: AiWritingBuddyCurrentSessionData[]): AiWritingBuddyCurrentSessionData[] {
		const trimmedTitle = title.trim().slice(0, 25);

		return savedSessions.map((session) => {
			if (session.id !== sessionId) {
				return session;
			}

			return {
				...session,
				updatedAt: new Date().toISOString(),
				userTitle: trimmedTitle || undefined,
			};
		});
	}

	renameCurrentSession(title: string, currentSession: AiWritingBuddyCurrentSessionData): AiWritingBuddyCurrentSessionData {
		const trimmedTitle = title.trim().slice(0, 25);

		return {
			...currentSession,
			updatedAt: new Date().toISOString(),
			userTitle: trimmedTitle || undefined,
		};
	}

	private archiveSession(currentSession: AiWritingBuddyCurrentSessionData, savedSessions: AiWritingBuddyCurrentSessionData[], sessionTitle?: string): AiWritingBuddyCurrentSessionData[] {
		if (currentSession.entryCount === 0 && currentSession.entries.length === 0) {
			return savedSessions;
		}

		const trimmedTitle = sessionTitle?.trim().slice(0, 25);
		const sessionToArchive: AiWritingBuddyCurrentSessionData = {
			...currentSession,
			updatedAt: new Date().toISOString(),
			userTitle: trimmedTitle || currentSession.userTitle,
		};

		return [sessionToArchive, ...savedSessions.filter((session) => session.id !== currentSession.id)];
	}

	private getSavedSettings(savedData: SavedPluginData): Partial<AiWritingBuddySettings> | null {
		if (!savedData) {
			return null;
		}

		if ("settings" in savedData && savedData.settings) {
			return savedData.settings;
		}

		return savedData as LegacyPluginData;
	}

	private normaliseSettings(settings: AiWritingBuddySettings): AiWritingBuddySettings {
		return {
			...settings,
			aiMemoryFolderPath: this.normaliseFolderPath(settings.aiMemoryFolderPath),
			aiMemoryFileName: this.normaliseMemoryFileName(settings.aiMemoryFileName),
			aiMemoryMaxPromptCharacters: this.getMinimumNumber(settings.aiMemoryMaxPromptCharacters, MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS),
			aiMemoryCleanupWriteThreshold: this.getMinimumNumber(settings.aiMemoryCleanupWriteThreshold, MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD),
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

	private getSavedCurrentSession(savedData: SavedPluginData): AiWritingBuddyCurrentSessionData {
		if (!savedData || !("currentSession" in savedData) || !savedData.currentSession) {
			return this.createEmptyCurrentSession();
		}

		return this.normaliseSession(savedData.currentSession);
	}

	private getSavedSessions(savedData: SavedPluginData): AiWritingBuddyCurrentSessionData[] {
		if (!savedData || !("savedSessions" in savedData) || !Array.isArray(savedData.savedSessions)) {
			return [];
		}

		return savedData.savedSessions.map((session) => this.normaliseSession(session)).filter((session) => session.entryCount > 0 || session.entries.length > 0);
	}

	private normaliseSession(session: Partial<AiWritingBuddyCurrentSessionData>): AiWritingBuddyCurrentSessionData {
		const entries = Array.isArray(session.entries) ? session.entries : [];
		const validEntries = entries.filter((entry): entry is AiWritingBuddyEntry => Boolean(entry && entry.id && entry.type && entry.response));
		const fallbackSession = this.createEmptyCurrentSession();
		const memorySummary = this.normaliseMemorySummary(session.memorySummary as RawMemorySummary);

		return {
			id: typeof session.id === "string" && session.id.trim() ? session.id : fallbackSession.id,
			createdAt: typeof session.createdAt === "string" && session.createdAt.trim() ? session.createdAt : fallbackSession.createdAt,
			updatedAt: typeof session.updatedAt === "string" && session.updatedAt.trim() ? session.updatedAt : fallbackSession.updatedAt,
			entryCount: validEntries.length,
			userTitle: typeof session.userTitle === "string" && session.userTitle.trim() ? session.userTitle : undefined,
			memorySummary,
			entries: validEntries,
		};
	}

	private normaliseMemorySummary(summary: RawMemorySummary): AiWritingBuddyMemorySummary | undefined {
		if (!summary || typeof summary.text !== "string" || !summary.text.trim()) {
			return undefined;
		}

		const text = summary.text;
		const updatedAt = summary.updatedAt;
		const sourceEntryId = summary.sourceEntryId;
		const entryCount = summary.entryCount;

		return {
			text,
			updatedAt: typeof updatedAt === "string" && updatedAt.trim() ? updatedAt : new Date().toISOString(),
			sourceEntryId: typeof sourceEntryId === "string" && sourceEntryId.trim() ? sourceEntryId : undefined,
			entryCount: typeof entryCount === "number" && Number.isFinite(entryCount) ? entryCount : 0,
		};
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
