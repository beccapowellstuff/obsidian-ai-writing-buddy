import { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import { AiWritingBuddyMemorySummary } from "../types/ai-writing-buddy-plugin-data";
import { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { AiWritingBuddyResponse } from "../types/ai-writing-buddy-response";

export type AiChatRequest = {
	message: string;
	replyToEntry?: AiWritingBuddyEntry;
	recentEntries?: AiWritingBuddyEntry[];
	memorySummary?: AiWritingBuddyMemorySummary;
};

export type AiResponseRequestOptions = {
	signal?: AbortSignal;
};

export interface AiResponseService {
	createSelectionResponse(request: AiWritingBuddyRequest, options?: AiResponseRequestOptions): Promise<AiWritingBuddyResponse>;
	createChatResponse(request: AiChatRequest, options?: AiResponseRequestOptions): Promise<AiWritingBuddyResponse>;
}
