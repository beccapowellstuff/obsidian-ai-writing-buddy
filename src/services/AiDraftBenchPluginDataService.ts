import { AiDraftBenchSettings, DEFAULT_AI_DRAFT_BENCH_SETTINGS } from "../config/defaultSettings";
import { DEFAULT_PROMPT_TEMPLATES } from "../config/defaultPromptTemplates";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchCurrentSessionData, AiDraftBenchPluginData } from "../types/AiDraftBenchPluginData";

type LegacyPluginData = Partial<AiDraftBenchSettings>;
type SavedPluginData = Partial<AiDraftBenchPluginData> | LegacyPluginData | null;

type LoadedPluginData = {
	settings: AiDraftBenchSettings;
	currentSession: AiDraftBenchCurrentSessionData;
};

export class AiDraftBenchPluginDataService {
	load(rawData: unknown): LoadedPluginData {
		const savedData = rawData as SavedPluginData;
		const savedSettings = this.getSavedSettings(savedData);

		return {
			settings: {
				...DEFAULT_AI_DRAFT_BENCH_SETTINGS,
				...(savedSettings ?? {}),
				promptTemplates: this.mergePromptTemplates(savedSettings?.promptTemplates ?? []),
			},
			currentSession: this.getSavedCurrentSession(savedData),
		};
	}

	createSaveData(settings: AiDraftBenchSettings, currentSession: AiDraftBenchCurrentSessionData): AiDraftBenchPluginData {
		return {
			settings,
			currentSession,
		};
	}

	createEmptyCurrentSession(): AiDraftBenchCurrentSessionData {
		const now = new Date().toISOString();

		return {
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now,
			entryCount: 0,
			entries: [],
		};
	}

	withUpdatedCurrentSessionEntries(currentSession: AiDraftBenchCurrentSessionData, entries: AiDraftBenchEntry[]): AiDraftBenchCurrentSessionData {
		return {
			...currentSession,
			updatedAt: new Date().toISOString(),
			entryCount: entries.length,
			entries,
		};
	}

	private getSavedSettings(savedData: SavedPluginData): Partial<AiDraftBenchSettings> | null {
		if (!savedData) {
			return null;
		}

		if ("settings" in savedData && savedData.settings) {
			return savedData.settings;
		}

		return savedData as LegacyPluginData;
	}

	private getSavedCurrentSession(savedData: SavedPluginData): AiDraftBenchCurrentSessionData {
		if (!savedData || !("currentSession" in savedData) || !savedData.currentSession) {
			return this.createEmptyCurrentSession();
		}

		const entries = Array.isArray(savedData.currentSession.entries) ? savedData.currentSession.entries : [];
		const validEntries = entries.filter((entry): entry is AiDraftBenchEntry => Boolean(entry && entry.id && entry.type && entry.response));
		const fallbackSession = this.createEmptyCurrentSession();

		return {
			id: typeof savedData.currentSession.id === "string" && savedData.currentSession.id.trim() ? savedData.currentSession.id : fallbackSession.id,
			createdAt:
				typeof savedData.currentSession.createdAt === "string" && savedData.currentSession.createdAt.trim()
					? savedData.currentSession.createdAt
					: fallbackSession.createdAt,
			updatedAt:
				typeof savedData.currentSession.updatedAt === "string" && savedData.currentSession.updatedAt.trim()
					? savedData.currentSession.updatedAt
					: fallbackSession.updatedAt,
			entryCount: validEntries.length,
			userTitle: typeof savedData.currentSession.userTitle === "string" && savedData.currentSession.userTitle.trim() ? savedData.currentSession.userTitle : undefined,
			entries: validEntries,
		};
	}

	private mergePromptTemplates(savedTemplates: AiDraftBenchSettings["promptTemplates"]): AiDraftBenchSettings["promptTemplates"] {
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
