import { App, setIcon, setTooltip } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";
import { ClipboardService } from "../services/clipboard-service";
import { SelectionEditService } from "../services/selection-edit-service";
import { AiWritingBuddyChatEntry, AiWritingBuddyEntry, AiWritingBuddySelectionEntry } from "../types/ai-writing-buddy-entry";
import { PromptPreviewModal } from "../modals/prompt-preview-modal";
import { AiWritingBuddySourcePanelRenderer } from "./source-panel-renderer";
import { AiWritingBuddyResponseRenderer } from "./response-renderer";

type ReplyHandler = (entryId: string) => void;

export class AiWritingBuddyEntryRenderer {
	private readonly sourcePanelRenderer = new AiWritingBuddySourcePanelRenderer();
	private readonly responseRenderer = new AiWritingBuddyResponseRenderer(this.clipboardService, this.selectionEditService, this.onReply);

	constructor(
		private readonly app: App,
		private readonly clipboardService: ClipboardService,
		private readonly selectionEditService: SelectionEditService,
		private readonly onReply: ReplyHandler,
	) {}

	renderEntry(container: HTMLElement, entry: AiWritingBuddyEntry): void {
		if (entry.type === "selection") {
			this.renderSelectionEntry(container, entry);
			return;
		}

		this.renderChatEntry(container, entry);
	}

	private renderSelectionEntry(container: HTMLElement, entry: AiWritingBuddySelectionEntry): void {
		const entryEl = container.createEl("div", {
			cls: "ai-writing-buddy-entry",
		});

		this.sourcePanelRenderer.render(entryEl, entry);
		this.renderTemplateAndInstruction(entryEl, entry);
		this.responseRenderer.render(entryEl, entry.response, entry);
	}

	private renderChatEntry(container: HTMLElement, entry: AiWritingBuddyChatEntry): void {
		const entryEl = container.createEl("div", {
			cls: "ai-writing-buddy-entry ai-writing-buddy-chat-entry",
		});

		entryEl.createEl("h3", {
			text: entry.replyToEntryId ? INTERFACE_TEXT.entries.followUp : INTERFACE_TEXT.entries.chat,
		});

		entryEl.createEl("p", { text: entry.message });

		this.responseRenderer.render(entryEl, entry.response, entry);
	}

	private renderTemplateAndInstruction(container: HTMLElement, entry: AiWritingBuddySelectionEntry): void {
		if (entry.request.templateName) {
			const templateHeaderEl = container.createEl("div", {
				cls: "ai-writing-buddy-template-summary",
			});

			const templateTextEl = templateHeaderEl.createEl("div", {
				cls: "ai-writing-buddy-template-summary-text",
			});

			templateTextEl.createEl("span", {
				cls: "ai-writing-buddy-template-summary-label",
				text: INTERFACE_TEXT.entries.templateLabel,
			});

			templateTextEl.createEl("span", {
				cls: "ai-writing-buddy-template-summary-name",
				text: entry.request.templateName,
			});

			if (entry.request.promptPreview) {
				const promptButtonEl = templateHeaderEl.createEl("button", {
					cls: "ai-writing-buddy-action-button",
					attr: {
						"aria-label": INTERFACE_TEXT.entries.showFullPrompt,
					},
				});

				setTooltip(promptButtonEl, INTERFACE_TEXT.entries.showFullPrompt);

				const iconEl = promptButtonEl.createSpan({
					cls: "ai-writing-buddy-action-icon",
				});

				setIcon(iconEl, "file-text");

				promptButtonEl.addEventListener("click", () => {
					new PromptPreviewModal(this.app, entry.request.promptPreview ?? "").open();
				});
			}
		}

		if (entry.request.instruction.trim()) {
			container.createEl("h3", { text: entry.request.templateName ? INTERFACE_TEXT.entries.extraInstruction : INTERFACE_TEXT.entries.instruction });
			container.createEl("p", { text: entry.request.instruction });
		}
	}
}
