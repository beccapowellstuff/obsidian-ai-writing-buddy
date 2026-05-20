export type AiDraftBenchProvider = "mock" | "openai-compatible";

export type AiDraftBenchSettings = {
	provider: AiDraftBenchProvider;
	baseUrl: string;
	modelName: string;
	apiKey: string;
	requestTimeoutMs: number;
	openChatSystemPrompt: string;
	selectionSystemPrompt: string;
	personalityEnabled: boolean;
	personalityPrompt: string;
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

export const DEFAULT_PERSONALITY_PROMPT = ["Be friendly, thoughtful, and practical.", "Give useful writing help without being overly formal.", "Challenge unclear writing when needed, but stay kind."].join("\n");

export const DEFAULT_AI_DRAFT_BENCH_SETTINGS: AiDraftBenchSettings = {
	provider: "mock",
	baseUrl: "http://localhost:1234/v1",
	modelName: "",
	apiKey: "",
	requestTimeoutMs: 60000,
	openChatSystemPrompt: DEFAULT_OPEN_CHAT_SYSTEM_PROMPT,
	selectionSystemPrompt: DEFAULT_SELECTION_SYSTEM_PROMPT,
	personalityEnabled: false,
	personalityPrompt: DEFAULT_PERSONALITY_PROMPT,
};
