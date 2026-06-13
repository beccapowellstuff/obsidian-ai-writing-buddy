import { INTERFACE_TEXT } from "../config/language/en-gb";

type ProviderErrorKind = "no-model-selected" | "provider-memory-unavailable" | "empty-response" | "rejected-request" | "timeout" | "connection" | "unknown";

type ProviderErrorRule = {
	kind: Exclude<ProviderErrorKind, "unknown">;
	patterns: readonly string[];
};

const PROVIDER_ERROR_RULES: readonly ProviderErrorRule[] = [
	{
		kind: "no-model-selected",
		patterns: ["model name is required"],
	},
	{
		kind: "provider-memory-unavailable",
		patterns: ["provider-side conversation state is not implemented"],
	},
	{
		kind: "empty-response",
		patterns: ["empty response"],
	},
	{
		kind: "rejected-request",
		patterns: ["failed with status"],
	},
	{
		kind: "timeout",
		patterns: ["timed out"],
	},
	{
		kind: "connection",
		patterns: ["failed to fetch", "network", "econnrefused", "connection refused"],
	},
];

export function formatProviderErrorMessage(error: unknown): string {
	const technicalMessage = extractErrorMessage(error);
	const errorKind = classifyProviderError(technicalMessage);

	return formatKnownProviderError(errorKind, technicalMessage);
}

function classifyProviderError(technicalMessage: string): ProviderErrorKind {
	const lowerMessage = technicalMessage.toLowerCase();

	const matchingRule = PROVIDER_ERROR_RULES.find(({ patterns }) => patterns.some((pattern) => lowerMessage.includes(pattern)));

	return matchingRule?.kind ?? "unknown";
}

function formatKnownProviderError(errorKind: ProviderErrorKind, technicalMessage: string): string {
	switch (errorKind) {
		case "no-model-selected":
			return INTERFACE_TEXT.errors.noModelSelected(technicalMessage);

		case "provider-memory-unavailable":
			return INTERFACE_TEXT.errors.providerMemoryUnavailable(technicalMessage);

		case "empty-response":
			return INTERFACE_TEXT.errors.emptyProviderResponse(technicalMessage);

		case "rejected-request":
			return INTERFACE_TEXT.errors.rejectedProviderRequest(technicalMessage);

		case "timeout":
			return INTERFACE_TEXT.errors.providerRequestTimedOut(technicalMessage);

		case "connection":
			return INTERFACE_TEXT.errors.unreachableProvider(technicalMessage);

		case "unknown":
			return INTERFACE_TEXT.errors.responseFailed(technicalMessage);
	}
}

function extractErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		const message = error.message.trim();

		if (message) {
			return message;
		}
	}

	if (typeof error === "string") {
		const message = error.trim();

		if (message) {
			return message;
		}
	}

	return "Unknown provider error.";
}
