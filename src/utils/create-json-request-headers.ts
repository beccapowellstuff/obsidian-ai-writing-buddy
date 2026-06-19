export function createJsonRequestHeaders(apiKey?: string): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	const trimmedApiKey = apiKey?.trim() ?? "";

	if (trimmedApiKey) {
		headers.Authorization = `Bearer ${trimmedApiKey}`;
	}

	return headers;
}
