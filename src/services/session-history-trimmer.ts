import { AiDraftBenchSettings } from "../config/default-settings";
import { AiDraftBenchEntry } from "../types/ai-writing-buddy-draft-bench-entry";

type RecentEntryOptions = {
	excludeEntryId?: string;
};

export class DraftBenchSessionHistoryTrimmer {
	constructor(private readonly settings: AiDraftBenchSettings) {}

	getRecentEntries(entries: AiDraftBenchEntry[], options: RecentEntryOptions = {}): AiDraftBenchEntry[] {
		if (!this.settings.memoryEnabled) {
			return [];
		}

		const maxEntries = Math.max(0, this.settings.recentHistoryMaxEntries);
		const maxCharacters = Math.max(0, this.settings.memoryBudgetCharacters);

		if (maxEntries === 0 || maxCharacters === 0) {
			return [];
		}

		const completedEntries = entries.filter((entry) => !entry.response.isPlaceholder && entry.id !== options.excludeEntryId);
		const selectedEntries: AiDraftBenchEntry[] = [];
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

	private estimateEntryCharacters(entry: AiDraftBenchEntry): number {
		return [this.getEntryUserText(entry), entry.response.text].join("\n").length;
	}

	private getEntryUserText(entry: AiDraftBenchEntry): string {
		if (entry.type === "chat") {
			return entry.message ?? "";
		}

		return entry.request?.instruction ?? "";
	}
}
