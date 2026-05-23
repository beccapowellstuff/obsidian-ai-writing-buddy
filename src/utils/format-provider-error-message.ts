export function formatProviderErrorMessage(error: unknown): string {
	const technicalMessage = getTechnicalErrorMessage(error);
	const lowerMessage = technicalMessage.toLowerCase();

	if (lowerMessage.includes("model name is required")) {
		return ["No model is selected.", "", "Choose a model in AI Writing Buddy settings, then try again.", "", `Technical detail: ${technicalMessage}`].join("\n");
	}

	if (lowerMessage.includes("provider-side conversation state is not implemented")) {
		return [
			"Provider-side conversation memory is not available yet.",
			"",
			"Switch the conversation memory strategy back to plugin-managed memory, then try again.",
			"",
			`Technical detail: ${technicalMessage}`,
		].join("\n");
	}

	if (lowerMessage.includes("empty response")) {
		return [
			"The AI provider replied, but did not return any text.",
			"",
			"Try again, or check that the selected model supports chat completions.",
			"",
			`Technical detail: ${technicalMessage}`,
		].join("\n");
	}

	if (lowerMessage.includes("failed with status")) {
		return ["The AI provider rejected the request.", "", "Check the server address, selected model, and API key if your provider needs one.", "", `Technical detail: ${technicalMessage}`].join(
			"\n",
		);
	}

	if (lowerMessage.includes("failed to fetch") || lowerMessage.includes("network") || lowerMessage.includes("econnrefused") || lowerMessage.includes("connection refused")) {
		return [
			"AI Writing Buddy could not reach the AI provider.",
			"",
			"Check that the provider is running and that the server address is correct.",
			"",
			`Technical detail: ${technicalMessage}`,
		].join("\n");
	}

	return [
		"The AI provider failed while creating a response.",
		"",
		"Check your provider settings, server address, selected model, and API key if needed.",
		"",
		`Technical detail: ${technicalMessage}`,
	].join("\n");
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
