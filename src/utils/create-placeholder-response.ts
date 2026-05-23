import { AiDraftBenchResponse } from "../types/ai-writing-buddy-Response";

export function createPlaceholderResponse(text: string): AiDraftBenchResponse {
	return {
		text,
		createdAt: new Date().toISOString(),
		isPlaceholder: true,
	};
}
