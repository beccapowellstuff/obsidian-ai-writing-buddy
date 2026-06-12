import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { AiWritingBuddyChatEntry, AiWritingBuddyEntry, AiWritingBuddySelectionEntry } from "../types/ai-writing-buddy-entry";
import type { AiWritingBuddyChatNoteContext } from "../types/ai-writing-buddy-context";
import type { AiWritingBuddyMemorySummary } from "../types/ai-writing-buddy-plugin-data";
import type { AiWritingBuddyRequest } from "../types/ai-writing-buddy-request";
import type { AiWritingBuddyVisibleMemoryContext } from "../types/ai-writing-buddy-visible-memory";
import type { AiMemoryUpdateRequest } from "./ai-response-service";
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
	visibleMemory?: AiWritingBuddyVisibleMemoryContext;
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
		const visibleMemory = this.formatVisibleMemory(request.visibleMemory);
		const memorySummary = this.formatMemorySummary(request.memorySummary);
		const recentUserMessageIndex = this.formatRecentUserMessageIndex(request.recentEntries);

		if (visibleMemory) {
			messages.push({
				role: "system",
				content: visibleMemory,
			});
		}

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

	buildMemoryUpdatePrompt(request: AiMemoryUpdateRequest): AiWritingBuddyChatMessage[] {
		return [
			{
				role: "system",
				content: [
					"You update AI Writing Buddy's visible memory note.",
					"",
					"The memory note is user-editable Markdown. You may update only the managed memory block.",
					"",
					"Compare the latest exchange against the current managed memory block.",
					"Only update memory when the latest user message or assistant response adds, corrects, removes, or meaningfully clarifies durable information.",
					"Preserve existing durable memory unless the latest exchange clearly contradicts it or the user explicitly asks you to forget, remove, clean up, or rewrite it.",
					"Do not duplicate existing memory.",
					"Do not treat content repeated from visible memory as new information.",
					"Do not re-save existing memory merely because it appeared in the latest assistant response.",
					"Do not summarise the whole memory block down to only the latest topic.",
					"",
					"Save only durable information that will likely help future chats, such as:",
					"- user preferences",
					"- writing style preferences",
					"- ongoing projects",
					"- project-specific facts",
					"- recurring instructions",
					"- things the user wants avoided",
					"",
					"Do not save:",
					"- temporary chat details",
					"- ordinary facts from retrieved note context unless they are useful ongoing project memory",
					"- guesses",
					"- private or sensitive details unless the user clearly asked for them to be remembered",
					"- duplicates",
					"",
					"You may reorganise the managed memory block using whatever Markdown headings and groups make the memory clearer.",
					"You may create new headings, rename headings, merge headings, remove empty headings, and move memory items between headings.",
					"",
					"Keep the memory useful for future conversations. Prefer clear grouped bullets over a long unstructured list.",
					"",
					"If no update is needed, return exactly:",
					"NO_CHANGE",
					"",
					"Otherwise return one strict raw JSON object with exactly these three arrays:",
					'{ "add": [], "update": [], "remove": [] }',
					"",
					"Add operations have this shape:",
					'{ "heading": "User preferences", "text": "User prefers British English." }',
					"",
					"Update operations have this shape:",
					'{ "heading": "Current projects", "match": "User is considering visible AI memory.", "replacement": "User has implemented visible AI memory in AI Writing Buddy." }',
					"",
					"Remove operations have this shape:",
					'{ "heading": "User preferences", "match": "User prefers American English." }',
					"",
					"All three arrays must be present, even when empty.",
					"Each operation applies to one Markdown bullet only.",
					"Use bullet text without the leading dash.",
					"Use heading text without Markdown # characters.",
					"Do not submit an operation when the same memory is already represented accurately.",
					"Prefer update over remove-plus-add when correcting or clarifying existing memory.",
					"Use remove only when the latest user message clearly asks to forget, remove, or retract that memory.",
					"Limit the response to no more than 5 additions, 3 updates, 3 removals, and 8 total operations.",
					"",
					"Do not include the outer marker comments.",
					"Do not include explanations or commentary.",
					"Do not wrap the response in a code fence.",
				].join("\n"),
			},
			{
				role: "user",
				content: [
					"Current managed memory:",
					request.currentManagedMemory.trim() || "_No managed memory content yet._",
					"",
					"Latest user message:",
					request.latestUserMessage,
					"",
					"Latest assistant response:",
					request.latestAssistantResponse,
					"",
					request.usedContextSummary ? "Used context summary:" : "",
					request.usedContextSummary ?? "",
				]
					.filter(Boolean)
					.join("\n"),
			},
		];
	}

	private formatVisibleMemory(memory: AiWritingBuddyVisibleMemoryContext | undefined): string {
		if (!memory || !memory.content.trim()) {
			return "";
		}

		const lines = [
			"Visible AI memory:",
			"The following memory comes from the user's editable AI memory note.",
			"Use it as background preference and project context, not as evidence from notes.",
			"RAG note excerpts, when present, are the evidence-bearing note context.",
			"Do not treat memory as more important than the user's latest message.",
			"Do not claim the user said something today just because it appears in memory.",
			"Do not modify the memory note from this response.",
		];

		if (memory.wasTruncated) {
			lines.push("Memory content was shortened because it exceeded the configured memory character limit.");
		}

		return [
			...lines,
			"",
			"Memory note:",
			memory.filePath,
			"",
			"Memory content:",
			memory.content,
		].join("\n");
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
