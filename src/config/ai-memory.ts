export const AI_MEMORY_START_MARKER = "<!-- AIWB_MEMORY_START -->";
export const AI_MEMORY_END_MARKER = "<!-- AIWB_MEMORY_END -->";

export const DEFAULT_AI_MEMORY_FOLDER_PATH = "AI Writing Buddy/Memory";
export const DEFAULT_AI_MEMORY_FILE_NAME = "AI Memory.md";
export const DEFAULT_AI_MEMORY_MAX_PROMPT_CHARACTERS = 8000;
export const DEFAULT_AI_MEMORY_CLEANUP_WRITE_THRESHOLD = 25;
export const MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS = 1000;
export const MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD = 1;

export const DEFAULT_AI_MEMORY_MANAGED_BLOCK = [
	AI_MEMORY_START_MARKER,
	"",
	"## User preferences",
	"",
	"- ",
	"",
	"## Writing projects",
	"",
	"- ",
	"",
	"## Style guidance",
	"",
	"- ",
	"",
	"## Useful facts",
	"",
	"- ",
	"",
	"## Things to avoid",
	"",
	"- ",
	"",
	AI_MEMORY_END_MARKER,
].join("\n");

export const DEFAULT_AI_MEMORY_NOTE_CONTENT = [
	"# AI Writing Buddy Memory",
	"",
	"This note is used by AI Writing Buddy as visible, editable memory.",
	"",
	"You can edit this file manually. If automatic AI memory updates are enabled, AI Writing Buddy may update the managed memory section below after chat responses.",
	"",
	DEFAULT_AI_MEMORY_MANAGED_BLOCK,
	"",
	"## Manual notes",
	"",
	"Anything written outside the managed memory block should not be changed automatically by AI Writing Buddy.",
].join("\n");
