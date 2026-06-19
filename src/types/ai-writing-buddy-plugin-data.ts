import { AiWritingBuddyEntry } from "./ai-writing-buddy-entry";

export type AiWritingBuddyMemorySummary = {
	text: string;
	updatedAt: string;
	sourceEntryId?: string;
	entryCount: number;
};

export type AiWritingBuddyCurrentSessionData = {
	id: string;
	createdAt: string;
	updatedAt: string;
	entryCount: number;
	userTitle?: string;
	memorySummary?: AiWritingBuddyMemorySummary;
	entries: AiWritingBuddyEntry[];
};

export type AiWritingBuddySessionListItem = {
	id: string;
	createdAt: string;
	updatedAt: string;
	entryCount: number;
	userTitle?: string;
};
