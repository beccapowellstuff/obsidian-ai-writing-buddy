import { App, setIcon } from "obsidian";
import { ClipboardService } from "../services/ClipboardService";
import { SelectionEditService } from "../services/SelectionEditService";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";
import { AiDraftBenchChatEntry, AiDraftBenchEntry, AiDraftBenchSelectionEntry } from "../types/AiDraftBenchEntry";
import { PromptPreviewModal } from "../modals/PromptPreviewModal";
import { DraftBenchSourcePanelRenderer } from "./DraftBenchSourcePanelRenderer";
import { ResponseDiffRenderer } from "./ResponseDiffRenderer";

type ReplyHandler = (entryId: string) => void;

export class DraftBenchEntryRenderer {
	private readonly sourcePanelRenderer = new DraftBenchSourcePanelRenderer();
	private readonly responseDiffRenderer = new ResponseDiffRenderer();
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
		this.renderResponse(entryEl, entry.response, entry);
	}

	private renderChatEntry(container: HTMLElement, entry: AiDraftBenchChatEntry): void {
		const entryEl = container.createEl("div", {
			cls: "ai-draft-bench-entry ai-draft-bench-chat-entry",
		});

		entryEl.createEl("h3", {
			text: entry.replyToEntryId ? "Follow-up" : "Chat",
		});

		entryEl.createEl("p", { text: entry.message });

		this.renderResponse(entryEl, entry.response, entry);
	}

	private renderTemplateAndInstruction(container: HTMLElement, entry: AiDraftBenchSelectionEntry): void {
		if (entry.request.templateName) {
			const templateHeaderEl = container.createEl("div", {
				cls: "ai-draft-bench-template-header",
			});

			templateHeaderEl.createEl("h3", { text: "Template" });

			if (entry.request.promptPreview) {
				const promptButtonEl = templateHeaderEl.createEl("button", {
					cls: "ai-draft-bench-action-button",
					attr: {
						"aria-label": "Show full prompt",
						title: "Show full prompt",
					},
				});

				const iconEl = promptButtonEl.createSpan({
					cls: "ai-draft-bench-action-icon",
				});

				setIcon(iconEl, "file-text");

				promptButtonEl.addEventListener("click", () => {
					new PromptPreviewModal(this.app, entry.request.promptPreview ?? "").open();
				});
			}

			container.createEl("p", { text: entry.request.templateName });
		}

		if (entry.request.instruction.trim()) {
			container.createEl("h3", { text: entry.request.templateName ? "Extra instruction" : "Instruction" });
			container.createEl("p", { text: entry.request.instruction });
		}
	}

	private renderResponse(container: HTMLElement, response: AiDraftBenchResponse, entry: AiDraftBenchEntry): void {
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
