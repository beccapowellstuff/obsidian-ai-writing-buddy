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
	recentEntries?: AiDraftBenchEntry[];
};

export class DraftBenchPromptBuilder {
	constructor(private readonly settings: AiDraftBenchSettings) {}

	buildSelectionPrompt(request: AiDraftBenchRequest): DraftBenchChatMessage[] {
		return [
			...this.buildSystemMessages(this.settings.selectionSystemPrompt),
			{
				role: "user",
				content: [
					request.templatePrompt ? "[TEMPLATE INSTRUCTION]" : "",
					request.templatePrompt ?? "",
					request.templatePrompt ? "" : "",
					"[SELECTED TEXT]",
					request.selectedText,
					"",
					request.instruction ? "[USER INSTRUCTION]" : "",
					request.instruction,
				]
					.filter(Boolean)
					.join("\n"),
			},
		];
	}

	buildChatPrompt(request: DraftBenchChatPromptRequest): DraftBenchChatMessage[] {
		const messages = this.buildSystemMessages(this.settings.openChatSystemPrompt);
		const recentUserMessageIndex = this.formatRecentUserMessageIndex(request.recentEntries);

		if (recentUserMessageIndex) {
			messages.push({
				role: "system",
				content: recentUserMessageIndex,
			});
		}

		messages.push(...this.buildRecentHistoryMessages(request.recentEntries));

		const userContentSections = [this.formatReplyContext(request.replyToEntry), request.message].filter(Boolean);

		messages.push({
			role: "user",
			content: userContentSections.join("\n\n"),
		});

		return messages;
	}

	private formatRecentUserMessageIndex(entries: AiDraftBenchEntry[] | undefined): string {
		if (!entries || entries.length === 0) {
			return "";
		}

		const userMessages = entries.map((entry) => this.getEntryUserText(entry).trim()).filter(Boolean);

		if (userMessages.length === 0) {
			return "";
		}

		return [
			"Recent user message index for recall questions:",
			"Use this index when the user asks what they previously said, asked, or discussed.",
			"The messages are listed oldest to newest and do not include the current message.",
			"",
			...userMessages.map((message, index) => `${index + 1}. ${message}`),
		].join("\n");
	}

	private buildRecentHistoryMessages(entries: AiDraftBenchEntry[] | undefined): DraftBenchChatMessage[] {
		if (!entries || entries.length === 0) {
			return [];
		}

		return entries.flatMap((entry): DraftBenchChatMessage[] => {
			const userText = this.getEntryUserText(entry).trim();
			const assistantText = entry.response.text.trim();
			const messages: DraftBenchChatMessage[] = [];

			if (userText) {
				messages.push({
					role: "user",
					content: userText,
				});
			}

			if (assistantText) {
				messages.push({
					role: "assistant",
					content: assistantText,
				});
			}

			return messages;
		});
	}

	private getEntryUserText(entry: AiDraftBenchEntry): string {
		if (entry.type === "chat") {
			return entry.message ?? "";
		}

		return entry.request?.instruction ?? "";
	}

	private formatReplyContext(replyToEntry: AiDraftBenchEntry | undefined): string {
		if (!replyToEntry) {
			return "";
		}

		return ["[EXPLICIT REPLY CONTEXT]", "The user is replying to this previous draft response:", replyToEntry.response.text, "", "[CURRENT USER MESSAGE]"].join("\n");
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

	formatPromptPreview(messages: DraftBenchChatMessage[]): string {
		return messages
			.map((message) => {
				return [`[${message.role.toUpperCase()}]`, message.content].join("\n");
			})
			.join("\n\n---\n\n");
	}
}
