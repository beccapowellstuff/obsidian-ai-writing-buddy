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
		const userContentSections = [this.formatRecentEntries(request.recentEntries), this.formatReplyContext(request.replyToEntry), "[CURRENT USER MESSAGE]", request.message].filter(Boolean);

		messages.push({
			role: "user",
			content: userContentSections.join("\n\n"),
		});

		return messages;
	}

	private formatRecentEntries(entries: AiDraftBenchEntry[] | undefined): string {
		if (!entries || entries.length === 0) {
			return "";
		}

		return ["[RECENT SESSION HISTORY]", "Use this only as recent conversation context. The current user message below is the request to answer.", "", ...entries.map((entry) => this.formatRecentEntry(entry))].join("\n");
	}

	private formatRecentEntry(entry: AiDraftBenchEntry): string {
		return ["User:", this.getEntryUserText(entry), "", "Assistant:", entry.response.text].filter(Boolean).join("\n");
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

		return ["[EXPLICIT REPLY CONTEXT]", "The user is replying to this previous draft response:", replyToEntry.response.text].join("\n");
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
