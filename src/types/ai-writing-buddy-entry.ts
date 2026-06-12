import { AiWritingBuddyRequest } from "./ai-writing-buddy-request";
import { AiWritingBuddyResponse } from "./ai-writing-buddy-response";
import type { AiWritingBuddyUsedContext } from "./ai-writing-buddy-context";
import type { AiWritingBuddyUsedMemory } from "./ai-writing-buddy-visible-memory";

export type AiWritingBuddySelectionEntry = {
	id: string;
	type: "selection";
	request: AiWritingBuddyRequest;
	response: AiWritingBuddyResponse;
	createdAt: string;
};

export type AiWritingBuddyChatEntry = {
	id: string;
	type: "chat";
	message: string;
	response: AiWritingBuddyResponse;
	createdAt: string;
	replyToEntryId?: string;
	replyToSnippet?: string;
	usedMemory?: AiWritingBuddyUsedMemory;
	usedContext?: AiWritingBuddyUsedContext;
};

export type AiWritingBuddyEntry = AiWritingBuddySelectionEntry | AiWritingBuddyChatEntry;
