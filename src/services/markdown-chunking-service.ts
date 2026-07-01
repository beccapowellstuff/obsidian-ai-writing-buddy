export type MarkdownChunk = {
	index: number;
	total: number;
	text: string;
	heading: string | null;
	startOffset: number;
	endOffset: number;
};

type RawMarkdownChunk = Omit<MarkdownChunk, "index" | "total">;

type MarkdownSection = {
	heading: string | null;
	startOffset: number;
	endOffset: number;
};

type TextRange = {
	startOffset: number;
	endOffset: number;
};

export class MarkdownChunkingService {
	splitMarkdownNote(noteContent: string, targetMaxCharacters: number): MarkdownChunk[] {
		if (targetMaxCharacters < 1) {
			throw new Error("targetMaxCharacters must be greater than 0.");
		}

		if (noteContent.length === 0) {
			return [];
		}

		if (noteContent.length <= targetMaxCharacters) {
			return this.withIndexes([
				{
					text: noteContent,
					heading: this.findFirstHeading(noteContent),
					startOffset: 0,
					endOffset: noteContent.length,
				},
			]);
		}

		const sections = this.getHeadingSections(noteContent);
		const rawChunks: RawMarkdownChunk[] = [];
		let currentChunk: RawMarkdownChunk | null = null;

		for (const section of sections) {
			const sectionLength = section.endOffset - section.startOffset;

			if (sectionLength > targetMaxCharacters) {
				if (currentChunk !== null) {
					rawChunks.push(currentChunk);
					currentChunk = null;
				}

				rawChunks.push(...this.splitOversizedSection(noteContent, section, targetMaxCharacters));
				continue;
			}

			if (currentChunk === null) {
				currentChunk = this.createChunk(noteContent, section.startOffset, section.endOffset, section.heading);
				continue;
			}

			const combinedLength = section.endOffset - currentChunk.startOffset;

			if (combinedLength > targetMaxCharacters) {
				rawChunks.push(currentChunk);
				currentChunk = this.createChunk(noteContent, section.startOffset, section.endOffset, section.heading);
				continue;
			}

			currentChunk = this.createChunk(noteContent, currentChunk.startOffset, section.endOffset, currentChunk.heading);
		}

		if (currentChunk !== null) {
			rawChunks.push(currentChunk);
		}

		return this.withIndexes(rawChunks);
	}

	private splitOversizedSection(noteContent: string, section: MarkdownSection, targetMaxCharacters: number): RawMarkdownChunk[] {
		const paragraphRanges = this.getParagraphRanges(noteContent, section.startOffset, section.endOffset);
		const chunks: RawMarkdownChunk[] = [];
		let currentRange: TextRange | null = null;

		for (const paragraphRange of paragraphRanges) {
			const paragraphLength = paragraphRange.endOffset - paragraphRange.startOffset;

			if (paragraphLength > targetMaxCharacters) {
				if (currentRange !== null) {
					chunks.push(this.createChunk(noteContent, currentRange.startOffset, currentRange.endOffset, section.heading));
					currentRange = null;
				}

				chunks.push(...this.hardSplitRange(noteContent, paragraphRange, section.heading, targetMaxCharacters));
				continue;
			}

			if (currentRange === null) {
				currentRange = paragraphRange;
				continue;
			}

			const combinedLength = paragraphRange.endOffset - currentRange.startOffset;

			if (combinedLength > targetMaxCharacters) {
				chunks.push(this.createChunk(noteContent, currentRange.startOffset, currentRange.endOffset, section.heading));
				currentRange = paragraphRange;
				continue;
			}

			currentRange = {
				startOffset: currentRange.startOffset,
				endOffset: paragraphRange.endOffset,
			};
		}

		if (currentRange !== null) {
			chunks.push(this.createChunk(noteContent, currentRange.startOffset, currentRange.endOffset, section.heading));
		}

		return chunks;
	}

	private hardSplitRange(noteContent: string, range: TextRange, heading: string | null, targetMaxCharacters: number): RawMarkdownChunk[] {
		const chunks: RawMarkdownChunk[] = [];

		for (let startOffset = range.startOffset; startOffset < range.endOffset; startOffset += targetMaxCharacters) {
			const endOffset = Math.min(startOffset + targetMaxCharacters, range.endOffset);
			chunks.push(this.createChunk(noteContent, startOffset, endOffset, heading));
		}

		return chunks;
	}

