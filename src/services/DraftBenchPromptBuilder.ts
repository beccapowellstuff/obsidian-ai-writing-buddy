import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiDraftBenchEntry } from "../types/AiDraftBenchEntry";
import { AiDraftBenchRequest } from "../types/AiDraftBenchRequest";

export type DraftBenchChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export type DraftBenchChatPromptRequest = {
	message: string;
	replyToEntry?: AiDraftBenchEntry;
};

export class DraftBenchPromptBuilder {
	constructor(private readonly settings: AiDraftBenchSettings) {}

	buildSelectionPrompt(request: AiDraftBenchRequest): DraftBenchChatMessage[] {
		return [
			...this.buildSystemMessages(this.settings.selectionSystemPrompt),
			{
				role: "user",
				content: ["Selected text:", request.selectedText, "", "User instruction:", request.instruction].join("\n"),
			},
		];
	}

	buildChatPrompt(request: DraftBenchChatPromptRequest): DraftBenchChatMessage[] {
		const messages = this.buildSystemMessages(this.settings.openChatSystemPrompt);

		if (request.replyToEntry) {
			messages.push({
				role: "user",
				content: ["The user is replying to this previous draft response:", request.replyToEntry.response.text, "", "The user's follow-up message:", request.message].join("\n"),
			});

			return messages;
		}

		messages.push({
			role: "user",
			content: request.message,
		});

		return messages;
	}

	private buildSystemMessages(primarySystemPrompt: string): DraftBenchChatMessage[] {
		const messages: DraftBenchChatMessage[] = [];
		const trimmedPrimaryPrompt = primarySystemPrompt.trim();

		if (trimmedPrimaryPrompt) {
			messages.push({
				role: "system",
				content: trimmedPrimaryPrompt,
			});
		}

		if (this.settings.personalityEnabled) {
			const trimmedPersonalityPrompt = this.settings.personalityPrompt.trim();

			if (trimmedPersonalityPrompt) {
				messages.push({
					role: "system",
					content: ["Style guidance:", trimmedPersonalityPrompt, "", "Follow this style guidance unless it conflicts with the user's latest specific instruction."].join("\n"),
				});
			}
		}

		return messages;
	}
}
