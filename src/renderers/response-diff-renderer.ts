import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { ResponseDiffChangeRejection } from "../types/response-diff-change";

type DiffToken = {
	text: string;
	isWhitespace: boolean;
	startIndex: number;
	endIndex: number;
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

type DiffChangeChunk = {
	segments: DiffSegment[];
	responseStartIndex: number;
	responseEndIndex: number;
	originalText: string;
};

export class ResponseDiffRenderer {
	render(container: HTMLElement, originalText: string, responseText: string, onRejectChange?: (change: ResponseDiffChangeRejection) => void): void {
		const originalTokens = this.tokenizeText(originalText);
		const responseTokens = this.tokenizeText(responseText);
		const diffSegments = this.createDiffSegments(originalTokens, responseTokens);

		this.renderDiffSegments(container, diffSegments, Boolean(onRejectChange), (change) => {
			onRejectChange?.(change);
		});
	}

	private renderDiffSegments(container: HTMLElement, segments: DiffSegment[], canRejectChanges: boolean, onRejectChange: (change: ResponseDiffChangeRejection) => void): void {
		let changedSegments: DiffSegment[] = [];
		let responseCursor = 0;

		const flushChangedSegments = () => {
			if (changedSegments.length === 0) {
				return;
			}

			const chunk = this.createDiffChangeChunk(changedSegments, responseCursor);
			this.renderDiffChangeChunk(container, chunk, canRejectChanges, onRejectChange);
			responseCursor = chunk.responseEndIndex;
			changedSegments = [];
		};

		for (const segment of segments) {
			if (segment.type !== "unchanged") {
				changedSegments.push(segment);
				continue;
			}

			flushChangedSegments();
			container.appendChild(document.createTextNode(segment.token.text));
			responseCursor = segment.token.endIndex;
		}

		flushChangedSegments();
	}

	private createDiffChangeChunk(segments: DiffSegment[], responseCursor: number): DiffChangeChunk {
		const addedSegments = segments.filter((segment) => segment.type === "added");
		const removedText = segments
			.filter((segment) => segment.type === "removed")
			.map((segment) => segment.token.text)
			.join("");

		const firstAddedSegment = addedSegments[0];
		const lastAddedSegment = addedSegments[addedSegments.length - 1];

		return {
			segments,
			responseStartIndex: firstAddedSegment?.token.startIndex ?? responseCursor,
			responseEndIndex: lastAddedSegment?.token.endIndex ?? responseCursor,
			originalText: removedText,
		};
	}

	private renderDiffChangeChunk(
		container: HTMLElement,
		chunk: DiffChangeChunk,
		canRejectChanges: boolean,
		onRejectChange: (change: ResponseDiffChangeRejection) => void,
	): void {
		const chunkEl = container.createSpan({
			cls: canRejectChanges ? "ai-writing-buddy-diff-change ai-writing-buddy-diff-change-rejectable" : "ai-writing-buddy-diff-change",
		});

		if (canRejectChanges) {
			chunkEl.setAttribute("role", "button");
			chunkEl.setAttribute("tabindex", "0");
			chunkEl.setAttribute("title", INTERFACE_TEXT.responses.rejectChange);
			chunkEl.setAttribute("aria-label", INTERFACE_TEXT.responses.rejectChange);

			const rejectChange = () => {
				onRejectChange({
					responseStartIndex: chunk.responseStartIndex,
					responseEndIndex: chunk.responseEndIndex,
					originalText: chunk.originalText,
				});
			};

			chunkEl.addEventListener("click", rejectChange);
			chunkEl.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") {
					return;
				}

				event.preventDefault();
				rejectChange();
			});
		} else {
			chunkEl.setAttribute("title", "Changed from selected text");
		}

		for (const segment of chunk.segments) {
			chunkEl.createSpan({
				cls: segment.type === "removed" ? "ai-writing-buddy-diff-removed" : "ai-writing-buddy-diff-added",
				text: this.getReadableTokenText(segment.token),
			});
		}
	}

	private tokenizeText(text: string): DiffToken[] {
		const tokens: DiffToken[] = [];
		const tokenPattern = /\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g;
		let match: RegExpExecArray | null;

		while ((match = tokenPattern.exec(text)) !== null) {
			const tokenText = match[0];

			tokens.push({
				text: tokenText,
				startIndex: match.index,
				endIndex: match.index + tokenText.length,
				isWhitespace: /^\s+$/.test(tokenText),
			});
		}

		return tokens;
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

		return segments;
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

	private getReadableTokenText(token: DiffToken): string {
		if (!token.isWhitespace) {
			return token.text;
		}

		return token.text.replace(/\n/g, "\\n\n").replace(/\t/g, "\\t");
	}
}
