import { describe, expect, it } from "vitest";
import { TemplateMentionService } from "../../src/services/template-mention-service";
import type { PromptTemplate } from "../../src/types/prompt-template";

const makeTemplate = (id: string, name: string): PromptTemplate =>
	({
		id,
		name,
		description: `${name} description`,
		scope: "selection",
		prompt: `${name} prompt`,
		temperature: 0.7,
	}) as PromptTemplate;

describe("TemplateMentionService", () => {
	const service = new TemplateMentionService();

	it("detects an @ mention at the start of the text", () => {
		const mention = service.getActiveMention("@cri", 4);

		expect(mention).toEqual({
			query: "cri",
			startIndex: 0,
			endIndex: 4,
		});
	});

	it("detects an @ mention after whitespace", () => {
		const text = "please @sum";
		const mention = service.getActiveMention(text, text.length);

		expect(mention).toEqual({
			query: "sum",
			startIndex: 7,
			endIndex: 11,
		});
	});

	it("does not detect @ in the middle of a word", () => {
		const text = "hello@cri";
		const mention = service.getActiveMention(text, text.length);

		expect(mention).toBeNull();
	});

	it("matches templates by id", () => {
		const templates = [makeTemplate("critique", "Critique"), makeTemplate("summarise", "Summarise")];

		const matches = service.getMatchingTemplates(templates, "cri");

		expect(matches.map((template) => template.id)).toEqual(["critique"]);
	});

	it("matches templates by name", () => {
		const templates = [makeTemplate("fix-spelling-and-grammar", "Fix spelling and grammar"), makeTemplate("summarise", "Summarise")];

		const matches = service.getMatchingTemplates(templates, "fix");

		expect(matches.map((template) => template.id)).toEqual(["fix-spelling-and-grammar"]);
	});

	it("inserts the selected template mention", () => {
		const text = "@cri";
		const mention = service.getActiveMention(text, text.length);
		const template = makeTemplate("critique", "Critique");

		expect(mention).not.toBeNull();

		const result = service.insertTemplateMention("@cri", mention!, template);

		expect(result).toEqual({
			text: "@critique ",
			cursorIndex: "@critique ".length,
		});
	});

	it("creates a readable mention token from a custom template name", () => {
		const template = makeTemplate("0b75373a-a476-49a9-bc55-aee2462e94b4", "Review Opening Tone");

		expect(service.getTemplateMentionToken(template)).toBe("review-opening-tone");
	});

	it("inserts a readable mention token for custom templates", () => {
		const text = "@review";
		const mention = service.getActiveMention(text, text.length);
		const template = makeTemplate("0b75373a-a476-49a9-bc55-aee2462e94b4", "Review Opening Tone");

		expect(mention).not.toBeNull();

		const result = service.insertTemplateMention("@review", mention!, template);

		expect(result).toEqual({
			text: "@review-opening-tone ",
			cursorIndex: "@review-opening-tone ".length,
		});
	});

	it("parses a template command at the start of a message", () => {
		const templates = [makeTemplate("critique", "Critique"), makeTemplate("summarise", "Summarise")];

		const command = service.parseTemplateCommand("@critique focus on pacing", templates);

		expect(command).toEqual({
			template: templates[0],
			instruction: "focus on pacing",
		});
	});

	it("parses a template command using a readable custom template token", () => {
		const templates = [makeTemplate("0b75373a-a476-49a9-bc55-aee2462e94b4", "Review Opening Tone")];

		const command = service.parseTemplateCommand("@review-opening-tone compare the first and last paragraphs", templates);

		expect(command).toEqual({
			template: templates[0],
			instruction: "compare the first and last paragraphs",
		});
	});

	it("matches templates only from the start of the token, id, or name", () => {
		const templates = [makeTemplate("critique", "Critique"), makeTemplate("humanise", "Humanise"), makeTemplate("make-clearer", "Make clearer")];

		const matches = service.getMatchingTemplates(templates, "c");

		expect(matches).toEqual([templates[0]]);
	});

	it("does not match suggestions by hidden template id prefixes", () => {
		const templates = [makeTemplate("1-hidden-id", "Make Sexy"), makeTemplate("visible-number-template", "1st to 3rd POV")];

		const matches = service.getMatchingTemplates(templates, "1");

		expect(matches).toEqual([templates[1]]);
	});

	it("does not parse a normal chat message as a template command", () => {
		const templates = [makeTemplate("critique", "Critique")];

		const command = service.parseTemplateCommand("Can you critique this?", templates);

		expect(command).toBeNull();
	});
});
