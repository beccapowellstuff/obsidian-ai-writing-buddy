import { DraftBenchChatMessage } from "./DraftBenchPromptBuilder";

const DEFAULT_MAX_PROMPT_CHARACTERS = 120000;

export class DraftBenchPromptSizeGuard {
	constructor(private readonly maxPromptCharacters = DEFAULT_MAX_PROMPT_CHARACTERS) {}

	validate(messages: DraftBenchChatMessage[]): void {
		const totalCharacters = this.getTotalContentLength(messages);

		if (totalCharacters <= this.maxPromptCharacters) {
			return;
		}

		throw new Error(
			[
				"The prompt is too large to send safely.",
				`Prompt size: ${totalCharacters.toLocaleString()} characters.`,
				`Current safety limit: ${this.maxPromptCharacters.toLocaleString()} characters.`,
				"Try selecting less text, shortening the chat message, or reducing the follow-up context.",
			].join(" "),
		);
	}

	private getTotalContentLength(messages: DraftBenchChatMessage[]): number {
		return messages.reduce((total, message) => {
			return total + message.content.length;
		}, 0);
	}
}
