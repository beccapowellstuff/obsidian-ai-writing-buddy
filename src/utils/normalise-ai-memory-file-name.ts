import { DEFAULT_AI_MEMORY_FILE_NAME } from "../config/ai-memory";

function sanitiseAiMemoryFileName(fileName: string): string {
	const cleanedFileName = fileName
		.replace(/[\\/]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return cleanedFileName || DEFAULT_AI_MEMORY_FILE_NAME;
}

function ensureMarkdownExtension(fileName: string): string {
	return fileName.toLowerCase().endsWith(".md") ? fileName : `${fileName}.md`;
}

export function normaliseAiMemoryFileName(fileName: string): string {
	return ensureMarkdownExtension(sanitiseAiMemoryFileName(fileName));
}
