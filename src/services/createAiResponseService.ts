import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiResponseService } from "./AiResponseService";
import { MockAiResponseService } from "./MockAiResponseService";

export function createAiResponseService(settings: AiDraftBenchSettings): AiResponseService {
	if (settings.provider === "mock") {
		return new MockAiResponseService();
	}

	console.warn("OpenAI-compatible provider is selected, but it is not wired yet. Falling back to mock provider.");

	return new MockAiResponseService();
}
