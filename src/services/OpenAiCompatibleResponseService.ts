import { requestUrl } from "obsidian";
import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";
import { AiChatRequest, AiResponseService } from "./AiResponseService";
import { DraftBenchChatMessage, DraftBenchPromptBuilder } from "./DraftBenchPromptBuilder";

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

	constructor(private readonly settings: AiDraftBenchSettings) {
		this.promptBuilder = new DraftBenchPromptBuilder(settings);
	}

	async createSelectionResponse(request: AiDraftBenchRequest): Promise<AiDraftBenchResponse> {
		const responseText = await this.sendChatCompletion(this.promptBuilder.buildSelectionPrompt(request), {
			temperature: request.returnsReplacementTextOnly ? 0.1 : 0.7,
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
