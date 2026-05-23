import { AiDraftBenchResponse } from "../types/ai-writing-buddy-response";

export function createPlaceholderResponse(text: string): AiDraftBenchResponse {
	return {
		text,
		createdAt: new Date().toISOString(),
		isPlaceholder: true,
	};
}
