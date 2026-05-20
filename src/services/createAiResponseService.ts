import { AiDraftBenchSettings } from "../config/defaultSettings";
import { AiResponseService } from "./AiResponseService";
import { MockAiResponseService } from "./MockAiResponseService";
import { OpenAiCompatibleResponseService } from "./OpenAiCompatibleResponseService";

export function createAiResponseService(settings: AiDraftBenchSettings): AiResponseService {
	if (settings.provider === "mock") {
		return new MockAiResponseService();
	}

	return new OpenAiCompatibleResponseService(settings);
}
