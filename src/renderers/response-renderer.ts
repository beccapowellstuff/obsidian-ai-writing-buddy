import { setIcon } from "obsidian";
import { ClipboardService } from "../services/clipboard-service";
import { SelectionEditService } from "../services/selection-edit-service";
import { AiDraftBenchEntry, AiDraftBenchSelectionEntry } from "../types/ai-writing-buddy-draft-bench-entry";
import { AiDraftBenchResponse } from "../types/ai-writing-buddy-Response";
import { ResponseDiffRenderer } from "./response-diff-renderer";

type ReplyHandler = (entryId: string) => void;

export class DraftBenchResponseRenderer {
	private readonly responseDiffRenderer = new ResponseDiffRenderer();

	constructor(
		private readonly clipboardService: ClipboardService,
		private readonly selectionEditService: SelectionEditService,
		private readonly onReply: ReplyHandler,
	) {}

	render(container: HTMLElement, response: AiDraftBenchResponse, entry: AiDraftBenchEntry): void {
		container.createEl("h3", { text: "Draft response" });

		const isResponsePending = response.isPlaceholder && response.text === "Thinking...";
		const isProviderError = response.isPlaceholder && response.text.startsWith("AI provider error.");

		const responseEl = container.createEl("div", {
			cls: response.isPlaceholder ? "ai-draft-bench-response-text ai-draft-bench-response-text-placeholder" : "ai-draft-bench-response-text",
		});

		const responseToolbarEl = responseEl.createEl("div", {
			cls: "ai-draft-bench-response-toolbar",
		});

		const replyActionsEl = responseToolbarEl.createEl("div", {
			cls: "ai-draft-bench-response-actions-left",
		});

		const outputActionsEl = responseToolbarEl.createEl("div", {
			cls: "ai-draft-bench-response-actions-right",
		});

		if (isResponsePending) {
			replyActionsEl.createEl("span", {
				cls: "ai-draft-bench-response-pending-label",
				text: "Generating response...",
			});
		} else {
			this.createActionButton(outputActionsEl, "copy", "Copy response", async () => {
				await this.clipboardService.copyText(response.text);
			});

			if (!isProviderError) {
				this.createActionButton(replyActionsEl, "reply", "Reply to this entry", async () => {
					this.onReply(entry.id);
				});

				if (entry.type === "selection") {
					this.createActionButton(outputActionsEl, "refresh-cw", "Replace selection", async () => {
						await this.selectionEditService.replaceSelection(entry.request, response.text);
					});

					this.createActionButton(outputActionsEl, "plus-circle", "Insert after selection", async () => {
						await this.selectionEditService.insertAfterSelection(entry.request, response.text);
					});
				}
			}
		}

		const responseContentEl = responseEl.createEl("div", {
			cls: "ai-draft-bench-response-content",
		});

		this.renderResponseContent(responseContentEl, response, entry);
	}

	private renderResponseContent(container: HTMLElement, response: AiDraftBenchResponse, entry: AiDraftBenchEntry): void {
		if (this.shouldHighlightResponseChanges(response, entry)) {
			this.responseDiffRenderer.render(container, entry.request.selectedText, response.text);
			return;
		}

		container.textContent = response.text;
	}

	private shouldHighlightResponseChanges(response: AiDraftBenchResponse, entry: AiDraftBenchEntry): entry is AiDraftBenchSelectionEntry {
		return entry.type === "selection" && entry.request.highlightChanges === true && !response.isPlaceholder && response.text.trim().length > 0;
	}

	private createActionButton(container: HTMLElement, iconName: string, label: string, onClick: () => Promise<void>, disabled = false): void {
		const buttonEl = container.createEl("button", {
			cls: "ai-draft-bench-action-button",
			attr: {
				"aria-label": label,
				title: label,
			},
		});

		buttonEl.disabled = disabled;

		const iconEl = buttonEl.createSpan({
			cls: "ai-draft-bench-action-icon",
		});

		setIcon(iconEl, iconName);

		buttonEl.addEventListener("click", () => {
			if (buttonEl.disabled) {
				return;
			}

			void onClick();
		});
	}
}
