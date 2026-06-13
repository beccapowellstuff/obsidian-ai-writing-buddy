import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { OpenAiCompatibleResponseService } from "../../src/services/open-ai-compatible-response-service";

function createService(requestTimeoutMs = 60000): OpenAiCompatibleResponseService {
	return new OpenAiCompatibleResponseService({
		...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
		provider: "openai-compatible",
		baseUrl: "http://localhost:1234/v1",
		modelName: "test-model",
		requestTimeoutMs,
	});
}

function installWindow(fetchMock: typeof fetch): void {
	vi.stubGlobal("window", {
		fetch: fetchMock,
		setTimeout: globalThis.setTimeout,
		clearTimeout: globalThis.clearTimeout,
	});
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("OpenAiCompatibleResponseService", () => {
	it("aborts the provider request when it times out", async () => {
		vi.useFakeTimers();

		const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(new Error("Fetch aborted.")), { once: true });
			});
		});

		installWindow(fetchMock as typeof fetch);

		const service = createService(50);
		const request = service.createChatResponse({
			message: "Hello",
		});

		const rejectionExpectation = expect(request).rejects.toThrow("AI provider request timed out after 50ms.");

		await vi.advanceTimersByTimeAsync(50);
		await rejectionExpectation;
	});

	it("aborts the provider request when the caller cancels it", async () => {
		const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(new Error("Fetch aborted.")), { once: true });
			});
		});

		installWindow(fetchMock as typeof fetch);

		const controller = new AbortController();
		const service = createService();

		const request = service.createChatResponse({ message: "Hello" }, { signal: controller.signal });

		controller.abort();

		await expect(request).rejects.toMatchObject({
			name: "AbortError",
			message: "The request was cancelled.",
		});
	});

	it("preserves connection failures", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

		installWindow(fetchMock as typeof fetch);

		const service = createService();

		await expect(service.createChatResponse({ message: "Hello" })).rejects.toThrow("Failed to fetch");
	});

	it("throws an error for an unsuccessful HTTP status", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			status: 503,
			json: vi.fn(),
		} as unknown as Response);

		installWindow(fetchMock as typeof fetch);

		const service = createService();

		await expect(service.createChatResponse({ message: "Hello" })).rejects.toThrow("AI provider request failed with status 503.");
	});

	it("throws an error when the provider returns no text", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			status: 200,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							content: "   ",
						},
					},
				],
			}),
		} as unknown as Response);

		installWindow(fetchMock as typeof fetch);

		const service = createService();

		await expect(service.createChatResponse({ message: "Hello" })).rejects.toThrow("AI provider returned an empty response.");
	});
});
