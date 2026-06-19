import { describe, expect, it } from "vitest";
import { AiWritingBuddyPluginDataService } from "../../src/services/ai-writing-buddy-plugin-data-service";
import type { AiWritingBuddyCurrentSessionData } from "../../src/types/ai-writing-buddy-plugin-data";

describe("AiWritingBuddyPluginDataService", () => {
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

		const compactSession = service.compactSessionForStorage(session);
		const savedEntry = compactSession.entries[0];

		if (!savedEntry || savedEntry.type !== "selection") {
			throw new Error("Expected selection entry");
		}

		expect(savedEntry.type).toBe("selection");
		expect(savedEntry.request.promptPreview).toBeUndefined();
		expect(savedEntry.request.selectedText.length).toBeLessThan(selectedText.length);
		expect(savedEntry.request.selectedText).toContain("[Session text truncated for storage.]");
	});

	it("normalises valid saved session data", () => {
		const service = new AiWritingBuddyPluginDataService();
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

		const normalisedSession = service.normaliseSessionData(savedSession);

		expect(normalisedSession.id).toBe("saved-session");
		expect(normalisedSession.entries).toHaveLength(1);
		expect(normalisedSession.entryCount).toBe(1);
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
