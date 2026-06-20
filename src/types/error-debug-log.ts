export type ErrorDebugLogSource = "provider" | "plugin";

export type ErrorDebugLogEntry = {
	timestamp: string;
	source: ErrorDebugLogSource;
	providerType?: string;
	category?: string;
	httpStatus?: number;
	code?: string;
	message: string;
	pluginVersion?: string;
	operation?: string;
};

export type ErrorDebugLogInput = {
	source: ErrorDebugLogSource;
	providerType?: string;
	category?: string;
	httpStatus?: number;
	code?: string;
	message?: string;
	pluginVersion?: string;
	operation?: string;
};
