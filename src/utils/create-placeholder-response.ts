import { AiWritingBuddyResponse } from "../types/ai-writing-buddy-response";

export function createPlaceholderResponse(text: string): AiWritingBuddyResponse {
	return {
		text,
		createdAt: new Date().toISOString(),
		isPlaceholder: true,
	};
}
