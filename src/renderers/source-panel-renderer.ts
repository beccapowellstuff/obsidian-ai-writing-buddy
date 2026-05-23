import { AiDraftBenchSelectionEntry } from "../types/ai-writing-buddy-draft-bench-entry";

export class DraftBenchSourcePanelRenderer {
	render(container: HTMLElement, entry: AiDraftBenchSelectionEntry): void {
		const sourceEl = container.createEl("div", {
			cls: "ai-draft-bench-source",
		});

		sourceEl.createEl("div", {
			cls: "ai-draft-bench-source-label",
			text: "Source",
		});

		sourceEl.createEl("div", {
			cls: "ai-draft-bench-source-path",
			text: entry.request.sourcePath,
		});

		const selectedDetailsEl = sourceEl.createEl("details", {
			cls: "ai-draft-bench-details",
		});

		selectedDetailsEl.createEl("summary", {
			text: "Selected text",
		});

		selectedDetailsEl.createEl("div", {
			cls: "ai-draft-bench-selected-text",
			text: entry.request.selectedText,
		});
	}
}
