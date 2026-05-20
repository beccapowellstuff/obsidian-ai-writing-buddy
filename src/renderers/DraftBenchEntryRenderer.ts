import { setIcon } from "obsidian";
import { ClipboardService } from "../services/ClipboardService";
import { SelectionEditService } from "../services/SelectionEditService";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";
import { AiDraftBenchChatEntry, AiDraftBenchEntry, AiDraftBenchSelectionEntry } from "../types/AiDraftBenchEntry";

type ReplyHandler = (entryId: string) => void;

export class DraftBenchEntryRenderer {
	constructor(
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

		this.renderSourcePanel(entryEl, entry);
		this.renderInstruction(entryEl, entry.request.instruction);
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

	private renderSourcePanel(container: HTMLElement, entry: AiDraftBenchSelectionEntry): void {
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

	private renderInstruction(container: HTMLElement, instruction: string): void {
		container.createEl("h3", { text: "Instruction" });
		container.createEl("p", { text: instruction });
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

		responseEl.createEl("div", {
			cls: "ai-draft-bench-response-content",
			text: response.text,
		});
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
