import { describe, expect, it } from "vitest";
import { WholeNoteTemplateSizeService } from "../../src/services/whole-note-template-size-service";
import type { PromptTemplate } from "../../src/types/prompt-template";

const makeTemplate = (prompt: string): PromptTemplate =>
	({
		id: "critique",
		name: "Critique",
		description: "Critique description",
		scope: "selection",
		prompt,
		temperature: 0.7,
	}) as PromptTemplate;

describe("WholeNoteTemplateSizeService", () => {
	const service = new WholeNoteTemplateSizeService();

	it("allows a whole-note template request that fits within the limit", () => {
		const result = service.checkWholeNoteTemplateSize(makeTemplate("Critique this note."), "Short note.", "Focus on pacing.", 10000);

		expect(result.fits).toBe(true);
		expect(result.estimatedCharacters).toBeLessThanOrEqual(result.maxCharacters);
	});

	it("rejects a whole-note template request that exceeds the limit", () => {
		const result = service.checkWholeNoteTemplateSize(makeTemplate("Critique this note."), "x".repeat(10000), "Focus on pacing.", 5000);

		expect(result.fits).toBe(false);
		expect(result.estimatedCharacters).toBeGreaterThan(result.maxCharacters);
	});
});
