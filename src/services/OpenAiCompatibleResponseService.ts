import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiChatRequest } from "./AiResponseService";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";
import { requestUrl } from "obsidian";

type OpenAiChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

type OpenAiChatCompletionResponse = {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
};

export class OpenAiCompatibleResponseService {
	constructor(private readonly settings: AiDraftBenchSettings) {}

	async createSelectionResponse(request: AiDraftBenchRequest): Promise<AiDraftBenchResponse> {
		const responseText = await this.sendChatCompletion([
			{
				role: "system",
				content: this.settings.selectionSystemPrompt,
			},
			{
				role: "user",
				content: ["Selected text:", request.selectedText, "", "User instruction:", request.instruction].join("\n"),
			},
		]);

		return this.createResponse(responseText);
	}

	async createChatResponse(request: AiChatRequest): Promise<AiDraftBenchResponse> {
		const messages: OpenAiChatMessage[] = [
			{
				role: "system",
				content: this.settings.openChatSystemPrompt,
			},
		];

		if (this.settings.personalityEnabled && this.settings.personalityPrompt.trim()) {
			messages.push({
				role: "system",
				content: this.settings.personalityPrompt,
			});
		}

		if (request.replyToEntry) {
			messages.push({
				role: "user",
				content: ["The user is replying to this previous draft response:", request.replyToEntry.response.text, "", "The user's follow-up message:", request.message].join("\n"),
			});
		} else {
			messages.push({
				role: "user",
				content: request.message,
			});
		}

		const responseText = await this.sendChatCompletion(messages);

		return this.createResponse(responseText);
	}

	private async sendChatCompletion(messages: OpenAiChatMessage[]): Promise<string> {
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
				temperature: 0.7,
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
