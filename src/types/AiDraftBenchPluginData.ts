import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiDraftBenchEntry } from "./AiDraftBenchEntry";

export type AiDraftBenchMemorySummary = {
	text: string;
	updatedAt: string;
	sourceEntryId?: string;
	entryCount: number;
};

export type AiDraftBenchCurrentSessionData = {
	id: string;
	createdAt: string;
	updatedAt: string;
	entryCount: number;
	userTitle?: string;
	memorySummary?: AiDraftBenchMemorySummary;
	entries: AiDraftBenchEntry[];
};

export type AiDraftBenchSessionListItem = {
	id: string;
	createdAt: string;
	updatedAt: string;
	entryCount: number;
	userTitle?: string;
};

export type AiDraftBenchPluginData = {
	settings: AiDraftBenchSettings;
	currentSession: AiDraftBenchCurrentSessionData;
	savedSessions: AiDraftBenchCurrentSessionData[];
};
