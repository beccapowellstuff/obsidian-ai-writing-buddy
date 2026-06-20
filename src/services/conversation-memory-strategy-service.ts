import type { AiWritingBuddySettings } from "../config/default-settings";
import { getProviderPreset } from "../config/provider-presets";
import type { ConversationMemoryStrategy } from "../types/conversation-memory-strategy";

export class ConversationMemoryStrategyService {
	getStrategy(settings: AiWritingBuddySettings): ConversationMemoryStrategy {
		const providerPreset = getProviderPreset(settings.providerPresetId);

		return {
			mode: "local-trimmed-history",
			providerLabel: providerPreset.label,
			reason: `${providerPreset.label} uses trimmed local history until provider-side state support is available.`,
		};
	}
}
