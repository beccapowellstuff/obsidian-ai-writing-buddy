import { AiDraftBenchEntry } from "../types/ai-writing-buddy-draft-bench-entry";
import { AiDraftBenchMemorySummary } from "../types/ai-writing-buddy-plugin-data";
import { AiDraftBenchRequest } from "../types/ai-writing-buddy-request";
import { AiDraftBenchResponse } from "../types/ai-writing-buddy-Response";

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
