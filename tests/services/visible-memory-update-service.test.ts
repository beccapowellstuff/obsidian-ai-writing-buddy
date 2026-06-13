import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import type { AiWritingBuddySettings } from "../../src/config/default-settings";
import { AiVisibleMemoryUpdateService } from "../../src/services/visible-memory-update-service";

function createSettings(): AiWritingBuddySettings {
	return {
		...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
		aiMemoryEnabled: true,
		aiMemoryAutoUpdateEnabled: true,
		aiMemoryShowUpdateNotice: false,
	};
}

function createEntry(message = "Please remember that I like quiet writing sessions.") {
	return {
		id: "entry-1",
		type: "chat" as const,
		message,
		response: {
			text: "Of course.",
			createdAt: "2026-06-13T20:30:00.000Z",
			isPlaceholder: false,
		},
		createdAt: "2026-06-13T20:30:00.000Z",
	};
}

function createService(providerResponse: string, currentMemory = "## Preferences\n- Likes quiet writing sessions.") {
	const settings = createSettings();

	const aiMemoryService = {
		readManagedBlockForUpdate: vi.fn().mockResolvedValue({
			content: currentMemory,
			filePath: "AI Memory.md",
		}),
		replaceManagedBlockIfUnchanged: vi.fn().mockResolvedValue("updated"),
	};

	const aiResponseService = {
		createMemoryUpdateResponse: vi.fn().mockResolvedValue(providerResponse),
	};

	const onSaveSettings = vi.fn().mockResolvedValue(undefined);

	const service = new AiVisibleMemoryUpdateService(aiMemoryService as never, () => aiResponseService as never, settings, onSaveSettings);

	return {
		service,
		aiMemoryService,
		aiResponseService,
		onSaveSettings,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("AiVisibleMemoryUpdateService", () => {
	it("does not write memory when the provider returns NO_CHANGE", async () => {
		const { service, aiMemoryService, onSaveSettings } = createService("NO_CHANGE");

		await service.updateAfterChatResponse({
			entry: createEntry(),
			assistantResponseText: "Of course.",
		});

		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});

	it("does not write memory when the provider wraps JSON in a code fence", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { service, aiMemoryService, onSaveSettings } = createService(["```json", '{ "add": [], "update": [], "remove": [] }', "```"].join("\n"));

		await service.updateAfterChatResponse({
			entry: createEntry(),
			assistantResponseText: "Of course.",
		});

		expect(warning).toHaveBeenCalledWith("AI Writing Buddy memory update rejected", {
			reason: "code-fence",
		});
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});

	it("does not write memory when the provider returns malformed JSON", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { service, aiMemoryService, onSaveSettings } = createService('{ "add": [], "update": [], "remove": [ }');

		await service.updateAfterChatResponse({
			entry: createEntry(),
			assistantResponseText: "Of course.",
		});

		expect(warning).toHaveBeenCalledWith(
			"AI Writing Buddy memory update rejected",
			expect.objectContaining({
				reason: "malformed-json",
			}),
		);
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});

	it("does not write memory when required operation arrays are missing", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { service, aiMemoryService, onSaveSettings } = createService(
			JSON.stringify({
				add: [],
				update: [],
			}),
		);

		await service.updateAfterChatResponse({
			entry: createEntry(),
			assistantResponseText: "Of course.",
		});

		expect(warning).toHaveBeenCalledWith("AI Writing Buddy memory update rejected", {
			reason: "invalid-schema",
		});
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});
	it("does not write memory when the provider exceeds the add-operation limit", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { service, aiMemoryService, onSaveSettings } = createService(
			JSON.stringify({
				add: Array.from({ length: 6 }, (_, index) => ({
					heading: "Preferences",
					text: `New preference ${index + 1}`,
				})),
				update: [],
				remove: [],
			}),
		);

		await service.updateAfterChatResponse({
			entry: createEntry(),
			assistantResponseText: "Of course.",
		});

		expect(warning).toHaveBeenCalledWith("AI Writing Buddy memory update rejected", {
			reason: "too-many-operations",
		});
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});
	it("does not write memory when an addition duplicates an existing bullet", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { service, aiMemoryService, onSaveSettings } = createService(JSON.stringify({ add: [{ heading: "Preferences", text: "Likes quiet writing sessions" }], update: [], remove: [] }));
		await service.updateAfterChatResponse({ entry: createEntry(), assistantResponseText: "Of course." });
		expect(warning).toHaveBeenCalledWith("AI Writing Buddy memory add skipped", { reason: "duplicate" });
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});
	it("updates memory when exactly one bullet matches", async () => {
		const { service, aiMemoryService, onSaveSettings } = createService(
			JSON.stringify({
				add: [],
				update: [
					{
						heading: "Preferences",
						match: "Likes quiet writing sessions",
						replacement: "Prefers calm writing sessions.",
					},
				],
				remove: [],
			}),
		);

		await service.updateAfterChatResponse({
			entry: createEntry(),
			assistantResponseText: "Of course.",
		});

		expect(aiMemoryService.replaceManagedBlockIfUnchanged).toHaveBeenCalledWith(
			expect.any(Object),
			"## Preferences\n- Likes quiet writing sessions.",
			"## Preferences\n- Prefers calm writing sessions.",
		);
		expect(onSaveSettings).toHaveBeenCalledOnce();
	});
	it("does not update memory when more than one bullet matches", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { service, aiMemoryService, onSaveSettings } = createService(
			JSON.stringify({
				add: [],
				update: [
					{
						heading: "Preferences",
						match: "Likes quiet writing sessions",
						replacement: "Prefers calm writing sessions.",
					},
				],
				remove: [],
			}),
			["## Preferences", "- Likes quiet writing sessions.", "- Likes quiet writing sessions."].join("\n"),
		);

		await service.updateAfterChatResponse({
			entry: createEntry(),
			assistantResponseText: "Of course.",
		});

		expect(warning).toHaveBeenCalledWith("AI Writing Buddy memory operation skipped", {
			reason: "ambiguous-match",
			heading: "Preferences",
		});
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});
	it("does not remove memory without explicit user intent", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { service, aiMemoryService, onSaveSettings } = createService(
			JSON.stringify({
				add: [],
				update: [],
				remove: [
					{
						heading: "Preferences",
						match: "Likes quiet writing sessions",
					},
				],
			}),
		);

		await service.updateAfterChatResponse({
			entry: createEntry("Tell me more about quiet writing sessions."),
			assistantResponseText: "Of course.",
		});

		expect(warning).toHaveBeenCalledWith("AI Writing Buddy memory remove operations skipped", {
			reason: "removal-without-intent",
			count: 1,
		});
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).not.toHaveBeenCalled();
		expect(onSaveSettings).not.toHaveBeenCalled();
	});
	it("removes memory when the user explicitly asks to forget it", async () => {
		const { service, aiMemoryService, onSaveSettings } = createService(JSON.stringify({ add: [], update: [], remove: [{ heading: "Preferences", match: "Likes quiet writing sessions" }] }));
		await service.updateAfterChatResponse({ entry: createEntry("Please forget that I like quiet writing sessions."), assistantResponseText: "Of course." });
		expect(aiMemoryService.replaceManagedBlockIfUnchanged).toHaveBeenCalledWith(expect.any(Object), "## Preferences\n- Likes quiet writing sessions.", "## Preferences");
		expect(onSaveSettings).toHaveBeenCalledOnce();
	});
});
