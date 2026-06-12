import { INTERFACE_TEXT } from "../config/language/en-gb";

type SendChatHandler = (message: string) => void;
type CancelReplyHandler = () => void;

export class AiWritingBuddyChatComposerRenderer {
	private shouldFocusOnNextRender = false;
	private draftMessage = "";

	constructor(
		private readonly onSendChat: SendChatHandler,
		private readonly onCancelReply: CancelReplyHandler,
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
