import type { PromptTemplate } from "../types/prompt-template";

export type TemplateMentionMatch = {
	query: string;
	startIndex: number;
	endIndex: number;
};

export class TemplateMentionService {
	getTemplateMentionToken(template: PromptTemplate): string {
		const nameToken = template.name
			.trim()
			.toLowerCase()
			.replace(/['’]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		return nameToken || template.id;
	}

	getActiveMention(text: string, cursorIndex: number): TemplateMentionMatch | null {
		const beforeCursor = text.slice(0, cursorIndex);
		const match = /(^|\s)@([a-zA-Z0-9_-]*)$/.exec(beforeCursor);

		if (!match || match.index === undefined) {
			return null;
		}

		const prefixLength = match[1]?.length ?? 0;
		const query = match[2] ?? "";
		const startIndex = match.index + prefixLength;

		return {
			query,
			startIndex,
			endIndex: cursorIndex,
		};
	}

	getMatchingTemplates(templates: PromptTemplate[], query: string): PromptTemplate[] {
		const normalisedQuery = query.trim().toLowerCase();

		return templates
			.filter((template) => template.scope === "selection")
			.filter((template) => {
				if (!normalisedQuery) {
					return true;
				}

				const mentionToken = this.getTemplateMentionToken(template);

				return mentionToken.includes(normalisedQuery) || template.id.toLowerCase().includes(normalisedQuery) || template.name.toLowerCase().includes(normalisedQuery);
			});
	}

	insertTemplateMention(text: string, mention: TemplateMentionMatch, template: PromptTemplate): { text: string; cursorIndex: number } {
		const replacement = `@${this.getTemplateMentionToken(template)} `;
		const nextText = text.slice(0, mention.startIndex) + replacement + text.slice(mention.endIndex);

		return {
			text: nextText,
			cursorIndex: mention.startIndex + replacement.length,
		};
	}
}
