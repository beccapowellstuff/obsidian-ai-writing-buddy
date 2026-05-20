import { AiResponseService, AiChatRequest } from "./AiResponseService";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";

const MOCK_RESPONSE_DELAY_MS = 1200;

export class MockAiResponseService implements AiResponseService {
	async createSelectionResponse(request: AiDraftBenchRequest): Promise<AiDraftBenchResponse> {
		await this.waitForMockDelay();

		return {
			text: `Fake AI response for: ${request.instruction}`,
			createdAt: new Date().toISOString(),
			isPlaceholder: true,
		};
	}

	async createChatResponse(request: AiChatRequest): Promise<AiDraftBenchResponse> {
		await this.waitForMockDelay();

		return {
			text: request.replyToEntry ? `Mock follow-up response: ${request.message}` : `Mock chat response: ${request.message}`,
			createdAt: new Date().toISOString(),
			isPlaceholder: true,
		};
	}

	private async waitForMockDelay(): Promise<void> {
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, MOCK_RESPONSE_DELAY_MS);
		});
	}
}
