import { App, setIcon } from "obsidian";
import { ClipboardService } from "../services/ClipboardService";
import { SelectionEditService } from "../services/SelectionEditService";
import { AiDraftBenchResponse } from "../types/AiDraftBenchResponse";
import { AiDraftBenchChatEntry, AiDraftBenchEntry, AiDraftBenchSelectionEntry } from "../types/AiDraftBenchEntry";
import { PromptPreviewModal } from "../modals/PromptPreviewModal";

type ReplyHandler = (entryId: string) => void;

export class DraftBenchEntryRenderer {
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

		this.renderSourcePanel(entryEl, entry);
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
			this.renderChangedResponseText(container, entry.request.selectedText, response.text);
			return;
		}

		container.textContent = response.text;
	}

	private shouldHighlightResponseChanges(response: AiDraftBenchResponse, entry: AiDraftBenchEntry): entry is AiDraftBenchSelectionEntry {
		return entry.type === "selection" && entry.request.highlightChanges === true && !response.isPlaceholder && response.text.trim().length > 0;
	}

	private renderChangedResponseText(container: HTMLElement, originalText: string, responseText: string): void {
		const originalTokens = this.getComparableTokens(originalText);
		const responseTokens = this.tokenizeText(responseText);
		const responseComparableTokens = responseTokens.filter((token) => !token.isWhitespace).map((token) => token.text);
		const changedTokenIndexes = this.getChangedTokenIndexes(originalTokens, responseComparableTokens);

		let comparableTokenIndex = 0;

		for (const token of responseTokens) {
			if (token.isWhitespace) {
				container.appendChild(document.createTextNode(token.text));
				continue;
			}

			if (changedTokenIndexes.has(comparableTokenIndex)) {
				const changedEl = container.createSpan({
					cls: "ai-draft-bench-diff-changed",
					text: token.text,
				});

				changedEl.setAttribute("title", "Changed from selected text");
			} else {
				container.appendChild(document.createTextNode(token.text));
			}

			comparableTokenIndex += 1;
		}
	}

	private tokenizeText(text: string): Array<{ text: string; isWhitespace: boolean }> {
		const matches = text.match(/\s+|[^\s]+/g) ?? [];

		return matches.map((token) => ({
			text: token,
			isWhitespace: /^\s+$/.test(token),
		}));
	}

	private getComparableTokens(text: string): string[] {
		return this.tokenizeText(text)
			.filter((token) => !token.isWhitespace)
			.map((token) => token.text);
	}

	private getChangedTokenIndexes(originalTokens: string[], responseTokens: string[]): Set<number> {
		const unchangedResponseIndexes = this.getUnchangedResponseTokenIndexes(originalTokens, responseTokens);
		const changedIndexes = new Set<number>();

		for (let index = 0; index < responseTokens.length; index += 1) {
			if (!unchangedResponseIndexes.has(index)) {
				changedIndexes.add(index);
			}
		}

		return changedIndexes;
	}

	private getUnchangedResponseTokenIndexes(originalTokens: string[], responseTokens: string[]): Set<number> {
		const table = Array.from({ length: originalTokens.length + 1 }, () => Array<number>(responseTokens.length + 1).fill(0));

		for (let originalIndex = originalTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
			for (let responseIndex = responseTokens.length - 1; responseIndex >= 0; responseIndex -= 1) {
				const currentRow = table[originalIndex];
				const nextOriginalRow = table[originalIndex + 1];

				if (!currentRow || !nextOriginalRow) {
					continue;
				}

				if (originalTokens[originalIndex] === responseTokens[responseIndex]) {
					currentRow[responseIndex] = (nextOriginalRow[responseIndex + 1] ?? 0) + 1;
				} else {
					currentRow[responseIndex] = Math.max(nextOriginalRow[responseIndex] ?? 0, currentRow[responseIndex + 1] ?? 0);
				}
			}
		}

		const unchangedResponseIndexes = new Set<number>();
		let originalIndex = 0;
		let responseIndex = 0;

		while (originalIndex < originalTokens.length && responseIndex < responseTokens.length) {
			if (originalTokens[originalIndex] === responseTokens[responseIndex]) {
				unchangedResponseIndexes.add(responseIndex);
				originalIndex += 1;
				responseIndex += 1;
				continue;
			}

			const nextOriginalScore = table[originalIndex + 1]?.[responseIndex] ?? 0;
			const nextResponseScore = table[originalIndex]?.[responseIndex + 1] ?? 0;

			if (nextOriginalScore >= nextResponseScore) {
				originalIndex += 1;
			} else {
				responseIndex += 1;
			}
		}

		return unchangedResponseIndexes;
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
