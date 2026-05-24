import { AiWritingBuddySelectionEntry } from "../types/ai-writing-buddy-entry";

export class AiWritingBuddySourcePanelRenderer {
	render(container: HTMLElement, entry: AiWritingBuddySelectionEntry): void {
		const sourceEl = container.createEl("div", {
			cls: "ai-writing-buddy-source",
		});

		sourceEl.createEl("div", {
			cls: "ai-writing-buddy-source-label",
			text: "Source",
		});

		sourceEl.createEl("div", {
			cls: "ai-writing-buddy-source-path",
			text: entry.request.sourcePath,
		});

		const selectedDetailsEl = sourceEl.createEl("details", {
			cls: "ai-writing-buddy-details",
		});

		selectedDetailsEl.createEl("summary", {
			text: "Selected text",
		});

		selectedDetailsEl.createEl("div", {
			cls: "ai-writing-buddy-selected-text",
			text: entry.request.selectedText,
		});
	}
}
