export type ConversationMemoryMode = "none" | "provider-state" | "local-trimmed-history";

export type ConversationMemoryStrategy = {
	mode: ConversationMemoryMode;
	providerLabel: string;
	reason: string;
};