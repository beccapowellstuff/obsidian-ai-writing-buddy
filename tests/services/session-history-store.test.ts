import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiWritingBuddyPluginDataService } from "../../src/services/ai-writing-buddy-plugin-data-service";
import { SessionHistoryStore } from "../../src/services/session-history-store";
import type { AiWritingBuddyCurrentSessionData } from "../../src/types/ai-writing-buddy-plugin-data";

describe("SessionHistoryStore", () => {
	let temporaryDirectory: string;
	let pluginDataService: AiWritingBuddyPluginDataService;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "ai-writing-buddy-history-"));
		pluginDataService = new AiWritingBuddyPluginDataService();
	});

	afterEach(async () => {
		await rm(temporaryDirectory, { recursive: true, force: true });
	});

	it("creates an index and saves the current session as an individual JSON file", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();
		const currentSession = {
			...snapshot.currentSession,
			entries: [createChatEntry("entry-1")],
			entryCount: 1,
		};

		await store.saveCurrentSession(currentSession);

		const index = JSON.parse(await readFile(join(temporaryDirectory, "history", "index.json"), "utf8")) as { currentSessionId: string; sessions: Record<string, unknown> };
		const sessionFile = JSON.parse(await readFile(join(temporaryDirectory, "history", "sessions", `${currentSession.id}.json`), "utf8")) as { session: AiWritingBuddyCurrentSessionData };

		expect(index.currentSessionId).toBe(currentSession.id);
		expect(index.sessions[currentSession.id]).toBeTruthy();
		expect(sessionFile.session.entries).toHaveLength(1);
	});

	it("serialises rapid current-session saves and persists the newest snapshot", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();

		const firstSession = {
			...snapshot.currentSession,
			updatedAt: "2026-01-01T00:00:01.000Z",
			entries: [createChatEntry("entry-1")],
			entryCount: 1,
		};

		const secondSession = {
			...snapshot.currentSession,
			updatedAt: "2026-01-01T00:00:02.000Z",
			entries: [createChatEntry("entry-1"), createChatEntry("entry-2")],
			entryCount: 2,
		};

		const newestSession = {
			...snapshot.currentSession,
			updatedAt: "2026-01-01T00:00:03.000Z",
			entries: [createChatEntry("entry-1"), createChatEntry("entry-2"), createChatEntry("entry-3")],
			entryCount: 3,
		};

		await Promise.all([store.saveCurrentSession(firstSession), store.saveCurrentSession(secondSession), store.saveCurrentSession(newestSession)]);

		const reloadedStore = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const reloadedSnapshot = await reloadedStore.load();

		expect(reloadedSnapshot.currentSession.updatedAt).toBe(newestSession.updatedAt);
		expect(reloadedSnapshot.currentSession.entries).toHaveLength(3);
		expect(reloadedSnapshot.currentSession.entries.at(-1)?.id).toBe("entry-3");
	});

	it("starts a new session by archiving only the previous current session", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();
		const currentSession = {
			...snapshot.currentSession,
			entries: [createChatEntry("entry-1")],
			entryCount: 1,
		};
		const nextSession = pluginDataService.createEmptyCurrentSession();

		await store.startNewSession(currentSession, nextSession, "Archived session");

		const reloadedStore = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const reloadedSnapshot = await reloadedStore.load();

		expect(reloadedSnapshot.currentSession.id).toBe(nextSession.id);
		expect(reloadedSnapshot.savedSessions).toEqual([
			expect.objectContaining({
				id: currentSession.id,
				userTitle: "Archived session",
				entryCount: 1,
			}),
		]);
	});

	it("deletes the replaced current session file, backup, saved id, and metadata", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();
		const currentSession = {
			...snapshot.currentSession,
			entries: [createChatEntry("entry-1")],
			entryCount: 1,
		};
		const savedSession = createSession("saved-session", [createChatEntry("entry-2")]);
		const replacementSession = pluginDataService.createEmptyCurrentSession();

		await store.saveCurrentSession(currentSession);
		await writeSessionFile(temporaryDirectory, savedSession);
		await writeFile(getSessionBackupPath(temporaryDirectory, currentSession.id), "backup", "utf8");
		await writeFile(
			getIndexPath(temporaryDirectory),
			JSON.stringify({
				currentSessionId: currentSession.id,
				savedSessionIds: [currentSession.id, savedSession.id, replacementSession.id],
				sessions: {
					[currentSession.id]: createSessionListItem(currentSession),
					[savedSession.id]: createSessionListItem(savedSession),
					[replacementSession.id]: createSessionListItem(replacementSession),
				},
			}),
			"utf8",
		);

		const reloadedStore = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		await reloadedStore.load();
		await reloadedStore.deleteCurrentSession(currentSession, replacementSession);

		const index = JSON.parse(await readFile(getIndexPath(temporaryDirectory), "utf8")) as {
			currentSessionId: string;
			savedSessionIds: string[];
			sessions: Record<string, unknown>;
		};

		expect(index.currentSessionId).toBe(replacementSession.id);
		expect(index.savedSessionIds).toEqual([savedSession.id]);
		expect(index.sessions[currentSession.id]).toBeUndefined();
		expect(index.sessions[replacementSession.id]).toBeTruthy();
		await expectMissingFile(getSessionPath(temporaryDirectory, currentSession.id));
		await expectMissingFile(getSessionBackupPath(temporaryDirectory, currentSession.id));
		expect((await reloadedStore.loadSession(replacementSession.id)).status).toBe("loaded");
	});

	it("does not resurrect a deleted current session when rebuilding a corrupt index", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();
		const currentSession = {
			...snapshot.currentSession,
			entries: [createChatEntry("entry-1")],
			entryCount: 1,
		};
		const replacementSession = pluginDataService.createEmptyCurrentSession();

		await store.saveCurrentSession(currentSession);
		await store.deleteCurrentSession(currentSession, replacementSession);
		await writeFile(getIndexPath(temporaryDirectory), "{not json", "utf8");

		const reloadedStore = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const rebuiltSnapshot = await reloadedStore.load();

		expect(rebuiltSnapshot.savedSessions.map((session) => session.id)).not.toContain(currentSession.id);
		await expectMissingFile(getSessionPath(temporaryDirectory, currentSession.id));
		await expectMissingFile(getSessionBackupPath(temporaryDirectory, currentSession.id));
	});

	it("starts a new session from an empty current session by deleting the old empty file and backup", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();
		const nextSession = pluginDataService.createEmptyCurrentSession();

		await writeFile(getSessionBackupPath(temporaryDirectory, snapshot.currentSession.id), "backup", "utf8");
		await store.startNewSession(snapshot.currentSession, nextSession);

		const index = JSON.parse(await readFile(getIndexPath(temporaryDirectory), "utf8")) as {
			currentSessionId: string;
			savedSessionIds: string[];
			sessions: Record<string, unknown>;
		};

		expect(index.currentSessionId).toBe(nextSession.id);
		expect(index.savedSessionIds).not.toContain(snapshot.currentSession.id);
		expect(index.savedSessionIds).not.toContain(nextSession.id);
		expect(index.sessions[snapshot.currentSession.id]).toBeUndefined();
		await expectMissingFile(getSessionPath(temporaryDirectory, snapshot.currentSession.id));
		await expectMissingFile(getSessionBackupPath(temporaryDirectory, snapshot.currentSession.id));
		expect((await store.loadSession(nextSession.id)).status).toBe("loaded");
	});

	it("restores a saved session over an empty current session by deleting the old empty file and backup", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();
		const archivedSession = {
			...snapshot.currentSession,
			entries: [createChatEntry("entry-1")],
			entryCount: 1,
		};
		const emptyCurrentSession = pluginDataService.createEmptyCurrentSession();

		await store.startNewSession(archivedSession, emptyCurrentSession);
		await writeFile(getSessionBackupPath(temporaryDirectory, emptyCurrentSession.id), "backup", "utf8");

		const restoredSession = await store.restoreSavedSession(archivedSession.id, emptyCurrentSession);

		const index = JSON.parse(await readFile(getIndexPath(temporaryDirectory), "utf8")) as {
			currentSessionId: string;
			savedSessionIds: string[];
			sessions: Record<string, unknown>;
		};

		expect(restoredSession?.id).toBe(archivedSession.id);
		expect(index.currentSessionId).toBe(archivedSession.id);
		expect(index.savedSessionIds).not.toContain(emptyCurrentSession.id);
		expect(index.sessions[emptyCurrentSession.id]).toBeUndefined();
		await expectMissingFile(getSessionPath(temporaryDirectory, emptyCurrentSession.id));
		await expectMissingFile(getSessionBackupPath(temporaryDirectory, emptyCurrentSession.id));
	});

	it("loads one saved session without requiring every saved session to be valid", async () => {
		const validSession = createSession("valid-session", [createChatEntry("entry-1")]);
		const corruptSessionId = "corrupt-session";
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);

		await store.load();
		await writeSessionFile(temporaryDirectory, validSession);
		await writeFile(join(temporaryDirectory, "history", "sessions", `${corruptSessionId}.json`), "{not json", "utf8");
		await writeFile(
			join(temporaryDirectory, "history", "index.json"),
			JSON.stringify({
				currentSessionId: validSession.id,
				savedSessionIds: [validSession.id, corruptSessionId],
				sessions: {
					[validSession.id]: createSessionListItem(validSession),
					[corruptSessionId]: {
						id: corruptSessionId,
						createdAt: "2026-01-01T00:00:00.000Z",
						updatedAt: "2026-01-01T00:00:00.000Z",
						entryCount: 1,
					},
				},
			}),
			"utf8",
		);

		const reloadedStore = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		await reloadedStore.load();

		const validLoadResult = await reloadedStore.loadSession(validSession.id);

		expect(validLoadResult.status).toBe("loaded");
		if (validLoadResult.status === "loaded") {
			expect(validLoadResult.session.id).toBe(validSession.id);
		}
		expect(await reloadedStore.loadSession(corruptSessionId)).toMatchObject({
			status: "corrupt",
			sessionId: corruptSessionId,
		});
	});

	it("rebuilds the index from valid session files when the index is corrupt", async () => {
		const validSession = createSession("valid-session", [createChatEntry("entry-1")]);
		const corruptSessionId = "corrupt-session";

		await writeSessionFile(temporaryDirectory, validSession);
		await writeFile(join(temporaryDirectory, "history", "sessions", `${corruptSessionId}.json`), "{not json", "utf8");
		await writeFile(join(temporaryDirectory, "history", "index.json"), "{not json", "utf8");

		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();

		expect(snapshot.currentSession.entries).toHaveLength(0);
		expect(snapshot.savedSessions).toEqual([
			expect.objectContaining({
				id: validSession.id,
				entryCount: 1,
			}),
		]);
	});

	it("deletes only the selected saved session file, backup, and index metadata", async () => {
		const store = new SessionHistoryStore(temporaryDirectory, pluginDataService);
		const snapshot = await store.load();
		const archivedSession = {
			...snapshot.currentSession,
			entries: [createChatEntry("entry-1")],
			entryCount: 1,
		};
		const nextSession = pluginDataService.createEmptyCurrentSession();

		await store.startNewSession(archivedSession, nextSession);
		await writeFile(getSessionBackupPath(temporaryDirectory, archivedSession.id), "backup", "utf8");
		await store.deleteSavedSession(archivedSession.id);

		const index = JSON.parse(await readFile(getIndexPath(temporaryDirectory), "utf8")) as { savedSessionIds: string[]; sessions: Record<string, unknown> };
		const deletedSessionResult = await store.loadSession(archivedSession.id);

		expect(index.savedSessionIds).not.toContain(archivedSession.id);
		expect(index.sessions[archivedSession.id]).toBeUndefined();
		expect(deletedSessionResult.status).toBe("missing");
		await expectMissingFile(getSessionBackupPath(temporaryDirectory, archivedSession.id));
		expect((await store.loadSession(nextSession.id)).status).toBe("loaded");
	});
});

