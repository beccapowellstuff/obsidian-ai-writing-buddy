import { INTERFACE_TEXT } from "../config/language/en-gb";

export type ProviderErrorKind = "no-model-selected" | "provider-memory-unavailable" | "empty-response" | "rejected-request" | "timeout" | "connection" | "unknown";

export type ProviderErrorDetails = {
	kind: ProviderErrorKind;
	technicalMessage: string;
	httpStatus?: number;
	code?: string;
};

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
	const { kind, technicalMessage } = getProviderErrorDetails(error);

	return formatKnownProviderError(kind, technicalMessage);
}

export function getProviderErrorDetails(error: unknown): ProviderErrorDetails {
	const technicalMessage = extractErrorMessage(error);

	return {
		kind: classifyProviderError(technicalMessage),
		technicalMessage,
		httpStatus: extractHttpStatus(technicalMessage),
		code: extractSafeErrorCode(error),
	};
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

function extractHttpStatus(message: string): number | undefined {
	const match = message.match(/\bstatus\s+(\d{3})\b/i);
	const status = match?.[1] ? Number.parseInt(match[1], 10) : undefined;

	return status && status >= 100 && status <= 599 ? status : undefined;
}

function extractSafeErrorCode(error: unknown): string | undefined {
	if (!(error instanceof Error) || !error.name || error.name === "Error") {
		return undefined;
	}

	return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(error.name) ? error.name : undefined;
}
