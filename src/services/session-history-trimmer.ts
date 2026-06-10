import { AiWritingBuddySettings } from "../config/default-settings";
import { AiWritingBuddyEntry } from "../types/ai-writing-buddy-entry";

type RecentEntryOptions = {
	excludeEntryId?: string;
};

export class AiWritingBuddySessionHistoryTrimmer {
	constructor(private readonly settings: AiWritingBuddySettings) {}

	getRecentEntries(entries: AiWritingBuddyEntry[], options: RecentEntryOptions = {}): AiWritingBuddyEntry[] {
		if (!this.settings.memoryEnabled) {
			return [];
		}

		const maxEntries = Math.max(0, this.settings.recentHistoryMaxEntries);
		const maxCharacters = Math.max(0, this.settings.memoryBudgetCharacters);

		if (maxEntries === 0 || maxCharacters === 0) {
			return [];
		}

		const completedEntries = entries.filter((entry) => !entry.response.isPlaceholder && entry.id !== options.excludeEntryId);
		const selectedEntries: AiWritingBuddyEntry[] = [];
		let usedCharacters = 0;

		for (const entry of completedEntries.slice(-maxEntries).reverse()) {
			const entryCharacters = this.estimateEntryCharacters(entry);

			if (entryCharacters > maxCharacters) {
				continue;
			}

			if (usedCharacters + entryCharacters > maxCharacters) {
				continue;
			}

			selectedEntries.push(entry);
			usedCharacters += entryCharacters;
		}

		return selectedEntries.reverse();
	}

	private estimateEntryCharacters(entry: AiWritingBuddyEntry): number {
		return [this.getEntryUserText(entry), entry.response.commentText, entry.response.text].filter(Boolean).join("\n").length;
	}

	private getEntryUserText(entry: AiWritingBuddyEntry): string {
		if (entry.type === "chat") {
			return entry.message ?? "";
		}

		return entry.request?.instruction ?? "";
	}
}