function createSession(id: string, entries: AiWritingBuddyCurrentSessionData["entries"]): AiWritingBuddyCurrentSessionData {
	return {
		id,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		entryCount: entries.length,
		entries,
	};
}

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

function createSessionListItem(session: AiWritingBuddyCurrentSessionData): Record<string, unknown> {
	return {
		id: session.id,
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		entryCount: session.entryCount,
		userTitle: session.userTitle,
	};
}

async function writeSessionFile(temporaryDirectory: string, session: AiWritingBuddyCurrentSessionData): Promise<void> {
	const sessionDirectory = join(temporaryDirectory, "history", "sessions");

	await mkdir(sessionDirectory, { recursive: true });
	await writeFile(getSessionPath(temporaryDirectory, session.id), JSON.stringify({ session }), "utf8");
}

function getIndexPath(temporaryDirectory: string): string {
	return join(temporaryDirectory, "history", "index.json");
}

function getSessionPath(temporaryDirectory: string, sessionId: string): string {
	return join(temporaryDirectory, "history", "sessions", `${sessionId}.json`);
}

function getSessionBackupPath(temporaryDirectory: string, sessionId: string): string {
	return `${getSessionPath(temporaryDirectory, sessionId)}.backup`;
}

async function expectMissingFile(filePath: string): Promise<void> {
	await expect(readFile(filePath, "utf8")).rejects.toMatchObject({
		code: "ENOENT",
	});
}
