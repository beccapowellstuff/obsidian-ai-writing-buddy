import { App, setIcon, setTooltip } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { ClipboardService } from "../services/clipboard-service";
import { SelectionEditService } from "../services/selection-edit-service";
import type { AiWritingBuddyChatEntry, AiWritingBuddyEntry, AiWritingBuddySelectionEntry } from "../types/ai-writing-buddy-entry";
import { PromptPreviewModal } from "../modals/prompt-preview-modal";
import { AiWritingBuddySourcePanelRenderer } from "./source-panel-renderer";
import { AiWritingBuddyResponseRenderer } from "./response-renderer";
import type { ResponseDiffChangeRejection } from "../types/response-diff-change";
import type { AiWritingBuddyUsedContext } from "../types/ai-writing-buddy-context";

type ReplyHandler = (entryId: string) => void;
type RejectChangeHandler = (entryId: string, change: ResponseDiffChangeRejection) => void;
type CancelResponseHandler = (entryId: string) => void;

export class AiWritingBuddyEntryRenderer {
	private readonly sourcePanelRenderer = new AiWritingBuddySourcePanelRenderer();
	private readonly responseRenderer = new AiWritingBuddyResponseRenderer(this.clipboardService, this.selectionEditService, this.onReply, this.onRejectChange, this.onCancelResponse);

	constructor(
		private readonly app: App,
		private readonly clipboardService: ClipboardService,
		private readonly selectionEditService: SelectionEditService,
		private readonly onReply: ReplyHandler,
		private readonly onRejectChange: RejectChangeHandler,
		private readonly onCancelResponse: CancelResponseHandler,
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
		this.renderUsedContext(entryEl, entry);
	}

	private renderUsedContext(container: HTMLElement, entry: AiWritingBuddyChatEntry): void {
		if (!entry.usedContext || entry.usedContext.notes.length === 0) {
			return;
		}

		const contextEl = container.createEl("details", {
			cls: "ai-writing-buddy-used-context",
		});

		contextEl.createEl("summary", {
			cls: "ai-writing-buddy-used-context-heading",
			text: this.getUsedContextSummary(entry.usedContext),
		});

		const listEl = contextEl.createEl("ul");

		for (const note of entry.usedContext.notes) {
			const noteEl = listEl.createEl("li");
			noteEl.createSpan({
				text: note.path || note.title,
			});

			if (note.wasTruncated) {
				noteEl.createSpan({
					cls: "ai-writing-buddy-used-context-note-meta",
					text: ` (${INTERFACE_TEXT.entries.contextTruncated})`,
				});
			}

			if (note.contentSource === "retrieved-chunks" && note.retrievedChunkCount && note.totalChunkCount) {
				noteEl.createSpan({
					cls: "ai-writing-buddy-used-context-note-meta",
					text: ` (${INTERFACE_TEXT.entries.contextRetrievedChunks(note.retrievedChunkCount, note.totalChunkCount)})`,
				});
			}
		}
	}

	private getContextScopeLabel(usedContext: AiWritingBuddyUsedContext): string {
		const baseLabel = this.getBaseContextScopeLabel(usedContext.scope);

		if (usedContext.includeIndexedRag && usedContext.scope !== "indexed-notes") {
			return `${baseLabel} + ${INTERFACE_TEXT.header.contextRag}`;
		}

		return baseLabel;
	}

	private getUsedContextSummary(usedContext: AiWritingBuddyUsedContext): string {
		const scopeLabel = this.getContextScopeLabel(usedContext);
		const chunkCount = usedContext.notes.reduce((total, note) => total + (note.retrievedChunkCount ?? 0), 0);
		const noteCount = usedContext.notes.length;
		const detailText = chunkCount > 0 ? `${noteCount} notes, ${chunkCount} chunks` : `${noteCount} notes`;
		const label = usedContext.usedKeywordFallback ? INTERFACE_TEXT.entries.usedContextScopeWithFallback(scopeLabel) : INTERFACE_TEXT.entries.usedContextScope(scopeLabel);

		return `${label} (${detailText})`;
	}

	private getBaseContextScopeLabel(scope: AiWritingBuddyUsedContext["scope"]): string {
		if (scope === "indexed-notes") {
			return INTERFACE_TEXT.header.contextIndexedNotes;
		}

		return scope === "open-notes" ? INTERFACE_TEXT.header.contextOpenNotes : INTERFACE_TEXT.header.contextCurrentNote;
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
