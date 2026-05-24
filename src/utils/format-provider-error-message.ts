import { INTERFACE_TEXT } from "../config/language/en-gb";

export function formatProviderErrorMessage(error: unknown): string {
	const technicalMessage = getTechnicalErrorMessage(error);
	const lowerMessage = technicalMessage.toLowerCase();

	if (lowerMessage.includes("model name is required")) {
		return INTERFACE_TEXT.errors.noModelSelected(technicalMessage);
	}

	if (lowerMessage.includes("provider-side conversation state is not implemented")) {
		return INTERFACE_TEXT.errors.providerMemoryUnavailable(technicalMessage);
	}

	if (lowerMessage.includes("empty response")) {
		return INTERFACE_TEXT.errors.emptyProviderResponse(technicalMessage);
	}

	if (lowerMessage.includes("failed with status")) {
		return INTERFACE_TEXT.errors.rejectedProviderRequest(technicalMessage);
	}

	if (lowerMessage.includes("failed to fetch") || lowerMessage.includes("network") || lowerMessage.includes("econnrefused") || lowerMessage.includes("connection refused")) {
		return INTERFACE_TEXT.errors.unreachableProvider(technicalMessage);
	}

	return INTERFACE_TEXT.errors.responseFailed(technicalMessage);
}

function getTechnicalErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}

	if (typeof error === "string" && error.trim()) {
		return error.trim();
	}

	return "Unknown provider error.";
}
