type DiffToken = {
	text: string;
	isWhitespace: boolean;
};

type DiffSegment =
	| {
			type: "unchanged";
			token: DiffToken;
	  }
	| {
			type: "removed";
			token: DiffToken;
	  }
	| {
			type: "added";
			token: DiffToken;
	  };

export class ResponseDiffRenderer {
	render(container: HTMLElement, originalText: string, responseText: string): void {
		const originalTokens = this.tokenizeText(originalText);
		const responseTokens = this.tokenizeText(responseText);
		const diffSegments = this.createDiffSegments(originalTokens, responseTokens);

		for (const segment of diffSegments) {
			if (segment.type === "unchanged") {
				container.appendChild(document.createTextNode(segment.token.text));
				continue;
			}

			const changedEl = container.createSpan({
				cls: segment.type === "removed" ? "ai-writing-buddy-diff-removed" : "ai-writing-buddy-diff-added",
				text: segment.token.text,
			});

			changedEl.setAttribute("title", segment.type === "removed" ? "Removed from selected text" : "Added or changed from selected text");
		}
	}

	private tokenizeText(text: string): DiffToken[] {
		const matches = text.match(/\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) ?? [];

		return matches.map((token) => ({
			text: token,
			isWhitespace: /^\s+$/.test(token),
		}));
	}

	private createDiffSegments(originalTokens: DiffToken[], responseTokens: DiffToken[]): DiffSegment[] {
		const table = this.createLongestCommonSubsequenceTable(originalTokens, responseTokens);
		const segments: DiffSegment[] = [];

		let originalIndex = 0;
		let responseIndex = 0;

		while (originalIndex < originalTokens.length && responseIndex < responseTokens.length) {
			const originalToken = originalTokens[originalIndex];
			const responseToken = responseTokens[responseIndex];

			if (!originalToken || !responseToken) {
				break;
			}

			if (originalToken.text === responseToken.text) {
				segments.push({
					type: "unchanged",
					token: responseToken,
				});

				originalIndex += 1;
				responseIndex += 1;
				continue;
			}

			const nextOriginalScore = table[originalIndex + 1]?.[responseIndex] ?? 0;
			const nextResponseScore = table[originalIndex]?.[responseIndex + 1] ?? 0;

			if (nextOriginalScore >= nextResponseScore) {
				segments.push({
					type: "removed",
					token: originalToken,
				});

				originalIndex += 1;
			} else {
				segments.push({
					type: "added",
					token: responseToken,
				});

				responseIndex += 1;
			}
		}

		while (originalIndex < originalTokens.length) {
			const originalToken = originalTokens[originalIndex];

			if (originalToken) {
				segments.push({
					type: "removed",
					token: originalToken,
				});
			}

			originalIndex += 1;
		}

		while (responseIndex < responseTokens.length) {
			const responseToken = responseTokens[responseIndex];

			if (responseToken) {
				segments.push({
					type: "added",
					token: responseToken,
				});
			}

			responseIndex += 1;
		}

		return this.mergeReadableWhitespace(segments);
	}

	private createLongestCommonSubsequenceTable(originalTokens: DiffToken[], responseTokens: DiffToken[]): number[][] {
		const table = Array.from({ length: originalTokens.length + 1 }, () => Array<number>(responseTokens.length + 1).fill(0));

		for (let originalIndex = originalTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
			for (let responseIndex = responseTokens.length - 1; responseIndex >= 0; responseIndex -= 1) {
				const currentRow = table[originalIndex];
				const nextOriginalRow = table[originalIndex + 1];

				if (!currentRow || !nextOriginalRow) {
					continue;
				}

				if (originalTokens[originalIndex]?.text === responseTokens[responseIndex]?.text) {
					currentRow[responseIndex] = (nextOriginalRow[responseIndex + 1] ?? 0) + 1;
				} else {
					currentRow[responseIndex] = Math.max(nextOriginalRow[responseIndex] ?? 0, currentRow[responseIndex + 1] ?? 0);
				}
			}
		}

		return table;
	}

	private mergeReadableWhitespace(segments: DiffSegment[]): DiffSegment[] {
		return segments.map((segment) => {
			if (segment.token.isWhitespace && segment.type !== "unchanged") {
				return {
					...segment,
					token: {
						...segment.token,
						text: segment.token.text.replace(/\n/g, "↵\n").replace(/\t/g, "⇥"),
					},
				};
			}

			return segment;
		});
	}
}
