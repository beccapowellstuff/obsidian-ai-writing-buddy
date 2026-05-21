export class ResponseDiffRenderer {
	render(container: HTMLElement, originalText: string, responseText: string): void {
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
}
