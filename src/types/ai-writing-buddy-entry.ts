import { AiWritingBuddyRequest } from "./ai-writing-buddy-request";
import { AiWritingBuddyResponse } from "./ai-writing-buddy-response";

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
};

export type AiWritingBuddyEntry = AiWritingBuddySelectionEntry | AiWritingBuddyChatEntry;
