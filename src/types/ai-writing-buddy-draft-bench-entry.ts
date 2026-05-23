import { AiDraftBenchRequest } from "./ai-writing-buddy-request";
import { AiDraftBenchResponse } from "./ai-writing-buddy-Response";

export type AiDraftBenchSelectionEntry = {
	id: string;
	type: "selection";
	request: AiDraftBenchRequest;
	response: AiDraftBenchResponse;
	createdAt: string;
};

export type AiDraftBenchChatEntry = {
	id: string;
	type: "chat";
	message: string;
	response: AiDraftBenchResponse;
	createdAt: string;
	replyToEntryId?: string;
	replyToSnippet?: string;
};

export type AiDraftBenchEntry = AiDraftBenchSelectionEntry | AiDraftBenchChatEntry;
