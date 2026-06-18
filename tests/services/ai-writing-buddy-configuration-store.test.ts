import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { AiWritingBuddyConfigurationStore } from "../../src/services/ai-writing-buddy-configuration-store";

vi.mock("obsidian", () => ({
	normalizePath: (path: string) => path.replace(/\\/g, "/"),
}));

describe("AiWritingBuddyConfigurationStore", () => {
	let temporaryDirectory: string;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "ai-writing-buddy-config-"));
	});

	afterEach(async () => {
		await rm(temporaryDirectory, { recursive: true, force: true });
	});

	it("loads settings from configuration.json including custom prompts", async () => {
		const customTemplate = {
			id: "custom-template",
			name: "Custom prompt",
			description: "A user-created prompt.",
			scope: "selection" as const,
			prompt: "Do the custom thing.",
			returnsReplacementTextOnly: false,
			highlightChanges: false,
			temperature: 0.7,
			isBuiltIn: false,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		};

		await writeFile(
			join(temporaryDirectory, "configuration.json"),
			JSON.stringify({
				settings: {
					...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
					provider: "openai-compatible",
					modelName: "local-model",
					promptTemplates: [...DEFAULT_AI_WRITING_BUDDY_SETTINGS.promptTemplates, customTemplate],
				},
			}),
			"utf8",
		);

		const settings = await new AiWritingBuddyConfigurationStore(temporaryDirectory).loadSettings();

		expect(settings.provider).toBe("openai-compatible");
		expect(settings.modelName).toBe("local-model");
		expect(settings.promptTemplates).toEqual(expect.arrayContaining([expect.objectContaining({
			id: "custom-template",
			prompt: "Do the custom thing.",
			isBuiltIn: false,
		})]));
	});

	it("uses default settings when configuration.json is missing or invalid", async () => {
		const missingSettings = await new AiWritingBuddyConfigurationStore(temporaryDirectory).loadSettings();

		expect(missingSettings.provider).toBe(DEFAULT_AI_WRITING_BUDDY_SETTINGS.provider);

		await writeFile(join(temporaryDirectory, "configuration.json"), "{not valid json", "utf8");

		const invalidSettings = await new AiWritingBuddyConfigurationStore(temporaryDirectory).loadSettings();

		expect(invalidSettings.provider).toBe(DEFAULT_AI_WRITING_BUDDY_SETTINGS.provider);
	});

	it("normalises the old indexed-notes scope to current note plus RAG", async () => {
		await writeFile(
			join(temporaryDirectory, "configuration.json"),
			JSON.stringify({
				settings: {
					...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
					contextOptions: {
						enabled: true,
						scope: "indexed-notes",
						includeIndexedRag: false,
					},
				},
			}),
			"utf8",
		);

		const settings = await new AiWritingBuddyConfigurationStore(temporaryDirectory).loadSettings();

		expect(settings.contextOptions).toMatchObject({
			enabled: true,
			scope: "current-note",
			includeIndexedRag: true,
		});
	});

	it("saves settings to configuration.json and keeps a backup of the previous file", async () => {
		const store = new AiWritingBuddyConfigurationStore(temporaryDirectory);

		await store.saveSettings({
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			modelName: "first-model",
		});
		await store.saveSettings({
			...DEFAULT_AI_WRITING_BUDDY_SETTINGS,
			modelName: "second-model",
		});

		const configuration = JSON.parse(await readFile(join(temporaryDirectory, "configuration.json"), "utf8")) as { settings: { modelName: string } };
		const backup = JSON.parse(await readFile(join(temporaryDirectory, "configuration.backup.json"), "utf8")) as { settings: { modelName: string } };

		expect(configuration.settings.modelName).toBe("second-model");
		expect(backup.settings.modelName).toBe("first-model");
	});
});
