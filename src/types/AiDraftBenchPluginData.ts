import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiDraftBenchEntry } from "./AiDraftBenchEntry";

export type AiDraftBenchCurrentSessionData = {
	id: string;
	createdAt: string;
	updatedAt: string;
	entryCount: number;
	userTitle?: string;
	entries: AiDraftBenchEntry[];
};

export type AiDraftBenchPluginData = {
	settings: AiDraftBenchSettings;
	currentSession: AiDraftBenchCurrentSessionData;
};
