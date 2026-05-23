type SendChatHandler = (message: string) => void;
type CancelReplyHandler = () => void;

export class DraftBenchChatComposerRenderer {
	private shouldFocusOnNextRender = false;

	constructor(
		private readonly onSendChat: SendChatHandler,
		private readonly onCancelReply: CancelReplyHandler,
	) {}

	requestFocusOnNextRender(): void {
		this.shouldFocusOnNextRender = true;
	}

	render(container: HTMLElement, replyContextText: string | null): void {
		const composerEl = container.createEl("div", {
			cls: "ai-draft-bench-chat-composer",
		});

		if (replyContextText) {
			this.renderReplyContext(composerEl, replyContextText);
		}

		const inputEl = composerEl.createEl("textarea", {
			cls: "ai-draft-bench-chat-input",
			attr: {
				placeholder: "Ask about your draft...",
				rows: "2",
			},
		});

		const sendButtonEl = composerEl.createEl("button", {
			cls: "ai-draft-bench-chat-send",
			text: "Send",
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
			this.onSendChat(message);
			inputEl.value = "";
			updateSendButtonState();
		};

		updateSendButtonState();

		inputEl.addEventListener("input", updateSendButtonState);

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

			window.setTimeout(() => {
				inputEl.focus();
			}, 0);
		}
	}

	private renderReplyContext(container: HTMLElement, replyContextText: string): void {
		const replyEl = container.createEl("div", {
			cls: "ai-draft-bench-reply-context",
		});

		replyEl.createSpan({
			text: replyContextText,
		});

		const cancelButtonEl = replyEl.createEl("button", {
			text: "Cancel",
			cls: "ai-draft-bench-reply-cancel",
		});

		cancelButtonEl.addEventListener("click", () => {
			this.onCancelReply();
		});
	}
}
