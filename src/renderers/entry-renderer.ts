import { App, setIcon, setTooltip } from "obsidian";
import { ClipboardService } from "../services/clipboard-service";
import { SelectionEditService } from "../services/selection-edit-service";
import { AiDraftBenchChatEntry, AiDraftBenchEntry, AiDraftBenchSelectionEntry } from "../types/ai-writing-buddy-entry";
import { PromptPreviewModal } from "../modals/prompt-preview-modal";
import { DraftBenchSourcePanelRenderer } from "./source-panel-renderer";
import { DraftBenchResponseRenderer } from "./response-renderer";

type ReplyHandler = (entryId: string) => void;

export class DraftBenchEntryRenderer {
	private readonly sourcePanelRenderer = new DraftBenchSourcePanelRenderer();
	private readonly responseRenderer = new DraftBenchResponseRenderer(this.clipboardService, this.selectionEditService, this.onReply);

	constructor(
		private readonly app: App,
		private readonly clipboardService: ClipboardService,
		private readonly selectionEditService: SelectionEditService,
		private readonly onReply: ReplyHandler,
	) {}

	renderEntry(container: HTMLElement, entry: AiDraftBenchEntry): void {
		if (entry.type === "selection") {
			this.renderSelectionEntry(container, entry);
			return;
		}

		this.renderChatEntry(container, entry);
	}

	private renderSelectionEntry(container: HTMLElement, entry: AiDraftBenchSelectionEntry): void {
		const entryEl = container.createEl("div", {
			cls: "ai-draft-bench-entry",
		});

		this.sourcePanelRenderer.render(entryEl, entry);
		this.renderTemplateAndInstruction(entryEl, entry);
		this.responseRenderer.render(entryEl, entry.response, entry);
	}

	private renderChatEntry(container: HTMLElement, entry: AiDraftBenchChatEntry): void {
		const entryEl = container.createEl("div", {
			cls: "ai-draft-bench-entry ai-draft-bench-chat-entry",
		});

		entryEl.createEl("h3", {
			text: entry.replyToEntryId ? "Follow-up" : "Chat",
		});

		entryEl.createEl("p", { text: entry.message });

		this.responseRenderer.render(entryEl, entry.response, entry);
	}

	private renderTemplateAndInstruction(container: HTMLElement, entry: AiDraftBenchSelectionEntry): void {
		if (entry.request.templateName) {
			const templateHeaderEl = container.createEl("div", {
				cls: "ai-draft-bench-template-summary",
			});

			const templateTextEl = templateHeaderEl.createEl("div", {
				cls: "ai-draft-bench-template-summary-text",
			});

			templateTextEl.createEl("span", {
				cls: "ai-draft-bench-template-summary-label",
				text: "Template:",
			});

			templateTextEl.createEl("span", {
				cls: "ai-draft-bench-template-summary-name",
				text: entry.request.templateName,
			});

			if (entry.request.promptPreview) {
				const promptButtonEl = templateHeaderEl.createEl("button", {
					cls: "ai-draft-bench-action-button",
					attr: {
						"aria-label": "Show full prompt",
					},
				});

				setTooltip(promptButtonEl, "Show full prompt");

				const iconEl = promptButtonEl.createSpan({
					cls: "ai-draft-bench-action-icon",
				});

				setIcon(iconEl, "file-text");

				promptButtonEl.addEventListener("click", () => {
					new PromptPreviewModal(this.app, entry.request.promptPreview ?? "").open();
				});
			}
		}

		if (entry.request.instruction.trim()) {
			container.createEl("h3", { text: entry.request.templateName ? "Extra instruction" : "Instruction" });
			container.createEl("p", { text: entry.request.instruction });
		}
	}
}
