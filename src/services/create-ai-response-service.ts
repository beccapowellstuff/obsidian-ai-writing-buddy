import { AiWritingBuddySettings } from "../config/default-settings";
import { AiResponseService } from "./ai-response-service";
import { MockAiResponseService } from "./mock-ai-response-service";
import { OpenAiCompatibleResponseService } from "./open-ai-compatible-response-service";

export function createAiResponseService(settings: AiWritingBuddySettings): AiResponseService {
	if (settings.provider === "mock") {
		return new MockAiResponseService();
	}

	return new OpenAiCompatibleResponseService(settings);
}
