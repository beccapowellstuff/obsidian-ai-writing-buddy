import type { TFile } from "obsidian";

export type RagChunkerOptions = {
	targetCharacters: number;
	overlapCharacters: number;
};

export type RagChunkerChunk = {
	id: string;
	filePath: string;
	fileTitle: string;
	chunkIndex: number;
	headingPath?: string[];
	startLine: number;
	endLine: number;
	text: string;
};

type MarkdownBlock = {
	text: string;
	startLine: number;
	endLine: number;
	headingPath: string[];
};

const DEFAULT_CHUNKER_OPTIONS: RagChunkerOptions = {
	targetCharacters: 5200,
	overlapCharacters: 700,
};

export class RagChunker {
	constructor(private readonly options: RagChunkerOptions = DEFAULT_CHUNKER_OPTIONS) {}

	chunk(file: TFile, content: string): RagChunkerChunk[] {
		const blocks = this.createBlocks(content);
		const chunks: RagChunkerChunk[] = [];
		let currentBlocks: MarkdownBlock[] = [];
		let currentLength = 0;

		for (const block of blocks) {
			const blockLength = block.text.length;
			const shouldFlush = currentBlocks.length > 0 && currentLength + blockLength > this.options.targetCharacters;

			if (shouldFlush) {
				chunks.push(this.createChunk(file, chunks.length, currentBlocks));
				currentBlocks = this.createOverlapBlocks(currentBlocks);
				currentLength = currentBlocks.reduce((total, candidate) => total + candidate.text.length, 0);
			}

			currentBlocks.push(block);
			currentLength += blockLength;
		}

		if (currentBlocks.length > 0) {
			chunks.push(this.createChunk(file, chunks.length, currentBlocks));
		}

		return chunks;
	}

	private createBlocks(content: string): MarkdownBlock[] {
		const lines = content.replace(/\r\n/g, "\n").split("\n");
		const blocks: MarkdownBlock[] = [];
		const headingStack: Array<{ level: number; text: string }> = [];
		let blockLines: string[] = [];
		let blockStartLine = 1;
		let blockHeadingPath: string[] = [];

		const flushBlock = (endLine: number): void => {
			const text = blockLines.join("\n").trim();

			if (text) {
				blocks.push({
					text,
					startLine: blockStartLine,
					endLine,
					headingPath: [...blockHeadingPath],
				});
			}

			blockLines = [];
		};

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index] ?? "";
			const lineNumber = index + 1;
			const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);

			if (headingMatch) {
				flushBlock(lineNumber - 1);

				const level = headingMatch[1]?.length ?? 1;
				const text = headingMatch[2]?.trim() ?? "";

				while (headingStack.length > 0 && (headingStack[headingStack.length - 1]?.level ?? 0) >= level) {
					headingStack.pop();
				}

				headingStack.push({ level, text });
				blockHeadingPath = headingStack.map((heading) => heading.text);
				blockStartLine = lineNumber;
				blockLines = [line];
				flushBlock(lineNumber);
				blockHeadingPath = headingStack.map((heading) => heading.text);
				blockStartLine = lineNumber + 1;
				continue;
			}

			if (!line.trim()) {
				flushBlock(lineNumber - 1);
				blockStartLine = lineNumber + 1;
				blockHeadingPath = headingStack.map((heading) => heading.text);
				continue;
			}

			if (blockLines.length === 0) {
				blockStartLine = lineNumber;
				blockHeadingPath = headingStack.map((heading) => heading.text);
			}

			blockLines.push(line);
		}

		flushBlock(lines.length);

		return blocks;
	}

	private createOverlapBlocks(blocks: MarkdownBlock[]): MarkdownBlock[] {
		const overlapBlocks: MarkdownBlock[] = [];
		let characterCount = 0;

		for (let index = blocks.length - 1; index >= 0; index--) {
			const block = blocks[index];

			if (!block) {
				continue;
			}

			overlapBlocks.unshift(block);
			characterCount += block.text.length;

			if (characterCount >= this.options.overlapCharacters) {
				break;
			}
		}

		return overlapBlocks;
	}

	private createChunk(file: TFile, chunkIndex: number, blocks: MarkdownBlock[]): RagChunkerChunk {
		const firstBlock = blocks[0];
		const lastBlock = blocks[blocks.length - 1];
		const headingPath = this.getSharedHeadingPath(blocks);

		return {
			id: `${file.path}::${chunkIndex}`,
			filePath: file.path,
			fileTitle: file.basename,
			chunkIndex,
			headingPath: headingPath.length > 0 ? headingPath : undefined,
			startLine: firstBlock?.startLine ?? 1,
			endLine: lastBlock?.endLine ?? firstBlock?.startLine ?? 1,
			text: blocks.map((block) => block.text).join("\n\n").trim(),
		};
	}

	private getSharedHeadingPath(blocks: MarkdownBlock[]): string[] {
		const firstPath = blocks[0]?.headingPath ?? [];
		const sharedPath: string[] = [];

		for (let index = 0; index < firstPath.length; index++) {
			const candidate = firstPath[index];

			if (!candidate || blocks.some((block) => block.headingPath[index] !== candidate)) {
				break;
			}

			sharedPath.push(candidate);
		}

		return sharedPath;
	}
}
