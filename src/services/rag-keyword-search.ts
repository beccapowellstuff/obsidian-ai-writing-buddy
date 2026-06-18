import type { AiWritingBuddyRagChunk } from "../types/rag-index";

export type RagKeywordSearchQuery = {
	terms: string[];
	phrases: string[];
};

export function createRagKeywordSearchQuery(query: string): RagKeywordSearchQuery {
	const terms = tokenizeRagSearchText(query);
	const phrases = createSearchPhrases(terms);

	return { terms, phrases };
}

export function scoreKeywordChunk(chunk: AiWritingBuddyRagChunk, query: RagKeywordSearchQuery | string[]): number {
	const queryTerms = Array.isArray(query) ? query : query.terms;
	const queryPhrases = Array.isArray(query) ? [] : query.phrases;

	if (queryTerms.length === 0 && queryPhrases.length === 0) {
		return chunk.chunkIndex === 0 ? 1 : 0;
	}

	const contentTerms = tokenizeRagSearchText(chunk.text);
	const headingTerms = tokenizeRagSearchText((chunk.headingPath ?? []).join(" "));
	const titleTerms = tokenizeRagSearchText(chunk.fileTitle);
	const pathTerms = tokenizeRagSearchText(chunk.filePath);
	const contentSearchText = contentTerms.join(" ");
	const headingSearchText = headingTerms.join(" ");
	const titleSearchText = titleTerms.join(" ");
	const pathSearchText = pathTerms.join(" ");
	const contentTermCounts = new Map<string, number>();
	const matchedTerms = new Set<string>();
	let score = 0;

	for (const term of contentTerms) {
		contentTermCounts.set(term, (contentTermCounts.get(term) ?? 0) + 1);
	}

	for (const term of queryTerms) {
		const contentCount = contentTermCounts.get(term) ?? 0;

		if (contentCount > 0) {
			matchedTerms.add(term);
			score += 8 + Math.min(contentCount, 6) * 2;
		}

		if (headingTerms.includes(term)) {
			matchedTerms.add(term);
			score += 6;
		}

		if (titleTerms.includes(term)) {
			matchedTerms.add(term);
			score += 5;
		}

		if (pathTerms.includes(term)) {
			score += 1;
		}
	}

	for (const phrase of queryPhrases) {
		if (contentSearchText.includes(phrase)) {
			score += 90;
		}

		if (headingSearchText.includes(phrase)) {
			score += 80;
		}

		if (titleSearchText.includes(phrase)) {
			score += 50;
		}

		if (pathSearchText.includes(phrase)) {
			score += 20;
		}
	}

	score += matchedTerms.size * matchedTerms.size * 4;

	return score;
}

export function tokenizeRagSearchText(text: string): string[] {
	const matches = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
	const stopWords = new Set([
		"the",
		"and",
		"for",
		"that",
		"this",
		"with",
		"from",
		"have",
		"what",
		"when",
		"where",
		"which",
		"about",
		"into",
		"your",
		"note",
		"notes",
		"idea",
		"ideas",
		"story",
		"stories",
		"does",
		"did",
		"was",
		"were",
		"are",
		"has",
		"had",
		"hey",
		"remember",
		"once",
		"located",
		"locate",
	]);

	return matches
		.filter((term) => !stopWords.has(term))
		.map((term) => normalizeSearchTerm(term))
		.filter((term) => term.length >= 3 && !stopWords.has(term));
}

function normalizeSearchTerm(term: string): string {
	if (term.endsWith("ies") && term.length > 4) {
		return `${term.slice(0, -3)}y`;
	}

	if (term.endsWith("ing") && term.length > 5) {
		const stem = term.slice(0, -3);
		const lastCharacter = stem[stem.length - 1];
		const previousCharacter = stem[stem.length - 2];

		return lastCharacter && lastCharacter === previousCharacter ? stem.slice(0, -1) : stem;
	}

	if (term.endsWith("es") && term.length > 4) {
		return term.slice(0, -2);
	}

	if (term.endsWith("s") && term.length > 3) {
		return term.slice(0, -1);
	}

	return term;
}

function createSearchPhrases(terms: string[]): string[] {
	const phrases: string[] = [];

	for (let index = 0; index < terms.length - 1; index++) {
		const twoTermPhrase = terms.slice(index, index + 2).join(" ");

		if (twoTermPhrase.trim()) {
			phrases.push(twoTermPhrase);
		}

		if (index < terms.length - 2) {
			const threeTermPhrase = terms.slice(index, index + 3).join(" ");

			if (threeTermPhrase.trim()) {
				phrases.push(threeTermPhrase);
			}
		}
	}

	return phrases;
}
