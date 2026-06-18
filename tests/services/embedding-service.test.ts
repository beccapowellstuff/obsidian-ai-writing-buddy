import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { EmbeddingService } from "../../src/services/embedding-service";

function createService(requestTimeoutMs = 60000): EmbeddingService {
	return new EmbeddingService({
		...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
		baseUrl: "http://localhost:1234/v1",
		embeddingBaseUrl: "http://localhost:1234/v1",
		embeddingModelName: "text-embedding-test",
		requestTimeoutMs,
	});
}

describe("EmbeddingService", () => {
	beforeEach(() => {
		vi.stubGlobal("window", {
			fetch: vi.fn(),
			clearTimeout: vi.fn(),
			setTimeout: (_callback: () => void) => 1,
		});
	});

	it("requires an embedding model name", async () => {
		const service = new EmbeddingService({
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			baseUrl: "http://localhost:1234/v1",
			embeddingBaseUrl: "http://localhost:1234/v1",
		});

		await expect(service.embedTexts(["hello"])).rejects.toThrow("Embedding model is not configured.");
	});

	it("does not treat the chat server address as an embedding server", async () => {
		const service = new EmbeddingService({
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			baseUrl: "http://localhost:1234/v1",
			embeddingModelName: "text-embedding-test",
		});

		expect(service.isConfigured()).toBe(false);
		await expect(service.embedTexts(["hello"])).rejects.toThrow("Embedding server address is required.");
	});

	it("reports an unreachable embedding provider", async () => {
		const fetchMock = window.fetch as Mock;

		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

		await expect(createService().embedTexts(["hello"])).rejects.toThrow("Failed to fetch");
	});

	it("mentions model loading for non-success embedding responses", async () => {
		const fetchMock = window.fetch as Mock;

		fetchMock.mockResolvedValue({
			status: 404,
			json: async () => ({}),
		});

		await expect(createService().embedTexts(["hello"])).rejects.toThrow("Make sure the embedding provider is running and the model is loaded.");
	});

	it("reports embedding request timeouts", async () => {
		const fetchMock = window.fetch as Mock;

		vi.stubGlobal("window", {
			fetch: fetchMock,
			clearTimeout: vi.fn(),
			setTimeout: (callback: () => void) => {
				callback();
				return 1;
			},
		});
		fetchMock.mockImplementation((_url, options: RequestInit) => {
			const reason: unknown = (options.signal as AbortSignal).reason;

			return Promise.reject(reason instanceof Error ? reason : new Error("Embedding request aborted."));
		});

		await expect(createService(50).embedTexts(["hello"])).rejects.toThrow("Embedding provider request timed out after 50ms.");
	});
});
