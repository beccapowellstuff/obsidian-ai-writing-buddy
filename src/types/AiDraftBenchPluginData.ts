import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiDraftBenchEntry } from "./AiDraftBenchEntry";

export type AiDraftBenchCurrentSessionData = {
	entries: AiDraftBenchEntry[];
};

export type AiDraftBenchPluginData = {
	settings: AiDraftBenchSettings;
	currentSession: AiDraftBenchCurrentSessionData;
};
