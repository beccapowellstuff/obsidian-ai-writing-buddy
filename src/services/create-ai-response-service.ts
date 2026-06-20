import type { AiWritingBuddySettings } from "../config/default-settings";
import type { AiResponseService } from "./ai-response-service";
import { OpenAiCompatibleResponseService } from "./open-ai-compatible-response-service";

export function createAiResponseService(settings: AiWritingBuddySettings): AiResponseService {
	return new OpenAiCompatibleResponseService(settings);
}
