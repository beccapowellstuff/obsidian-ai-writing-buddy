import { AiDraftBenchSettings } from "../config/defaultSettings";
import { ConversationMemoryStrategy } from "../types/ConversationMemoryStrategy";

export class ConversationMemoryStrategyService {
	getStrategy(settings: AiDraftBenchSettings): ConversationMemoryStrategy {
		if (settings.provider === "mock") {
			return {
				mode: "none",
				providerLabel: "Mock",
				reason: "Mock provider does not use conversation memory.",
			};
		}

		return {
			mode: "local-trimmed-history",
			providerLabel: "OpenAI-compatible",
			reason: "OpenAI-compatible chat-completions providers such as LM Studio use trimmed local history until provider-side state support is available.",
		};
	}
}
