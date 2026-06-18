import { describe, expect, it } from "vitest";
import { AiWritingBuddyPluginDataService } from "../../src/services/ai-writing-buddy-plugin-data-service";
import type { AiWritingBuddyCurrentSessionData } from "../../src/types/ai-writing-buddy-plugin-data";

describe("AiWritingBuddyPluginDataService", () => {
	it("saves session data without settings", () => {
		const service = new AiWritingBuddyPluginDataService();
		const session = createSession([]);

		const savedData = service.createSaveData(session, []);

		expect(savedData).toEqual({
			currentSession: session,
			savedSessions: [],
		});
		expect(savedData).not.toHaveProperty("settings");
	});

	it("omits generated prompt previews and caps large selected text", () => {
		const service = new AiWritingBuddyPluginDataService();
		const selectedText = "a".repeat(45000);
		const session = createSession([
			{
				id: "selection-entry",
				type: "selection",
				createdAt: "2026-01-01T00:00:00.000Z",
				request: {
					instruction: "Format this.",
					selectedText,
					sourcePath: "Note.md",
					selectionStart: { line: 0, ch: 0 },
					selectionEnd: { line: 0, ch: selectedText.length },
					createdAt: "2026-01-01T00:00:00.000Z",
					promptPreview: "full prompt should not be persisted",
				},
				response: {
					text: "Done.",
					createdAt: "2026-01-01T00:00:00.000Z",
					isPlaceholder: false,
				},
			},
		]);

		const savedData = service.createSaveData(session, []);
		const savedEntry = savedData.currentSession.entries[0];

		if (!savedEntry || savedEntry.type !== "selection") {
			throw new Error("Expected selection entry");
		}

		expect(savedEntry.type).toBe("selection");
		expect(savedEntry.request.promptPreview).toBeUndefined();
		expect(savedEntry.request.selectedText.length).toBeLessThan(selectedText.length);
		expect(savedEntry.request.selectedText).toContain("[Session text truncated for storage.]");
	});

	it("still loads current and saved sessions from data.json", () => {
		const service = new AiWritingBuddyPluginDataService();
		const currentSession = createSession([]);
		const savedSession = createSession([
			{
				id: "chat-entry",
				type: "chat",
				message: "Hello",
				createdAt: "2026-01-01T00:00:00.000Z",
				response: {
					text: "Hi",
					createdAt: "2026-01-01T00:00:00.000Z",
					isPlaceholder: false,
				},
			},
		], "saved-session");

		const loadedData = service.load({
			currentSession,
			savedSessions: [savedSession],
		});

		expect(loadedData.currentSession.id).toBe("current-session");
		expect(loadedData.savedSessions).toHaveLength(1);
		expect(loadedData.savedSessions[0]?.id).toBe("saved-session");
	});
});

function createSession(entries: AiWritingBuddyCurrentSessionData["entries"], id = "current-session"): AiWritingBuddyCurrentSessionData {
	return {
		id,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		entryCount: entries.length,
		entries,
	};
}
