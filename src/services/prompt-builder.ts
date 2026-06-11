import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { AiWritingBuddyChatEntry, AiWritingBuddyEntry, AiWritingBuddySelectionEntry } from "../types/ai-writing-buddy-entry";
import type { AiWritingBuddyChatNoteContext } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyMemorySummary } from "../types/ai-writing-buddy-plugin-data";
import type { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import { SELECTION_RESPONSE_OUTPUT_END, SELECTION_RESPONSE_OUTPUT_START } from "./selection-response-output";

export type AiWritingBuddyChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export type AiWritingBuddyChatPromptRequest = {
	message: string;
	replyToEntry?: AiWritingBuddyEntry;
	recentEntries?: AiWritingBuddyEntry[];
	memorySummary?: AiWritingBuddyMemorySummary;
	noteContext?: AiWritingBuddyChatNoteContext;
};

export class AiWritingBuddyPromptBuilder {
	constructor(private readonly settings: AiWritingBuddySettings) {}

	buildSelectionPrompt(request: AiWritingBuddyRequest): AiWritingBuddyChatMessage[] {
		return [
			...this.buildSystemMessages(this.settings.selectionSystemPrompt),
			{
				role: "user",
				content: [
					"[OUTPUT FORMAT]",
					`If you are proposing text that could be copied, inserted, or used to replace the selected note text, put only that proposed note text between ${SELECTION_RESPONSE_OUTPUT_START} and ${SELECTION_RESPONSE_OUTPUT_END}.`,
					"Put comments, explanations, summaries, critique, greetings, caveats, and conversational framing outside those markers.",
					"If you are only commenting on, summarising, or answering questions about the selected text, do not use those markers.",
					"",
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

	buildChatPrompt(request: AiWritingBuddyChatPromptRequest): AiWritingBuddyChatMessage[] {
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

		const noteContext = this.formatNoteContext(request.noteContext);

		if (noteContext) {
			messages.push({
				role: "system",
				content: noteContext,
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

	private formatMemorySummary(summary: AiWritingBuddyMemorySummary | undefined): string {
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

	private formatRecentUserMessageIndex(entries: AiWritingBuddyEntry[] | undefined): string {
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

	private buildRecentHistoryMessages(entries: AiWritingBuddyEntry[] | undefined): AiWritingBuddyChatMessage[] {
		if (!entries || entries.length === 0) {
			return [];
		}

		const messages: AiWritingBuddyChatMessage[] = [];

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

	private getEntryUserText(entry: AiWritingBuddyEntry): string {
		if (entry.type === "chat") {
			return entry.message ?? "";
		}

		return entry.request?.instruction ?? "";
	}

	private getEntryResponseText(entry: AiWritingBuddyEntry): string {
		return [entry.response.commentText, entry.response.text].filter(Boolean).join("\n\n");
	}

	private formatNoteContext(noteContext: AiWritingBuddyChatNoteContext | undefined): string {
		if (!noteContext || noteContext.notes.length === 0) {
			return "";
		}

		return [
			"The user is chatting inside Obsidian.",
			"The following excerpts were retrieved from the user's Obsidian notes. Use only these excerpts as evidence.",
			"If the answer cannot be determined from the retrieved excerpts, say that the available retrieved context is insufficient.",
			"Do not claim to have read note sections that were not provided in these excerpts.",
			"Do not modify or rewrite the note unless the user explicitly asks for draft text in the chat response.",
			"This side-panel chat response must not directly alter any Obsidian file.",
			"",
			"Context scope:",
			this.formatContextScope(noteContext),
			`Retrieval mode: ${noteContext.usedKeywordFallback ? "keyword fallback" : "embedding similarity"}`,
			"",
			"Retrieved excerpts:",
			...noteContext.notes.flatMap((note, index) => [
				`[Source ${index + 1}]`,
				`File: ${note.path || note.title}`,
				`Chunks used: ${note.retrievedChunkCount ?? 0}/${note.totalChunkCount ?? 0}`,
				`Retrieval: ${note.retrievalMode === "keyword" ? "keyword fallback" : "embedding similarity"}`,
				note.content,
				"",
			]),
		].join("\n");
	}

	private formatContextScope(noteContext: AiWritingBuddyChatNoteContext): string {
		const scope = noteContext.scope;
		const baseLabel = this.formatBaseContextScope(scope);

		if (noteContext.includeIndexedRag && scope !== "indexed-notes") {
			return `${baseLabel} + ${INTERFACE_TEXT.header.contextRag}`;
		}

		return baseLabel;
	}

	private formatBaseContextScope(scope: AiWritingBuddyChatNoteContext["scope"]): string {
		if (scope === "indexed-notes") {
			return INTERFACE_TEXT.header.contextIndexedNotes;
		}

		return scope === "open-notes" ? INTERFACE_TEXT.header.contextOpenNotes : INTERFACE_TEXT.header.contextCurrentNote;
	}

	private formatReplyContext(replyToEntry: AiWritingBuddyEntry | undefined): string {
		if (!replyToEntry) {
			return "";
		}

		if (replyToEntry.type === "selection") {
			return this.formatSelectionReplyContext(replyToEntry);
		}

		return this.formatChatReplyContext(replyToEntry);
	}

	private formatSelectionReplyContext(replyToEntry: AiWritingBuddySelectionEntry): string {
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

	private formatChatReplyContext(replyToEntry: AiWritingBuddyChatEntry): string {
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

	private buildSystemMessages(primarySystemPrompt: string): AiWritingBuddyChatMessage[] {
		const messages: AiWritingBuddyChatMessage[] = [];
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

	formatPromptPreview(messages: AiWritingBuddyChatMessage[]): string {
		return messages
			.map((message) => {
				return [`[${message.role.toUpperCase()}]`, message.content].join("\n");
			})
			.join("\n\n---\n\n");
	}
}
