import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
	class TFile {
		path: string;

		constructor(path = "") {
			this.path = path;
		}
	}

	class Notice {
		constructor(_message: string) {}
	}

	return {
		Notice,
		TFile,
		normalizePath: (path: string) => path,
	};
});

import { TFile, type App } from "obsidian";
import { AI_MEMORY_END_MARKER, AI_MEMORY_START_MARKER } from "../../src/config/ai-memory";
import { DEFAULT_AI_WRITING_BUDDY_SETTINGS } from "../../src/config/default-settings";
import { AiMemoryService } from "../../src/services/ai-memory-service";

describe("AiMemoryService", () => {
	it("preserves text outside the managed block when replacing memory", async () => {
		const file = new TFile();

		Object.assign(file, {
			path: "AI Writing Buddy/Memory/AI Memory.md",
			basename: "AI Memory",
			extension: "md",
		});
		const originalManagedBlock = "## Preferences\n- Likes quiet writing sessions.";
		const replacementManagedBlock = "## Preferences\n- Prefers calm writing sessions.";

		const originalNote = [
			"# AI Writing Buddy Memory",
			"",
			"This introduction must stay unchanged.",
			"",
			AI_MEMORY_START_MARKER,
			originalManagedBlock,
			AI_MEMORY_END_MARKER,
			"",
			"## Manual notes",
			"",
			"- Keep this manual note untouched.",
		].join("\n");

		const expectedNote = [
			"# AI Writing Buddy Memory",
			"",
			"This introduction must stay unchanged.",
			"",
			AI_MEMORY_START_MARKER,
			replacementManagedBlock,
			AI_MEMORY_END_MARKER,
			"",
			"## Manual notes",
			"",
			"- Keep this manual note untouched.",
		].join("\n");

		const app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => file),
				read: vi.fn(async () => originalNote),
				modify: vi.fn(async () => undefined),
			},
		};

		const service = new AiMemoryService(app as unknown as App);

		const result = await service.replaceManagedBlockIfUnchanged(DEFAULT_AI_WRITING_BUDDY_SETTINGS, `\n${originalManagedBlock}\n`, replacementManagedBlock);

		expect(result).toBe("updated");
		expect(app.vault.modify).toHaveBeenCalledWith(file, expectedNote);
	});
});
