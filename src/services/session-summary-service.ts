import type { AiDraftBenchSettings } from "../config/default-settings";
import type { AiDraftBenchEntry } from "../types/ai-writing-buddy-entry";
import type { AiDraftBenchMemorySummary } from "../types/ai-writing-buddy-plugin-data";

export class DraftBenchSessionSummaryService {
	constructor(private readonly settings: AiDraftBenchSettings) {}

	createMemorySummary(entries: AiDraftBenchEntry[]): AiDraftBenchMemorySummary | undefined {
		if (!this.settings.memoryEnabled) {
			return undefined;
		}

		const completedEntries = entries.filter((entry) => !entry.response.isPlaceholder);
		const recentCount = Math.max(0, this.settings.recentHistoryMaxEntries);
		const olderEntries = recentCount > 0 ? completedEntries.slice(0, -recentCount) : completedEntries;

		if (olderEntries.length === 0) {
			return undefined;
		}

		const text = this.buildSummaryText(olderEntries);

		if (!text.trim()) {
			return undefined;
		}

		return {
			text,
			updatedAt: new Date().toISOString(),
			sourceEntryId: olderEntries[olderEntries.length - 1]?.id,
			entryCount: olderEntries.length,
		};
	}

	private buildSummaryText(entries: AiDraftBenchEntry[]): string {
		const maxSummaryCharacters = Math.max(1000, Math.floor(this.settings.memoryBudgetCharacters / 2));
		const lines: string[] = ["Older session context summary:"];

		for (const entry of entries.slice(-8)) {
			const userText = this.getEntryUserText(entry);
			const assistantText = entry.response.text;
			const entrySummary = [userText ? `User: ${this.compactText(userText, 240)}` : "", assistantText ? `Assistant: ${this.compactText(assistantText, 360)}` : ""].filter(Boolean).join("\n");

			if (!entrySummary) {
				continue;
			}

			const nextText = `${lines.join("\n\n")}\n\n${entrySummary}`;

			if (nextText.length > maxSummaryCharacters) {
				break;
			}

			lines.push(entrySummary);
		}

		return lines.join("\n\n");
	}

	private getEntryUserText(entry: AiDraftBenchEntry): string {
		if (entry.type === "chat") {
			return entry.message ?? "";
		}

		return [
			entry.request.templateName ? `Template: ${entry.request.templateName}` : "",
			entry.request.instruction ? `Instruction: ${entry.request.instruction}` : "",
			entry.request.selectedText ? `Selected text: ${entry.request.selectedText}` : "",
		]
			.filter(Boolean)
			.join("\n");
	}

	private compactText(text: string, maxCharacters: number): string {
		const compacted = text.replace(/\s+/g, " ").trim();

		if (compacted.length <= maxCharacters) {
			return compacted;
		}

		return `${compacted.slice(0, Math.max(0, maxCharacters - 3))}...`;
	}
}