	private getHeadingSections(noteContent: string): MarkdownSection[] {
		const sections: MarkdownSection[] = [];
		const lines = this.getLineRanges(noteContent);
		let currentStartOffset = 0;
		let currentHeading: string | null = null;
		let insideFence = false;

		for (const line of lines) {
			const lineText = noteContent.slice(line.startOffset, line.endOffset);
			const lineWithoutEnding = lineText.replace(/(?:\r\n|\r|\n)$/, "");
			const trimmedStart = lineWithoutEnding.trimStart();

			if (trimmedStart.startsWith("```") || trimmedStart.startsWith("~~~")) {
				insideFence = !insideFence;
			}

			if (insideFence) {
				continue;
			}

			const heading = this.parseHeading(lineWithoutEnding);

			if (heading === null) {
				continue;
			}

			if (line.startOffset > currentStartOffset) {
				sections.push({
					heading: currentHeading,
					startOffset: currentStartOffset,
					endOffset: line.startOffset,
				});
			}

			currentStartOffset = line.startOffset;
			currentHeading = heading;
		}

		if (currentStartOffset < noteContent.length) {
			sections.push({
				heading: currentHeading,
				startOffset: currentStartOffset,
				endOffset: noteContent.length,
			});
		}

		return sections;
	}

	private getParagraphRanges(noteContent: string, startOffset: number, endOffset: number): TextRange[] {
		const ranges: TextRange[] = [];
		const lines = this.getLineRanges(noteContent, startOffset, endOffset);
		let currentStartOffset = startOffset;

		for (const line of lines) {
			const lineText = noteContent.slice(line.startOffset, line.endOffset);
			const lineWithoutEnding = lineText.replace(/(?:\r\n|\r|\n)$/, "");

			if (lineWithoutEnding.trim().length === 0) {
				ranges.push({
					startOffset: currentStartOffset,
					endOffset: line.endOffset,
				});

				currentStartOffset = line.endOffset;
			}
		}

		if (currentStartOffset < endOffset) {
			ranges.push({
				startOffset: currentStartOffset,
				endOffset,
			});
		}

		return ranges;
	}

	private getLineRanges(noteContent: string, startOffset = 0, endOffset = noteContent.length): TextRange[] {
		const ranges: TextRange[] = [];
		let lineStartOffset = startOffset;
		let cursor = startOffset;

		while (cursor < endOffset) {
			const character = noteContent[cursor];

			if (character === "\r" || character === "\n") {
				let lineEndOffset = cursor + 1;

				if (character === "\r" && noteContent[cursor + 1] === "\n") {
					lineEndOffset++;
				}

				ranges.push({
					startOffset: lineStartOffset,
					endOffset: Math.min(lineEndOffset, endOffset),
				});

				cursor = lineEndOffset;
				lineStartOffset = cursor;
				continue;
			}

			cursor++;
		}

		if (lineStartOffset < endOffset) {
			ranges.push({
				startOffset: lineStartOffset,
				endOffset,
			});
		}

		return ranges;
	}

	private findFirstHeading(noteContent: string): string | null {
		for (const line of this.getLineRanges(noteContent)) {
			const lineText = noteContent.slice(line.startOffset, line.endOffset).replace(/(?:\r\n|\r|\n)$/, "");
			const heading = this.parseHeading(lineText);

			if (heading !== null) {
				return heading;
			}
		}

		return null;
	}

	private parseHeading(lineText: string): string | null {
		const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lineText);
		const headingText = match?.[2];

		if (headingText === undefined) {
			return null;
		}

		return headingText.trim();
	}

	private createChunk(noteContent: string, startOffset: number, endOffset: number, heading: string | null): RawMarkdownChunk {
		return {
			text: noteContent.slice(startOffset, endOffset),
			heading,
			startOffset,
			endOffset,
		};
	}

	private withIndexes(rawChunks: RawMarkdownChunk[]): MarkdownChunk[] {
		const total = rawChunks.length;

		return rawChunks.map((chunk, chunkIndex) => ({
			...chunk,
			index: chunkIndex,
			total,
		}));
	}
}
