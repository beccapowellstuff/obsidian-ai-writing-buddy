import { AiDraftBenchSettings, DEFAULT_AI_DRAFT_BENCH_SETTINGS } from "../config/defaultSettings";
import { DEFAULT_PROMPT_TEMPLATES } from "../config/defaultPromptTemplates";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchCurrentSessionData, AiDraftBenchMemorySummary, AiDraftBenchPluginData, AiDraftBenchSessionListItem } from "../types/AiDraftBenchPluginData";

type LegacyPluginData = Partial<AiDraftBenchSettings>;
type SavedPluginData = Partial<AiDraftBenchPluginData> | LegacyPluginData | null;

type LoadedPluginData = {
	settings: AiDraftBenchSettings;
	currentSession: AiDraftBenchCurrentSessionData;
	savedSessions: AiDraftBenchCurrentSessionData[];
};

type SessionSwitchResult = {
	currentSession: AiDraftBenchCurrentSessionData;
	savedSessions: AiDraftBenchCurrentSessionData[];
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
			savedSessions: this.getSavedSessions(savedData),
		};
	}

	createSaveData(settings: AiDraftBenchSettings, currentSession: AiDraftBenchCurrentSessionData, savedSessions: AiDraftBenchCurrentSessionData[]): AiDraftBenchPluginData {
		return {
			settings,
			currentSession,
			savedSessions,
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

	withUpdatedCurrentSessionEntries(currentSession: AiDraftBenchCurrentSessionData, entries: AiDraftBenchEntry[], memorySummary?: AiDraftBenchMemorySummary): AiDraftBenchCurrentSessionData {
		return {
			...currentSession,
			updatedAt: new Date().toISOString(),
			entryCount: entries.length,
			memorySummary,
			entries,
		};
	}

	getSessionListItems(savedSessions: AiDraftBenchCurrentSessionData[]): AiDraftBenchSessionListItem[] {
		return savedSessions.map((session) => ({
			id: session.id,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			entryCount: session.entryCount,
			userTitle: session.userTitle,
		}));
	}

	startNewSession(currentSession: AiDraftBenchCurrentSessionData, savedSessions: AiDraftBenchCurrentSessionData[]): SessionSwitchResult {
		return {
			currentSession: this.createEmptyCurrentSession(),
			savedSessions: this.archiveSession(currentSession, savedSessions),
		};
	}

	restoreSavedSession(sessionId: string, currentSession: AiDraftBenchCurrentSessionData, savedSessions: AiDraftBenchCurrentSessionData[]): SessionSwitchResult | null {
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

	private archiveSession(currentSession: AiDraftBenchCurrentSessionData, savedSessions: AiDraftBenchCurrentSessionData[]): AiDraftBenchCurrentSessionData[] {
		if (currentSession.entryCount === 0 && currentSession.entries.length === 0) {
			return savedSessions;
		}

		return [currentSession, ...savedSessions.filter((session) => session.id !== currentSession.id)];
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

		return this.normaliseSession(savedData.currentSession);
	}

	private getSavedSessions(savedData: SavedPluginData): AiDraftBenchCurrentSessionData[] {
		if (!savedData || !("savedSessions" in savedData) || !Array.isArray(savedData.savedSessions)) {
			return [];
		}

		return savedData.savedSessions.map((session) => this.normaliseSession(session)).filter((session) => session.entryCount > 0 || session.entries.length > 0);
	}

	private normaliseSession(session: Partial<AiDraftBenchCurrentSessionData>): AiDraftBenchCurrentSessionData {
		const entries = Array.isArray(session.entries) ? session.entries : [];
		const validEntries = entries.filter((entry): entry is AiDraftBenchEntry => Boolean(entry && entry.id && entry.type && entry.response));
		const fallbackSession = this.createEmptyCurrentSession();
		const memorySummary = this.normaliseMemorySummary(session.memorySummary);

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

	private normaliseMemorySummary(summary: AiDraftBenchMemorySummary | undefined): AiDraftBenchMemorySummary | undefined {
		if (!summary || typeof summary.text !== "string" || !summary.text.trim()) {
			return undefined;
		}

		return {
			text: summary.text,
			updatedAt: typeof summary.updatedAt === "string" && summary.updatedAt.trim() ? summary.updatedAt : new Date().toISOString(),
			sourceEntryId: typeof summary.sourceEntryId === "string" && summary.sourceEntryId.trim() ? summary.sourceEntryId : undefined,
			entryCount: typeof summary.entryCount === "number" && Number.isFinite(summary.entryCount) ? summary.entryCount : 0,
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
