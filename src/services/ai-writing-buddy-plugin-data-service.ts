import type { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";
import type { AiWritingBuddyCurrentSessionData, AiWritingBuddyMemorySummary } from "../types/ai-writing-buddy-plugin-data";

type RawMemorySummary = Partial<AiWritingBuddyMemorySummary> | undefined;

const MAX_PERSISTED_SELECTED_TEXT_CHARACTERS = 40000;
const MAX_PERSISTED_TEMPLATE_PROMPT_CHARACTERS = 20000;
const MAX_PERSISTED_RESPONSE_TEXT_CHARACTERS = 80000;
const TRUNCATED_TEXT_SUFFIX = "\n\n[Session text truncated for storage.]";

export class AiWritingBuddyPluginDataService {
	createEmptyCurrentSession(): AiWritingBuddyCurrentSessionData {
		const now = new Date().toISOString();

		return {
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now,
			entryCount: 0,
			userTitle: this.createDefaultSessionTitle(),
			entries: [],
		};
	}

	private createDefaultSessionTitle(): string {
		return new Date().toLocaleString().slice(0, 25);
	}

	withUpdatedCurrentSessionEntries(currentSession: AiWritingBuddyCurrentSessionData, entries: AiWritingBuddyEntry[], memorySummary?: AiWritingBuddyMemorySummary): AiWritingBuddyCurrentSessionData {
		return {
			...currentSession,
			updatedAt: new Date().toISOString(),
			entryCount: entries.length,
			memorySummary,
			entries,
		};
	}

	renameCurrentSession(title: string, currentSession: AiWritingBuddyCurrentSessionData): AiWritingBuddyCurrentSessionData {
		const trimmedTitle = title.trim().slice(0, 25);

		return {
			...currentSession,
			updatedAt: new Date().toISOString(),
			userTitle: trimmedTitle || undefined,
		};
	}

	normaliseSessionData(session: Partial<AiWritingBuddyCurrentSessionData>): AiWritingBuddyCurrentSessionData {
		const entries = Array.isArray(session.entries) ? session.entries : [];
		const validEntries = entries.filter((entry): entry is AiWritingBuddyEntry => Boolean(entry && entry.id && entry.type && entry.response));
		const fallbackSession = this.createEmptyCurrentSession();
		const memorySummary = this.normaliseMemorySummary(session.memorySummary as RawMemorySummary);

		return {
			id: typeof session.id === "string" && session.id.trim() ? session.id : fallbackSession.id,
			createdAt: typeof session.createdAt === "string" && session.createdAt.trim() ? session.createdAt : fallbackSession.createdAt,
			updatedAt: typeof session.updatedAt === "string" && session.updatedAt.trim() ? session.updatedAt : fallbackSession.updatedAt,
			entryCount: validEntries.length,
			userTitle: typeof session.userTitle === "string" && session.userTitle.trim() ? session.userTitle : undefined,
			memorySummary,
			entries: validEntries,
		};
	}

	compactSessionForStorage(session: AiWritingBuddyCurrentSessionData): AiWritingBuddyCurrentSessionData {
		const entries = session.entries.map((entry) => this.compactEntry(entry));

		return {
			...session,
			entryCount: entries.length,
			entries,
		};
	}

	private normaliseMemorySummary(summary: RawMemorySummary): AiWritingBuddyMemorySummary | undefined {
		if (!summary || typeof summary.text !== "string" || !summary.text.trim()) {
			return undefined;
		}

		const text = summary.text;
		const updatedAt = summary.updatedAt;
		const sourceEntryId = summary.sourceEntryId;
		const entryCount = summary.entryCount;

		return {
			text,
			updatedAt: typeof updatedAt === "string" && updatedAt.trim() ? updatedAt : new Date().toISOString(),
			sourceEntryId: typeof sourceEntryId === "string" && sourceEntryId.trim() ? sourceEntryId : undefined,
			entryCount: typeof entryCount === "number" && Number.isFinite(entryCount) ? entryCount : 0,
		};
	}

	private compactEntry(entry: AiWritingBuddyEntry): AiWritingBuddyEntry {
		const response = {
			...entry.response,
			text: this.truncateText(entry.response.text, MAX_PERSISTED_RESPONSE_TEXT_CHARACTERS),
			commentText: entry.response.commentText ? this.truncateText(entry.response.commentText, MAX_PERSISTED_RESPONSE_TEXT_CHARACTERS) : undefined,
		};

		if (entry.type === "chat") {
			return {
				...entry,
				response,
			};
		}

		return {
			...entry,
			request: {
				...entry.request,
				selectedText: this.truncateText(entry.request.selectedText, MAX_PERSISTED_SELECTED_TEXT_CHARACTERS),
				templatePrompt: entry.request.templatePrompt ? this.truncateText(entry.request.templatePrompt, MAX_PERSISTED_TEMPLATE_PROMPT_CHARACTERS) : undefined,
				promptPreview: undefined,
			},
			response,
		};
	}

	private truncateText(text: string, maxCharacters: number): string {
		if (text.length <= maxCharacters) {
			return text;
		}

		return `${text.slice(0, maxCharacters)}${TRUNCATED_TEXT_SUFFIX}`;
	}
}
