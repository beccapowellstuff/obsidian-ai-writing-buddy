import { PromptTemplate } from "../types/prompt-template";
import type { AiWritingBuddyContextOptions } from "../types/ai-writing-buddy-context";
import {
	DEFAULT_AI_MEMORY_CLEANUP_WRITE_THRESHOLD,
	DEFAULT_AI_MEMORY_FILE_NAME,
	DEFAULT_AI_MEMORY_FOLDER_PATH,
	DEFAULT_AI_MEMORY_MAX_PROMPT_CHARACTERS,
} from "./ai-memory";
import { DEFAULT_PROMPT_TEMPLATES } from "./default-prompt-templates";
export type AiWritingBuddyProvider = "mock" | "openai-compatible";

export type AiWritingBuddySettings = {
	provider: AiWritingBuddyProvider;
	baseUrl: string;
	modelName: string;
	apiKey: string;
	embeddingBaseUrl: string;
	embeddingModelName: string;
	embeddingApiKey: string;
	requestTimeoutMs: number;
	maxPromptCharacters: number;
	memoryEnabled: boolean;
	memoryBudgetCharacters: number;
	recentHistoryMaxEntries: number;
	aiMemoryEnabled: boolean;
	aiMemoryAutoUpdateEnabled: boolean;
	aiMemoryFolderPath: string;
	aiMemoryFileName: string;
	aiMemoryMaxPromptCharacters: number;
	aiMemoryShowUpdateNotice: boolean;
	aiMemoryWriteCount: number;
	aiMemoryCleanupEnabled: boolean;
	aiMemoryCleanupWriteThreshold: number;
	openChatSystemPrompt: string;
	selectionSystemPrompt: string;
	personalityEnabled: boolean;
	personalityPrompt: string;
	contextOptions: AiWritingBuddyContextOptions;
	promptTemplates: PromptTemplate[];
};

export const DEFAULT_OPEN_CHAT_SYSTEM_PROMPT = [
	"You are an AI writing assistant inside Obsidian.",
	"Help the user think, draft, revise, and improve their notes.",
	"Be clear, practical, and concise.",
	"Do not modify notes directly. The user will choose whether to copy, insert, or replace text.",
].join("\n");

export const DEFAULT_SELECTION_SYSTEM_PROMPT = [
	"You are an AI writing assistant inside Obsidian.",
	"The user has selected text from a note and is asking you to work with that text.",
	"Use the selected text as the main source context.",
	"Follow the user's instruction carefully.",
	"Do not claim you changed the note directly. Only provide the draft response.",
].join("\n");

export const DEFAULT_PERSONALITY_PROMPT = [
	"Be friendly, thoughtful, and practical.",
	"Give useful writing help without being overly formal.",
	"Challenge unclear writing when needed, but stay kind.",
].join("\n");

export const DEFAULT_MAX_PROMPT_CHARACTERS = 120000;
export const DEFAULT_MEMORY_BUDGET_CHARACTERS = 6000;
export const DEFAULT_RECENT_HISTORY_MAX_ENTRIES = 6;
export const DEFAULT_CONTEXT_OPTIONS: AiWritingBuddyContextOptions = {
	enabled: false,
	scope: "current-note",
	includeIndexedRag: false,
};

export const DEFAULT_AI_WRITING_BUDDY_SETTINGS: AiWritingBuddySettings = {
	provider: "mock",
	baseUrl: "http://localhost:1234/v1",
	modelName: "",
	apiKey: "",
	embeddingBaseUrl: "",
	embeddingModelName: "",
	embeddingApiKey: "",
	requestTimeoutMs: 60000,
	maxPromptCharacters: DEFAULT_MAX_PROMPT_CHARACTERS,
	memoryEnabled: true,
	memoryBudgetCharacters: DEFAULT_MEMORY_BUDGET_CHARACTERS,
	recentHistoryMaxEntries: DEFAULT_RECENT_HISTORY_MAX_ENTRIES,
	aiMemoryEnabled: false,
	aiMemoryAutoUpdateEnabled: false,
	aiMemoryFolderPath: DEFAULT_AI_MEMORY_FOLDER_PATH,
	aiMemoryFileName: DEFAULT_AI_MEMORY_FILE_NAME,
	aiMemoryMaxPromptCharacters: DEFAULT_AI_MEMORY_MAX_PROMPT_CHARACTERS,
	aiMemoryShowUpdateNotice: true,
	aiMemoryWriteCount: 0,
	aiMemoryCleanupEnabled: true,
	aiMemoryCleanupWriteThreshold: DEFAULT_AI_MEMORY_CLEANUP_WRITE_THRESHOLD,
	openChatSystemPrompt: DEFAULT_OPEN_CHAT_SYSTEM_PROMPT,
	selectionSystemPrompt: DEFAULT_SELECTION_SYSTEM_PROMPT,
	personalityEnabled: false,
	personalityPrompt: DEFAULT_PERSONALITY_PROMPT,
	contextOptions: DEFAULT_CONTEXT_OPTIONS,
	promptTemplates: DEFAULT_PROMPT_TEMPLATES,
};
