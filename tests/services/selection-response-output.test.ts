import { describe, expect, it } from "vitest";

import { parseSelectionResponseOutput, SELECTION_RESPONSE_OUTPUT_END, SELECTION_RESPONSE_OUTPUT_START } from "../../src/services/selection-response-output";

describe("parseSelectionResponseOutput", () => {
	it("uses the shorter AWB output markers as the canonical prompt markers", () => {
		expect(SELECTION_RESPONSE_OUTPUT_START).toBe("[AWB_OUTPUT]");
		expect(SELECTION_RESPONSE_OUTPUT_END).toBe("[/AWB_OUTPUT]");
	});

	it("extracts proposed content from the shorter output markers", () => {
		const output = parseSelectionResponseOutput([
			"Here is the rewrite:",
			"[AWB_OUTPUT]",
			"This is the proposed note text.",
			"[/AWB_OUTPUT]",
		].join("\n"));

		expect(output).toEqual({
			contentText: "This is the proposed note text.",
			commentText: "Here is the rewrite:",
			hasMarkedContent: true,
		});
	});

	it("accepts common shorter output marker spellings", () => {
		const output = parseSelectionResponseOutput([
			"Here is the rewrite:",
			"[A W B OUTPUT]",
			"This is the proposed note text.",
			"[/a-w-b-output]",
		].join("\n"));

		expect(output).toEqual({
			contentText: "This is the proposed note text.",
			commentText: "Here is the rewrite:",
			hasMarkedContent: true,
		});
	});

	it("extracts the rest of the response after a shorter output start marker with no end marker", () => {
		const output = parseSelectionResponseOutput([
			"Here is the rewrite:",
			"[awb_output]",
			"This is the proposed note text.",
		].join("\n"));

		expect(output).toEqual({
			contentText: "This is the proposed note text.",
			commentText: "Here is the rewrite:",
			hasMarkedContent: true,
		});
	});

	it("extracts proposed content when the shorter end marker uses separators", () => {
		const output = parseSelectionResponseOutput([
			"Here is the rewrite:",
			"[AWB_OUTPUT]",
			"This is the proposed note text.",
			"[/A_W_B_OUTPUT]",
		].join("\n"));

		expect(output).toEqual({
			contentText: "This is the proposed note text.",
			commentText: "Here is the rewrite:",
			hasMarkedContent: true,
		});
	});

	it("removes shorter output end marker variants from unmarked responses", () => {
		const output = parseSelectionResponseOutput("Draft text with a stray [/A W B OUTPUT] marker.");

		expect(output).toEqual({
			contentText: "Draft text with a stray  marker.",
			hasMarkedContent: false,
		});
	});
});
