import { AiWritingBuddySettings } from "../config/default-settings";
import { createJsonRequestHeaders } from "../utils/create-json-request-headers";
import { createRequestTimeout } from "../utils/create-request-timeout";
import { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { AiWritingBuddyResponse } from "../types/ai-writing-buddy-response";
import { ConversationMemoryStrategy } from "../types/conversation-memory-strategy";
import { AiChatRequest, AiMemoryUpdateRequest, AiResponseRequestOptions, AiResponseService } from "./ai-response-service";
import { ConversationMemoryStrategyService } from "./conversation-memory-strategy-service";
import { AiWritingBuddyChatMessage, AiWritingBuddyPromptBuilder } from "./prompt-builder";
import { AiWritingBuddyPromptSizeGuard } from "./prompt-size-guard";
import { parseSelectionResponseOutput } from "./selection-response-output";

type OpenAiChatCompletionResponse = {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
};

type ChatCompletionOptions = {
	temperature: number;
};

export class OpenAiCompatibleResponseService implements AiResponseService {
	private readonly promptBuilder: AiWritingBuddyPromptBuilder;
	private readonly promptSizeGuard: AiWritingBuddyPromptSizeGuard;
	private readonly memoryStrategyService = new ConversationMemoryStrategyService();
	private readonly memoryStrategy: ConversationMemoryStrategy;

	constructor(private readonly settings: AiWritingBuddySettings) {
		this.promptBuilder = new AiWritingBuddyPromptBuilder(settings);
		this.promptSizeGuard = new AiWritingBuddyPromptSizeGuard(settings.maxPromptCharacters);
		this.memoryStrategy = this.memoryStrategyService.getStrategy(settings);
	}

	async createSelectionResponse(request: AiWritingBuddyRequest, options?: AiResponseRequestOptions): Promise<AiWritingBuddyResponse> {
		const responseText = await this.sendChatCompletion(this.promptBuilder.buildSelectionPrompt(request), {
			temperature: request.temperature ?? 0.7,
		}, options?.signal);

		const output = parseSelectionResponseOutput(responseText);

		return this.createResponse(output.contentText, output.commentText);
	}

	async createChatResponse(request: AiChatRequest, options?: AiResponseRequestOptions): Promise<AiWritingBuddyResponse> {
		const responseText = await this.sendChatCompletion(this.promptBuilder.buildChatPrompt(request), {
			temperature: 0.7,
		}, options?.signal);

		return this.createResponse(responseText);
	}

	async createMemoryUpdateResponse(request: AiMemoryUpdateRequest, options?: AiResponseRequestOptions): Promise<string> {
		return await this.sendChatCompletion(this.promptBuilder.buildMemoryUpdatePrompt(request), {
			temperature: 0.2,
		}, options?.signal);
	}

	private async sendChatCompletion(messages: AiWritingBuddyChatMessage[], options: ChatCompletionOptions, signal?: AbortSignal): Promise<string> {
		this.promptSizeGuard.validate(messages);

		if (this.memoryStrategy.mode === "provider-state") {
			throw new Error("Provider-side conversation state is not implemented for OpenAI-compatible chat completions yet.");
		}

		const baseUrl = this.settings.baseUrl.replace(/\/$/, "");
		const url = `${baseUrl}/chat/completions`;

		if (!this.settings.modelName.trim()) {
			throw new Error("Model name is required.");
		}

		const headers = createJsonRequestHeaders(this.settings.apiKey);

		const { abortController, timeoutId } = createRequestTimeout(
			this.settings.requestTimeoutMs,
			`AI provider request timed out after ${this.settings.requestTimeoutMs}ms.`,
		);

		const abortFromExternalSignal = (): void => {
			abortController.abort(new DOMException("The request was cancelled.", "AbortError"));
		};

		try {
			if (signal?.aborted) {
				abortFromExternalSignal();
			} else {
				signal?.addEventListener("abort", abortFromExternalSignal, { once: true });
			}

			const response = await window.fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model: this.settings.modelName.trim(),
					messages,
					temperature: options.temperature,
					stream: false,
				}),
				signal: abortController.signal,
			});

			if (response.status < 200 || response.status >= 300) {
				throw new Error(`AI provider request failed with status ${response.status}.`);
			}

			const data = (await response.json()) as OpenAiChatCompletionResponse;
			const content = data.choices?.[0]?.message?.content?.trim();

			if (!content) {
				throw new Error("AI provider returned an empty response.");
			}

			return content;
		} catch (error) {
			if (abortController.signal.reason instanceof Error) {
				throw abortController.signal.reason;
			}

			throw error;
		} finally {
			window.clearTimeout(timeoutId);
			signal?.removeEventListener("abort", abortFromExternalSignal);
		}
	}

	private createResponse(text: string, commentText?: string): AiWritingBuddyResponse {
		return {
			text,
			commentText,
			createdAt: new Date().toISOString(),
			isPlaceholder: false,
		};
	}
}
