import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";

export function createPlaceholderResponse(text: string): AiDraftBenchResponse {
	return {
		text,
		createdAt: new Date().toISOString(),
		isPlaceholder: true,
	};
}
