export type ProviderProtocol = "openai-compatible";

export type ProviderPresetId = "lm-studio" | "ollama-openai" | "open-webui" | "manual-openai-compatible";

export type ProviderPreset = {
	id: ProviderPresetId;
	label: string;
	protocol: ProviderProtocol;
	defaultBaseUrl: string;
	defaultEmbeddingBaseUrl: string;
	apiKeyMode: "none" | "optional" | "required";
	description: string;
};

export const DEFAULT_PROVIDER_PRESET_ID: ProviderPresetId = "lm-studio";

export const PROVIDER_PRESETS: ProviderPreset[] = [
	{
		id: "lm-studio",
		label: "LM Studio",
		protocol: "openai-compatible",
		defaultBaseUrl: "http://localhost:1234/v1",
		defaultEmbeddingBaseUrl: "http://localhost:1234/v1",
		apiKeyMode: "optional",
		description: "Use LM Studio's local OpenAI-compatible server. Start the local server and load a model before testing the connection.",
	},
	{
		id: "ollama-openai",
		label: "Ollama",
		protocol: "openai-compatible",
		defaultBaseUrl: "http://localhost:11434/v1",
		defaultEmbeddingBaseUrl: "http://localhost:11434/v1",
		apiKeyMode: "optional",
		description: "Use Ollama's OpenAI-compatible endpoint. Pull the model in Ollama first, then use the model name here.",
	},
	{
		id: "open-webui",
		label: "Open WebUI / local proxy",
		protocol: "openai-compatible",
		defaultBaseUrl: "http://localhost:8080/api",
		defaultEmbeddingBaseUrl: "http://localhost:8080/api",
		apiKeyMode: "optional",
		description: "Use an OpenAI-compatible proxy such as Open WebUI. Check the proxy settings for the exact base URL.",
	},
	{
		id: "manual-openai-compatible",
		label: "Manual OpenAI-compatible endpoint",
		protocol: "openai-compatible",
		defaultBaseUrl: "",
		defaultEmbeddingBaseUrl: "",
		apiKeyMode: "optional",
		description: "Use this for any OpenAI-compatible server. Enter the base URL and model name manually.",
	},
];

export function getProviderPreset(id: string): ProviderPreset {
	const fallbackPreset = PROVIDER_PRESETS.find((preset) => preset.id === DEFAULT_PROVIDER_PRESET_ID);

	if (!fallbackPreset) {
		throw new Error("Default provider preset is missing.");
	}

	return PROVIDER_PRESETS.find((preset) => preset.id === id) ?? fallbackPreset;
}
