import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { ErrorDebugLogService } from "../../src/services/error-debug-log-service";

describe("ErrorDebugLogService", () => {
	let temporaryDirectory: string;
	let service: ErrorDebugLogService;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "ai-writing-buddy-debug-log-"));
		service = new ErrorDebugLogService(temporaryDirectory);
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
	});

	afterEach(async () => {
		vi.useRealTimers();
		await rm(temporaryDirectory, { recursive: true, force: true });
	});

	it("is disabled by default in settings", () => {
		expect(DEFAULT_AI_WRITING_BUDDY_SETTINGS.errorDebugLoggingEnabled).toBe(false);
	});

	it("does not store entries when logging is disabled", async () => {
		await service.appendEntry(false, {
			source: "provider",
			providerType: "openai-compatible",
			category: "timeout",
			message: "AI provider request timed out after 60000ms.",
		});

		expect(await service.readEntries()).toEqual([]);
	});

	it("stores provider errors when enabled", async () => {
		await service.appendEntry(true, {
			source: "provider",
			providerType: "openai-compatible",
			category: "rejected-request",
			httpStatus: 503,
			code: "ProviderError",
			message: "AI provider request failed with status 503.",
			pluginVersion: "1.0.0",
			operation: "chat-response",
		});

		expect(await service.readEntries()).toEqual([
			{
				timestamp: "2026-01-01T00:00:00.000Z",
				source: "provider",
				providerType: "openai-compatible",
				category: "rejected-request",
				httpStatus: 503,
				code: "ProviderError",
				message: "AI provider request failed with status 503.",
				pluginVersion: "1.0.0",
				operation: "chat-response",
			},
		]);
	});

	it("stores plugin errors when enabled", async () => {
		await service.appendEntry(true, {
			source: "plugin",
			code: "Error",
			message: "Session history store has not been loaded.",
			operation: "session-save",
		});

		expect(await service.readEntries()).toEqual([
			expect.objectContaining({
				source: "plugin",
				code: "Error",
				message: "Session history store has not been loaded.",
				operation: "session-save",
			}),
		]);
	});

	it("keeps only approved safe fields even if private fields are passed accidentally", async () => {
		await service.appendEntry(true, {
			source: "provider",
			providerType: "openai-compatible",
			category: "connection",
			message: "Failed to fetch",
			prompt: "Rewrite my private paragraph",
			selectedText: "Private selected text",
			apiKey: "sk-private",
			headers: {
				Authorization: "Bearer secret",
			},
			requestBody: {
				messages: ["Private prompt"],
			},
		} as never);

		const rawLog = await readFile(join(temporaryDirectory, "error-debug-log.json"), "utf8");
		const parsedLog = JSON.parse(rawLog) as { entries: Array<Record<string, unknown>> };

		expect(Object.keys(parsedLog.entries[0] ?? {}).sort()).toEqual(["category", "message", "providerType", "source", "timestamp"]);
		expect(rawLog).not.toContain("Rewrite my private paragraph");
		expect(rawLog).not.toContain("Private selected text");
		expect(rawLog).not.toContain("sk-private");
		expect(rawLog).not.toContain("Authorization");
		expect(rawLog).not.toContain("Private prompt");
	});

	it("redacts or drops private message content before writing", async () => {
		await service.appendEntry(true, {
			source: "provider",
			providerType: "openai-compatible",
			category: "unknown",
			message: [
				"prompt: Rewrite this private note",
				"selected text: Secret draft",
				"AI response: Secret reply",
				"Authorization: Bearer secret-token",
				"C:\\Vault\\Story Ideas\\Private Note.md",
				"request body: { private: true }",
			].join(" "),
			operation: "C:\\Vault\\Story Ideas\\Private Note.md",
		});

		const serialisedLog = await service.serialiseEntries();

		expect(serialisedLog).toContain("Unknown provider error.");
		expect(serialisedLog).not.toContain("Rewrite this private note");
		expect(serialisedLog).not.toContain("Secret draft");
		expect(serialisedLog).not.toContain("Secret reply");
		expect(serialisedLog).not.toContain("secret-token");
		expect(serialisedLog).not.toContain("Private Note.md");
		expect(serialisedLog).not.toContain("C:\\Vault");
		expect(serialisedLog).not.toContain("private: true");
	});

	it("clears the log", async () => {
		await service.appendEntry(true, {
			source: "plugin",
			message: "Session history store has not been loaded.",
		});

		await service.clearEntries();

		expect(await service.readEntries()).toEqual([]);
	});

	it("serialises only safe fields for copy and export", async () => {
		await service.appendEntry(true, {
			source: "provider",
			providerType: "openai-compatible",
			category: "timeout",
			message: "AI provider request timed out after 60000ms.",
			secret: "private-key",
		} as never);

		const serialisedLog = await service.serialiseEntries();

		expect(serialisedLog).toContain("AI provider request timed out after 60000ms.");
		expect(serialisedLog).not.toContain("private-key");
		expect(serialisedLog).not.toContain("secret");

		await service.exportEntries();
		const exportedLog = await readFile(join(temporaryDirectory, "error-debug-log-export.txt"), "utf8");

		expect(exportedLog).toBe(serialisedLog);
	});

	it("caps the number of stored entries", async () => {
		for (let index = 0; index < 205; index += 1) {
			await service.appendEntry(true, {
				source: "plugin",
				message: `Safe plugin error ${index}`,
			});
		}

		const entries = await service.readEntries();

		expect(entries).toHaveLength(200);
		expect(entries[0]?.message).toBe("Safe plugin error 5");
	});
});

describe("ErrorDebugLogService.createEntry", () => {
	it("caps long messages", () => {
		const entry = new ErrorDebugLogService("debug-log-test").createEntry({
			source: "plugin",
			message: "a".repeat(300),
		});

		expect(entry.message).toHaveLength(240);
	});
});
