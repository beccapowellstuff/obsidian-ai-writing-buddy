import { describe, expect, it } from "vitest";
import { MarkdownChunkingService } from "../../src/services/markdown-chunking-service";

describe("MarkdownChunkingService", () => {
	const service = new MarkdownChunkingService();

	it("returns one chunk when the note fits the target limit", () => {
		const note = "# Opening\n\nThis is a small note.";

		const chunks = service.splitMarkdownNote(note, 1000);

		expect(chunks).toEqual([
			{
				index: 0,
				total: 1,
				text: note,
				heading: "Opening",
				startOffset: 0,
				endOffset: note.length,
			},
		]);
	});

	it("prefers heading boundaries when splitting oversized notes", () => {
		const note = "# Opening\n\nIntro text.\n\n## Scene One\nScene one text.\n\n## Scene Two\nScene two text.";
		const sceneTwoStart = note.indexOf("## Scene Two");

		const chunks = service.splitMarkdownNote(note, sceneTwoStart);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toEqual({
			index: 0,
			total: 2,
			text: note.slice(0, sceneTwoStart),
			heading: "Opening",
			startOffset: 0,
			endOffset: sceneTwoStart,
		});
		expect(chunks[1]).toEqual({
			index: 1,
			total: 2,
			text: note.slice(sceneTwoStart),
			heading: "Scene Two",
			startOffset: sceneTwoStart,
			endOffset: note.length,
		});
	});

	it("falls back to paragraph boundaries when a heading section is too large", () => {
		const firstParagraph = "First paragraph.\n\n";
		const secondParagraph = "Second paragraph.\n\n";
		const thirdParagraph = "Third paragraph.";
		const note = `${firstParagraph}${secondParagraph}${thirdParagraph}`;
		const targetMaxCharacters = Math.max(firstParagraph.length, secondParagraph.length, thirdParagraph.length);

		const chunks = service.splitMarkdownNote(note, targetMaxCharacters);

		expect(chunks.map((chunk) => chunk.text)).toEqual([firstParagraph, secondParagraph, thirdParagraph]);
		expect(chunks.every((chunk) => chunk.text.length <= targetMaxCharacters)).toBe(true);
		expect(chunks.map((chunk) => chunk.heading)).toEqual([null, null, null]);
	});

	it("falls back to hard character splitting when one paragraph is too large", () => {
		const note = "abcdefghij";

		const chunks = service.splitMarkdownNote(note, 4);

		expect(chunks.map((chunk) => chunk.text)).toEqual(["abcd", "efgh", "ij"]);
		expect(chunks.map((chunk) => chunk.startOffset)).toEqual([0, 4, 8]);
		expect(chunks.map((chunk) => chunk.endOffset)).toEqual([4, 8, 10]);
	});

	it("adds stable index and total metadata to every chunk", () => {
		const note = "aaaa\n\nbbbb\n\ncccc";

		const chunks = service.splitMarkdownNote(note, 6);

		expect(chunks).toHaveLength(3);
		expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
		expect(chunks.map((chunk) => chunk.total)).toEqual([3, 3, 3]);
	});

	it("does not split on markdown headings inside fenced code blocks", () => {
		const note = "# Real Heading\n\n```ts\n# Not A Heading\nconst value = true;\n```\n\n## Next Heading\nMore text.";
		const nextHeadingStart = note.indexOf("## Next Heading");

		const chunks = service.splitMarkdownNote(note, nextHeadingStart);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toEqual(
			expect.objectContaining({
				text: note.slice(0, nextHeadingStart),
			}),
		);
		expect(chunks[1]).toEqual(
			expect.objectContaining({
				text: note.slice(nextHeadingStart),
			}),
		);
	});

	it("returns no chunks for an empty note", () => {
		const chunks = service.splitMarkdownNote("", 100);

		expect(chunks).toEqual([]);
	});

	it("throws when the target limit is invalid", () => {
		expect(() => service.splitMarkdownNote("text", 0)).toThrow("targetMaxCharacters must be greater than 0.");
	});
});
