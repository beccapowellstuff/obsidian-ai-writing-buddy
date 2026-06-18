import { describe, expect, it } from "vitest";
import { createRagKeywordSearchQuery, scoreKeywordChunk, tokenizeRagSearchText } from "../../src/services/rag-keyword-search";
import type { AiWritingBuddyRagChunk } from "../../src/types/rag-index";

function createChunk(path: string, text: string): AiWritingBuddyRagChunk {
	return {
		id: `${path}::0`,
		filePath: path,
		fileTitle:
			path
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") ?? path,
		fileHash: "hash",
		chunkIndex: 0,
		text,
		retrievalMode: "keyword",
		updatedAt: 1,
	};
}

describe("RagIndexStore keyword scoring", () => {
	it("prefers content matches over generic story path matches", () => {
		const queryTerms = tokenizeRagSearchText("what story does Scott take a shower");
		const matchingChunk = createChunk("Stories/Quiet Morning.md", "Scott takes a shower before returning to the kitchen.");
		const genericStoryChunk = createChunk("Stories/Archive/Blue House.md", "A scene about rain on the windows.");

		expect(queryTerms).toEqual(["scott", "take", "shower"]);
		expect(scoreKeywordChunk(matchingChunk, queryTerms)).toBeGreaterThan(scoreKeywordChunk(genericStoryChunk, queryTerms));
	});

	it("strongly prefers an exact phrase chunk over a generic chunk from another story ideas note", () => {
		const query = createRagKeywordSearchQuery("hey I remember I did notes once for a Digital Pixelation story idea. Where is that located?");
		const matchingChunk = createChunk(
			"- Story Ideas/- Visual Transformation Methods.md",
			[
				"## Visual Transformation Methods",
				"Digital Pixelation: The character's body could start pixelating, with pixels detaching and floating away or rearranging themselves to form the new identity.",
				"This approach is particularly fitting for stories with themes of technology, digital worlds, or virtual reality.",
			].join("\n"),
		);
		const genericChunk = createChunk(
			"- Stories that have ideas/! Notes Part 2.md",
			[
				"## Visual Transformation Methods",
				"Statue/Cocoon Breakaway: As you mentioned, the individual could initially be encased in a statue-like form or a cocoon.",
				"This method symbolizes rebirth and metamorphosis.",
			].join("\n"),
		);

		expect(query.terms).toEqual(["digital", "pixelation"]);
		expect(query.phrases).toContain("digital pixelation");
		expect(scoreKeywordChunk(matchingChunk, query)).toBeGreaterThan(scoreKeywordChunk(genericChunk, query));
	});
});
