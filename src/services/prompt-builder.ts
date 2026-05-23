import type { AiDraftBenchSettings } from "../config/default-settings";
import type { AiDraftBenchChatEntry, AiDraftBenchEntry, AiDraftBenchSelectionEntry } from "../types/ai-writing-buddy-entry";
import type { AiDraftBenchMemorySummary } from "../types/ai-writing-buddy-plugin-data";
import type { AiDraftBenchRequest } from "../types/ai-writing-buddy-request";

export type DraftBenchChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export type DraftBenchChatPromptRequest = {
	message: string;
	replyToEntry?: AiDraftBenchEntry;
	recentEntries?: AiDraftBenchEntry[];
	memorySummary?: AiDraftBenchMemorySummary;
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
		const memorySummary = this.formatMemorySummary(request.memorySummary);
		const recentUserMessageIndex = this.formatRecentUserMessageIndex(request.recentEntries);

		if (memorySummary) {
			messages.push({
				role: "system",
				content: memorySummary,
			});
		}

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

	private formatMemorySummary(summary: AiDraftBenchMemorySummary | undefined): string {
		if (!summary) {
			return "";
		}

		const summaryText = summary.text.trim();

		if (!summaryText) {
			return "";
		}

		return [
			"Older session memory summary:",
			"Use this as compact background context from earlier in the session. Recent history and explicit reply context are more specific and should take priority.",
			"",
			summaryText,
		].join("\n");
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

		const messages: DraftBenchChatMessage[] = [];

		for (const entry of entries) {
			const userText = this.getEntryUserText(entry).trim();
			const assistantText = this.getEntryResponseText(entry).trim();

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
		}

		return messages;
	}

	private getEntryUserText(entry: AiDraftBenchEntry): string {
		if (entry.type === "chat") {
			return entry.message ?? "";
		}

		return entry.request?.instruction ?? "";
	}

	private getEntryResponseText(entry: AiDraftBenchEntry): string {
		return entry.response.text ?? "";
	}

	private formatReplyContext(replyToEntry: AiDraftBenchEntry | undefined): string {
		if (!replyToEntry) {
			return "";
		}

		if (replyToEntry.type === "selection") {
			return this.formatSelectionReplyContext(replyToEntry);
		}

		return this.formatChatReplyContext(replyToEntry);
	}

	private formatSelectionReplyContext(replyToEntry: AiDraftBenchSelectionEntry): string {
		const request = replyToEntry.request;

		return [
			"[EXPLICIT REPLY CONTEXT]",
			"The user explicitly clicked Reply on this earlier selected-text draft entry. Treat this entry as the main context for the current request. Recent session history is secondary.",
			"If the user asks why corrections, edits, or changes were made, explain the proposed draft response below. Do not say the note was physically changed.",
			"",
			"Source note:",
			request.sourcePath,
			"",
			request.templateName ? "Template used:" : "",
			request.templateName ?? "",
			request.templateName ? "" : "",
			request.instruction ? "Original user instruction:" : "",
			request.instruction,
			request.instruction ? "" : "",
			"Original selected text:",
			request.selectedText,
			"",
			"Assistant draft response being replied to:",
			this.getEntryResponseText(replyToEntry),
			"",
			"[CURRENT USER MESSAGE]",
		]
			.filter(Boolean)
			.join("\n");
	}

	private formatChatReplyContext(replyToEntry: AiDraftBenchChatEntry): string {
		const originalUserText = this.getEntryUserText(replyToEntry).trim();
		const assistantResponseText = this.getEntryResponseText(replyToEntry).trim();

		return [
			"[EXPLICIT REPLY CONTEXT]",
			"The user explicitly clicked Reply on this earlier chat entry. Treat this entry as the main context for the current request. Recent session history is secondary.",
			"",
			originalUserText ? "Original user message:" : "",
			originalUserText,
			originalUserText ? "" : "",
			"Assistant response being replied to:",
			assistantResponseText,
			"",
			"[CURRENT USER MESSAGE]",
		]
			.filter(Boolean)
			.join("\n");
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
