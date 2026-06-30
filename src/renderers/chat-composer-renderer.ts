import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { PromptTemplate } from "../types/prompt-template";
import { TemplateMentionService } from "../services/template-mention-service";

type SendChatHandler = (message: string) => void;
type CancelReplyHandler = () => void;

export class AiWritingBuddyChatComposerRenderer {
	private shouldFocusOnNextRender = false;
	private draftMessage = "";
	private readonly templateMentionService = new TemplateMentionService();

	constructor(
		private readonly onSendChat: SendChatHandler,
		private readonly onCancelReply: CancelReplyHandler,
		private readonly getTemplates: () => PromptTemplate[],
	) {}

	requestFocusOnNextRender(): void {
		this.shouldFocusOnNextRender = true;
	}

	isInputFocused(container: HTMLElement): boolean {
		const activeElement = document.activeElement;

		return activeElement instanceof HTMLTextAreaElement && activeElement.hasClass("ai-writing-buddy-chat-input") && container.contains(activeElement);
	}

	render(container: HTMLElement, replyContextText: string | null): void {
		const composerEl = container.createEl("div", {
			cls: "ai-writing-buddy-chat-composer",
		});

		if (replyContextText) {
			this.renderReplyContext(composerEl, replyContextText);
		}

		const templateSuggestionsEl = composerEl.createEl("div", {
			cls: "ai-writing-buddy-template-suggestions",
		});
		templateSuggestionsEl.addClass("is-hidden");

		const inputEl = composerEl.createEl("textarea", {
			cls: "ai-writing-buddy-chat-input",
			attr: {
				placeholder: INTERFACE_TEXT.chat.placeholder,
				rows: "2",
			},
		});
		inputEl.value = this.draftMessage;

		const sendButtonEl = composerEl.createEl("button", {
			cls: "ai-writing-buddy-chat-send",
			text: INTERFACE_TEXT.chat.send,
		});

		const updateSendButtonState = (): void => {
			sendButtonEl.disabled = inputEl.value.trim().length === 0;
		};

		const renderTemplateSuggestions = (): void => {
			templateSuggestionsEl.empty();

			const mention = this.templateMentionService.getActiveMention(inputEl.value, inputEl.selectionStart);

			if (!mention) {
				templateSuggestionsEl.addClass("is-hidden");
				return;
			}

			const matchingTemplates = this.templateMentionService.getMatchingTemplates(this.getTemplates(), mention.query).slice(0, 8);

			if (matchingTemplates.length === 0) {
				templateSuggestionsEl.addClass("is-hidden");
				return;
			}

			templateSuggestionsEl.removeClass("is-hidden");

			for (const template of matchingTemplates) {
				const templateButtonEl = templateSuggestionsEl.createEl("button", {
					cls: "ai-writing-buddy-template-suggestion",
					attr: {
						type: "button",
					},
				});

				templateButtonEl.createSpan({
					cls: "ai-writing-buddy-template-suggestion-name",
					text: template.name,
				});

				templateButtonEl.addEventListener("click", () => {
					const result = this.templateMentionService.insertTemplateMention(inputEl.value, mention, template);

					inputEl.value = result.text;
					this.draftMessage = result.text;
					inputEl.setSelectionRange(result.cursorIndex, result.cursorIndex);

					updateSendButtonState();
					renderTemplateSuggestions();
					inputEl.focus();
				});
			}
		};

		const sendMessage = (): void => {
			const message = inputEl.value.trim();

			if (!message) {
				updateSendButtonState();
				inputEl.focus();
				return;
			}

			this.shouldFocusOnNextRender = true;
			this.draftMessage = "";
			this.onSendChat(message);
			inputEl.value = "";
			updateSendButtonState();
		};

		updateSendButtonState();

		inputEl.addEventListener("input", () => {
			this.draftMessage = inputEl.value;
			updateSendButtonState();
			renderTemplateSuggestions();
		});

		inputEl.addEventListener("click", () => {
			renderTemplateSuggestions();
		});

		inputEl.addEventListener("keyup", () => {
			renderTemplateSuggestions();
		});

		sendButtonEl.addEventListener("click", () => {
			sendMessage();
		});

		inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				sendMessage();
			}
		});

		if (this.shouldFocusOnNextRender) {
			this.shouldFocusOnNextRender = false;

			window.requestAnimationFrame(() => {
				inputEl.focus({
					preventScroll: true,
				});
			});
		}
	}

	private renderReplyContext(container: HTMLElement, replyContextText: string): void {
		const replyEl = container.createEl("div", {
			cls: "ai-writing-buddy-reply-context",
		});

		replyEl.createSpan({
			text: replyContextText,
		});

		const cancelButtonEl = replyEl.createEl("button", {
			text: INTERFACE_TEXT.chat.cancel,
			cls: "ai-writing-buddy-reply-cancel",
		});

		cancelButtonEl.addEventListener("click", () => {
			this.onCancelReply();
		});
	}
}
