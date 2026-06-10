import { AiResponseService, AiChatRequest, AiResponseRequestOptions } from "./ai-response-service";
import { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { AiWritingBuddyResponse } from "../types/ai-writing-buddy-response";
import { extractSelectionResponseOutput, SELECTION_RESPONSE_OUTPUT_END, SELECTION_RESPONSE_OUTPUT_START } from "./selection-response-output";

const MOCK_RESPONSE_DELAY_MS = 1200;

export class MockAiResponseService implements AiResponseService {
	async createSelectionResponse(request: AiWritingBuddyRequest, options?: AiResponseRequestOptions): Promise<AiWritingBuddyResponse> {
		await this.waitForMockDelay(options?.signal);

		return {
			text: extractSelectionResponseOutput(`${SELECTION_RESPONSE_OUTPUT_START}\nFake AI response for: ${request.instruction}\n${SELECTION_RESPONSE_OUTPUT_END}`),
			createdAt: new Date().toISOString(),
			isPlaceholder: false,
		};
	}

	async createChatResponse(request: AiChatRequest, options?: AiResponseRequestOptions): Promise<AiWritingBuddyResponse> {
		await this.waitForMockDelay(options?.signal);

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

	private async waitForMockDelay(signal?: AbortSignal): Promise<void> {
		if (signal?.aborted) {
			throw new DOMException("The request was cancelled.", "AbortError");
		}

		await new Promise<void>((resolve, reject) => {
			const timeoutId = window.setTimeout(resolve, MOCK_RESPONSE_DELAY_MS);

			signal?.addEventListener(
				"abort",
				() => {
					window.clearTimeout(timeoutId);
					reject(new DOMException("The request was cancelled.", "AbortError"));
				},
				{ once: true },
			);
		});
	}
}
