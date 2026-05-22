import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchMemorySummary } from "../types/AiDraftBenchPluginData";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";

export type AiChatRequest = {
	message: string;
	replyToEntry?: AiDraftBenchEntry;
	recentEntries?: AiDraftBenchEntry[];
	memorySummary?: AiDraftBenchMemorySummary;
};

export interface AiResponseService {
	createSelectionResponse(request: AiDraftBenchRequest): Promise<AiDraftBenchResponse>;
	createChatResponse(request: AiChatRequest): Promise<AiDraftBenchResponse>;
}
