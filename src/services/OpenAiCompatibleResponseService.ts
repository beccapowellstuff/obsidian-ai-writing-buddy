import { requestUrl } from "obsidian";
import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";
import { ConversationMemoryStrategy } from "../types/ConversationMemoryStrategy";
import { AiChatRequest, AiResponseService } from "./AiResponseService";
import { ConversationMemoryStrategyService } from "./ConversationMemoryStrategyService";
import { DraftBenchChatMessage, DraftBenchPromptBuilder } from "./DraftBenchPromptBuilder";
import { DraftBenchPromptSizeGuard } from "./DraftBenchPromptSizeGuard";

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
	private readonly promptBuilder: DraftBenchPromptBuilder;
	private readonly promptSizeGuard: DraftBenchPromptSizeGuard;
	private readonly memoryStrategyService = new ConversationMemoryStrategyService();
	private readonly memoryStrategy: ConversationMemoryStrategy;

	constructor(private readonly settings: AiDraftBenchSettings) {
		this.promptBuilder = new DraftBenchPromptBuilder(settings);
		this.promptSizeGuard = new DraftBenchPromptSizeGuard(settings.maxPromptCharacters);
		this.memoryStrategy = this.memoryStrategyService.getStrategy(settings);
	}

	async createSelectionResponse(request: AiDraftBenchRequest): Promise<AiDraftBenchResponse> {
		const responseText = await this.sendChatCompletion(this.promptBuilder.buildSelectionPrompt(request), {
			temperature: request.temperature ?? 0.7,
		});

		return this.createResponse(responseText);
	}

	async createChatResponse(request: AiChatRequest): Promise<AiDraftBenchResponse> {
		const responseText = await this.sendChatCompletion(this.promptBuilder.buildChatPrompt(request), {
			temperature: 0.7,
		});

		return this.createResponse(responseText);
	}

	private async sendChatCompletion(messages: DraftBenchChatMessage[], options: ChatCompletionOptions): Promise<string> {
		this.promptSizeGuard.validate(messages);

		if (this.memoryStrategy.mode === "provider-state") {
			throw new Error("Provider-side conversation state is not implemented for OpenAI-compatible chat completions yet.");
		}

		const baseUrl = this.settings.baseUrl.replace(/\/$/, "");
		const url = `${baseUrl}/chat/completions`;

		if (!this.settings.modelName.trim()) {
			throw new Error("Model name is required.");
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.settings.apiKey.trim()) {
			headers.Authorization = `Bearer ${this.settings.apiKey.trim()}`;
		}

		const response = await requestUrl({
			url,
			method: "POST",
			headers,
			body: JSON.stringify({
				model: this.settings.modelName.trim(),
				messages,
				temperature: options.temperature,
				stream: false,
			}),
			throw: false,
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`AI provider request failed with status ${response.status}.`);
		}

		const data = response.json as OpenAiChatCompletionResponse;
		const content = data.choices?.[0]?.message?.content?.trim();

		if (!content) {
			throw new Error("AI provider returned an empty response.");
		}

		return content;
	}

	private createResponse(text: string): AiDraftBenchResponse {
		return {
			text,
			createdAt: new Date().toISOString(),
			isPlaceholder: false,
		};
	}
}
