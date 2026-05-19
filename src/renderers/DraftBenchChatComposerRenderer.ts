type SendChatHandler = (message: string) => void;
type CancelReplyHandler = () => void;

export class DraftBenchChatComposerRenderer {
	constructor(
		private readonly onSendChat: SendChatHandler,
		private readonly onCancelReply: CancelReplyHandler,
	) {}

	render(container: HTMLElement, replyToEntryId: string | null): void {
		const composerEl = container.createEl("div", {
			cls: "ai-draft-bench-chat-composer",
		});

		if (replyToEntryId) {
			this.renderReplyContext(composerEl);
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

		sendButtonEl.addEventListener("click", () => {
			this.onSendChat(inputEl.value);
		});

		inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				this.onSendChat(inputEl.value);
			}
		});
	}

	private renderReplyContext(container: HTMLElement): void {
		const replyEl = container.createEl("div", {
			cls: "ai-draft-bench-reply-context",
		});

		replyEl.createSpan({
			text: "Replying to an earlier draft",
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
