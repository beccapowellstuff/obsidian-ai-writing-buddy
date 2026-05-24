import { AiResponseService, AiChatRequest } from "./ai-response-service";
import { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { AiWritingBuddyResponse } from "../types/ai-writing-buddy-response";

const MOCK_RESPONSE_DELAY_MS = 1200;

export class MockAiResponseService implements AiResponseService {
	async createSelectionResponse(request: AiWritingBuddyRequest): Promise<AiWritingBuddyResponse> {
		await this.waitForMockDelay();

		return {
			text: `Fake AI response for: ${request.instruction}`,
			createdAt: new Date().toISOString(),
			isPlaceholder: false,
		};
	}

	async createChatResponse(request: AiChatRequest): Promise<AiWritingBuddyResponse> {
		await this.waitForMockDelay();

		if (request.replyToEntry) {
			const replyContext = this.getEntryContext(request.replyToEntry);

			return {
				text: `Mock follow-up response to "${replyContext}": ${request.message}`,
				createdAt: new Date().toISOString(),
				isPlaceholder: false,
			};
		}

		return {
			text: `Mock chat response: ${request.message}`,
			createdAt: new Date().toISOString(),
			isPlaceholder: false,
		};
	}

	private getEntryContext(entry: AiChatRequest["replyToEntry"]): string {
		if (!entry) {
			return "unknown entry";
		}

		const text = entry.response.text.replace(/\s+/g, " ").trim();

		if (!text) {
			return "empty response";
		}

		if (text.length <= 70) {
			return text;
		}

		return `${text.slice(0, 67)}...`;
	}

	private async waitForMockDelay(): Promise<void> {
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, MOCK_RESPONSE_DELAY_MS);
		});
	}
}
