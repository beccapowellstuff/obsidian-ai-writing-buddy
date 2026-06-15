export const SELECTION_RESPONSE_OUTPUT_START = "[AWB_OUTPUT]";
export const SELECTION_RESPONSE_OUTPUT_END = "[/AWB_OUTPUT]";

const OUTPUT_MARKER_NAME_PATTERN = String.raw`A[_\s-]*W[_\s-]*B[_\s-]*OUTPUT`;
const OUTPUT_START_PATTERN = new RegExp(String.raw`\[\s*(?:${OUTPUT_MARKER_NAME_PATTERN})\s*\]`, "gi");
const OUTPUT_END_PATTERN = new RegExp(String.raw`\[\s*\/\s*(?:${OUTPUT_MARKER_NAME_PATTERN})\s*\]`, "gi");

export type SelectionResponseOutput = {
	contentText: string;
	commentText?: string;
	hasMarkedContent: boolean;
};

export function extractSelectionResponseOutput(responseText: string): string {
	return parseSelectionResponseOutput(responseText).contentText;
}

export function parseSelectionResponseOutput(responseText: string): SelectionResponseOutput {
	const sections: string[] = [];
	const commentSections: string[] = [];
	let searchIndex = 0;

	while (searchIndex < responseText.length) {
		OUTPUT_START_PATTERN.lastIndex = searchIndex;
		const startMatch = OUTPUT_START_PATTERN.exec(responseText);

		if (!startMatch) {
			commentSections.push(responseText.slice(searchIndex));
			break;
		}

		commentSections.push(responseText.slice(searchIndex, startMatch.index));

		const sectionStartIndex = startMatch.index + startMatch[0].length;
		OUTPUT_END_PATTERN.lastIndex = sectionStartIndex;
		const endMatch = OUTPUT_END_PATTERN.exec(responseText);

		if (!endMatch) {
			sections.push(responseText.slice(sectionStartIndex).trim());
			break;
		}

		sections.push(responseText.slice(sectionStartIndex, endMatch.index).trim());
		searchIndex = endMatch.index + endMatch[0].length;
	}

	if (sections.length === 0) {
		return {
			contentText: stripOutputMarkers(responseText).trim(),
			hasMarkedContent: false,
		};
	}

	const extractedText = sections.filter(Boolean).join("\n\n").trim();
	const commentText = stripOutputMarkers(commentSections.join("\n").trim()).trim();

	return {
		contentText: stripOutputMarkers(extractedText).trim(),
		commentText: commentText || undefined,
		hasMarkedContent: true,
	};
}

function stripOutputMarkers(responseText: string): string {
	return responseText.replace(OUTPUT_START_PATTERN, "").replace(OUTPUT_END_PATTERN, "");
}
