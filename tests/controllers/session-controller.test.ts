import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { INTERFACE_TEXT } from "../../src/config/language/en-gb";
import { AiWritingBuddySessionController } from "../../src/controllers/session-controller";
import type { AiResponseService } from "../../src/services/ai-response-service";
import type { AiWritingBuddyResponse } from "../../src/types/ai-writing-buddy-response";

type CreateChatResponseMock = ReturnType<typeof vi.fn<AiResponseService["createChatResponse"]>>;

describe("AiWritingBuddySessionController", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("notifies chat completion after a successful chat response", async () => {
		const response = createCompletedResponse("Draft response.", "Review note.");
		const createChatResponse = vi.fn<AiResponseService["createChatResponse"]>().mockResolvedValue(response);
		const harness = createControllerHarness({
			createChatResponse,
		});

		await harness.controller.addChatEntry("Hello");

		const entry = harness.controller.getEntries()[0];
		expect(entry?.type).toBe("chat");
		expect(harness.onChatResponseCompleted).toHaveBeenCalledWith(entry, "Review note.\n\nDraft response.");
	});

	it("does not notify chat completion when a chat response fails", async () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const createChatResponse = vi.fn<AiResponseService["createChatResponse"]>().mockRejectedValue(new Error("Provider exploded"));
		const harness = createControllerHarness({
			createChatResponse,
		});

		await harness.controller.addChatEntry("Hello");

		const entry = harness.controller.getEntries()[0];
		expect(entry?.type).toBe("chat");
		expect(entry?.response.isPlaceholder).toBe(true);
		expect(entry?.response.text).toContain(INTERFACE_TEXT.responses.providerErrorHeading);
		expect(harness.onChatResponseCompleted).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it("does not notify chat completion when a pending chat response is cancelled", async () => {
		const response = createCompletedResponse("Draft response.");
		const responsePromise = createControlledPromise<AiWritingBuddyResponse>();
		const createChatResponse = vi.fn<AiResponseService["createChatResponse"]>().mockReturnValue(responsePromise.promise);
		const harness = createControllerHarness({
			createChatResponse,
			nextEntryId: "00000000-0000-4000-8000-000000000002",
		});

		const pending = harness.controller.addChatEntry("Hello");
		await waitForMockCall(harness.createChatResponse);

		harness.controller.cancelResponse(harness.nextEntryId);
		responsePromise.resolve(response);
		await pending;

		const entry = harness.controller.getEntries()[0];
		expect(entry?.type).toBe("chat");
		expect(entry?.response).toMatchObject({
			text: INTERFACE_TEXT.responses.cancelled,
			isPlaceholder: true,
		});
		expect(harness.onChatResponseCompleted).not.toHaveBeenCalled();
	});
});

function createControllerHarness(options: {
	createChatResponse: CreateChatResponseMock;
	nextEntryId?: `${string}-${string}-${string}-${string}-${string}`;
}) {
	const nextEntryId = options.nextEntryId ?? "00000000-0000-4000-8000-000000000001";

	vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(nextEntryId);
	const createSelectionResponse = vi.fn();
	const createMemoryUpdateResponse = vi.fn();
	const getAiResponseService = vi.fn((): AiResponseService => ({
		createChatResponse: options.createChatResponse,
		createSelectionResponse,
		createMemoryUpdateResponse,
	}));
	const onChatResponseCompleted = vi.fn();
	const onSave = vi.fn();
	const onChange = vi.fn();
	const onNewSession = vi.fn(async () => undefined);
	const getNoteContext = vi.fn(async () => undefined);
	const getVisibleMemory = vi.fn(async () => undefined);

	const controller = new AiWritingBuddySessionController(
		getAiResponseService,
		onChange,
		onSave,
		onNewSession,
		getNoteContext,
		getVisibleMemory,
		onChatResponseCompleted,
		DEFAULT_AI_WRITING_BUDDY_SETTINGS,
	);

	return {
		controller,
		createChatResponse: options.createChatResponse,
		nextEntryId,
		onChatResponseCompleted,
		onSave,
		onChange,
	};
}

function createCompletedResponse(text: string, commentText?: string): AiWritingBuddyResponse {
	return {
		text,
		commentText,
		createdAt: "2026-01-01T00:00:00.000Z",
		isPlaceholder: false,
	};
}

function createControlledPromise<T>() {
	let resolvePromise: (value: T) => void = () => undefined;
	const promise = new Promise<T>((resolve) => {
		resolvePromise = resolve;
	});

	return {
		promise,
		resolve: resolvePromise,
	};
}

async function waitForMockCall(mock: CreateChatResponseMock): Promise<void> {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		if (mock.mock.calls.length > 0) {
			return;
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	}

	throw new Error("Expected mock to be called.");
}
