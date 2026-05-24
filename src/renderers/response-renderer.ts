import { setIcon } from "obsidian";
import { ClipboardService } from "../services/clipboard-service";
import { SelectionEditService } from "../services/selection-edit-service";
import { AiWritingBuddyEntry, AiWritingBuddySelectionEntry } from "../types/ai-writing-buddy-entry";
import { AiWritingBuddyResponse } from "../types/ai-writing-buddy-response";
import { ResponseDiffRenderer } from "./response-diff-renderer";

type ReplyHandler = (entryId: string) => void;

export class AiWritingBuddyResponseRenderer {
	private readonly responseDiffRenderer = new ResponseDiffRenderer();

	constructor(
		private readonly clipboardService: ClipboardService,
		private readonly selectionEditService: SelectionEditService,
		private readonly onReply: ReplyHandler,
	) {}

	render(container: HTMLElement, response: AiWritingBuddyResponse, entry: AiWritingBuddyEntry): void {
		container.createEl("h3", { text: "Draft response" });

		const isResponsePending = response.isPlaceholder && response.text === "Thinking...";
		const isProviderError = response.isPlaceholder && response.text.startsWith("AI provider error.");

		const responseEl = container.createEl("div", {
			cls: response.isPlaceholder ? "ai-writing-buddy-response-text ai-writing-buddy-response-text-placeholder" : "ai-writing-buddy-response-text",
		});

		const responseToolbarEl = responseEl.createEl("div", {
			cls: "ai-writing-buddy-response-toolbar",
		});

		const replyActionsEl = responseToolbarEl.createEl("div", {
			cls: "ai-writing-buddy-response-actions-left",
		});

		const outputActionsEl = responseToolbarEl.createEl("div", {
			cls: "ai-writing-buddy-response-actions-right",
		});

		if (isResponsePending) {
			replyActionsEl.createEl("span", {
				cls: "ai-writing-buddy-response-pending-label",
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
			cls: "ai-writing-buddy-response-content",
		});

		this.renderResponseContent(responseContentEl, response, entry);
	}

	private renderResponseContent(container: HTMLElement, response: AiWritingBuddyResponse, entry: AiWritingBuddyEntry): void {
		if (this.shouldHighlightResponseChanges(response, entry)) {
			this.responseDiffRenderer.render(container, entry.request.selectedText, response.text);
			return;
		}

		container.textContent = response.text;
	}

	private shouldHighlightResponseChanges(response: AiWritingBuddyResponse, entry: AiWritingBuddyEntry): entry is AiWritingBuddySelectionEntry {
		return entry.type === "selection" && entry.request.highlightChanges === true && !response.isPlaceholder && response.text.trim().length > 0;
	}

	private createActionButton(container: HTMLElement, iconName: string, label: string, onClick: () => Promise<void>, disabled = false): void {
		const buttonEl = container.createEl("button", {
			cls: "ai-writing-buddy-action-button",
			attr: {
				"aria-label": label,
				title: label,
			},
		});

		buttonEl.disabled = disabled;

		const iconEl = buttonEl.createSpan({
			cls: "ai-writing-buddy-action-icon",
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
