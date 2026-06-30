export type ErrorDebugLogSource = "provider" | "plugin";

export const ERROR_DEBUG_LOG_OPERATIONS = {
	chatResponse: "chat-response",
	connectionTest: "connection-test",
	embeddingConnectionTest: "embedding-connection-test",
	embeddingModelList: "embedding-model-list",
	modelList: "model-list",
	ragIndexAction: "rag-index-action",
	ragIndexStatusRefresh: "rag-index-status-refresh",
	selectionResponse: "selection-response",
	sessionSave: "session-save",
} as const;

export type ErrorDebugLogOperation = (typeof ERROR_DEBUG_LOG_OPERATIONS)[keyof typeof ERROR_DEBUG_LOG_OPERATIONS];

export type ErrorDebugLogEntry = {
	timestamp: string;
	source: ErrorDebugLogSource;
	providerType?: string;
	category?: string;
	httpStatus?: number;
	code?: string;
	message: string;
	pluginVersion?: string;
	operation?: ErrorDebugLogOperation;
};

export type ErrorDebugLogInput = {
	source: ErrorDebugLogSource;
	providerType?: string;
	category?: string;
	httpStatus?: number;
	code?: string;
	message?: string;
	pluginVersion?: string;
	operation?: ErrorDebugLogOperation;
};
