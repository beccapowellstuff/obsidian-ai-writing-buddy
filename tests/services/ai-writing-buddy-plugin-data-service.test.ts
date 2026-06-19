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

	it("normalises old saved session data without newer optional fields", () => {
		const service = new AiWritingBuddyPluginDataService();
		const savedSession = {
			id: "old-session",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-02T00:00:00.000Z",
			entryCount: 99,
			entries: [createChatEntry("old-entry")],
		} as Partial<AiWritingBuddyCurrentSessionData>;

		const normalisedSession = service.normaliseSessionData(savedSession);

		expect(normalisedSession.id).toBe("old-session");
		expect(normalisedSession.createdAt).toBe("2026-01-01T00:00:00.000Z");
		expect(normalisedSession.updatedAt).toBe("2026-01-02T00:00:00.000Z");
		expect(normalisedSession.entryCount).toBe(1);
		expect(normalisedSession.userTitle).toBeUndefined();
		expect(normalisedSession.memorySummary).toBeUndefined();
		expect(normalisedSession.entries).toEqual([expect.objectContaining({ id: "old-entry" })]);
	});

	it("fills safe defaults for partial saved session data", () => {
		const service = new AiWritingBuddyPluginDataService();
		const normalisedSession = service.normaliseSessionData({
			entries: [],
			userTitle: "Partial session",
		});

		expect(normalisedSession.id).toEqual(expect.any(String));
		expect(normalisedSession.id).not.toBe("");
		expect(normalisedSession.createdAt).toEqual(expect.any(String));
		expect(normalisedSession.createdAt).not.toBe("");
		expect(normalisedSession.updatedAt).toEqual(expect.any(String));
		expect(normalisedSession.updatedAt).not.toBe("");
		expect(normalisedSession.entryCount).toBe(0);
		expect(normalisedSession.userTitle).toBe("Partial session");
		expect(normalisedSession.memorySummary).toBeUndefined();
		expect(normalisedSession.entries).toEqual([]);
	});

	it("filters malformed persisted entries and recalculates entry count", () => {
		const service = new AiWritingBuddyPluginDataService();
		const normalisedSession = service.normaliseSessionData({
			id: "",
			createdAt: " ",
			updatedAt: 42,
			entryCount: 99,
			userTitle: "",
			entries: [
				createChatEntry("valid-entry"),
				{
					type: "chat",
					message: "Missing id",
					response: {
						text: "Hi",
						createdAt: "2026-01-01T00:00:00.000Z",
						isPlaceholder: false,
					},
				},
				{
					id: "missing-type",
					message: "Missing type",
					response: {
						text: "Hi",
						createdAt: "2026-01-01T00:00:00.000Z",
						isPlaceholder: false,
					},
				},
				{
					id: "missing-response",
					type: "chat",
					message: "Missing response",
				},
			],
		} as unknown as Partial<AiWritingBuddyCurrentSessionData>);

		expect(normalisedSession.id).toEqual(expect.any(String));
		expect(normalisedSession.id).not.toBe("");
		expect(normalisedSession.createdAt).toEqual(expect.any(String));
		expect(normalisedSession.createdAt).not.toBe("");
		expect(normalisedSession.updatedAt).toEqual(expect.any(String));
		expect(normalisedSession.updatedAt).not.toBe("");
		expect(normalisedSession.entryCount).toBe(1);
		expect(normalisedSession.userTitle).toBeUndefined();
		expect(normalisedSession.entries).toEqual([expect.objectContaining({ id: "valid-entry" })]);
	});

	it("normalises partial memory summary data", () => {
		const service = new AiWritingBuddyPluginDataService();
		const normalisedSession = service.normaliseSessionData({
			memorySummary: {
				text: "Earlier useful context.",
				updatedAt: "",
				sourceEntryId: " ",
				entryCount: Number.POSITIVE_INFINITY,
			},
		} as Partial<AiWritingBuddyCurrentSessionData>);

		expect(normalisedSession.memorySummary?.text).toBe("Earlier useful context.");
		expect(normalisedSession.memorySummary?.updatedAt).toEqual(expect.any(String));
		expect(normalisedSession.memorySummary?.sourceEntryId).toBeUndefined();
		expect(normalisedSession.memorySummary?.entryCount).toBe(0);
	});

	it("drops malformed memory summaries without usable text", () => {
		const service = new AiWritingBuddyPluginDataService();

		expect(service.normaliseSessionData({}).memorySummary).toBeUndefined();
		expect(
			service.normaliseSessionData({
				memorySummary: { updatedAt: "2026-01-01T00:00:00.000Z" },
			} as Partial<AiWritingBuddyCurrentSessionData>).memorySummary,
		).toBeUndefined();
		expect(
			service.normaliseSessionData({
				memorySummary: { text: " " },
			} as Partial<AiWritingBuddyCurrentSessionData>).memorySummary,
		).toBeUndefined();
		expect(
			service.normaliseSessionData({
				memorySummary: { text: 42 },
			} as unknown as Partial<AiWritingBuddyCurrentSessionData>).memorySummary,
		).toBeUndefined();
	});
});

function createChatEntry(id: string): AiWritingBuddyCurrentSessionData["entries"][number] {
	return {
		id,
		type: "chat",
		message: "Hello",
		createdAt: "2026-01-01T00:00:00.000Z",
		response: {
			text: "Hi",
			createdAt: "2026-01-01T00:00:00.000Z",
			isPlaceholder: false,
		},
	};
}

function createSession(entries: AiWritingBuddyCurrentSessionData["entries"], id = "current-session"): AiWritingBuddyCurrentSessionData {
	return {
		id,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		entryCount: entries.length,
		entries,
	};
}
