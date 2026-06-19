import { copyFile, mkdir, readdir, readFile, rename, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { AiWritingBuddyPluginDataService } from "./ai-writing-buddy-plugin-data-service";
import type { AiWritingBuddyCurrentSessionData, AiWritingBuddySessionListItem } from "../types/ai-writing-buddy-plugin-data";

type SessionHistoryIndex = {
	currentSessionId: string;
	savedSessionIds: string[];
	sessions: Record<string, AiWritingBuddySessionListItem>;
};

type SessionFileData = {
	session?: Partial<AiWritingBuddyCurrentSessionData>;
};

export type AiWritingBuddySessionLoadResult =
	| { status: "loaded"; session: AiWritingBuddyCurrentSessionData }
	| { status: "missing"; sessionId: string }
	| { status: "corrupt"; sessionId: string; error: unknown };

export type AiWritingBuddySessionHistorySnapshot = {
	currentSession: AiWritingBuddyCurrentSessionData;
	savedSessions: AiWritingBuddySessionListItem[];
};

const HISTORY_DIRECTORY_NAME = "history";
const SESSION_DIRECTORY_NAME = "sessions";
const INDEX_FILE_NAME = "index.json";

export class SessionHistoryStore {
	private readonly historyDirectoryPath: string;
	private readonly sessionsDirectoryPath: string;
	private readonly indexPath: string;
	private index: SessionHistoryIndex | null = null;
	private mutationQueue: Promise<void> = Promise.resolve();

	constructor(
		pluginRootPath: string,
		private readonly pluginDataService = new AiWritingBuddyPluginDataService(),
	) {
		this.historyDirectoryPath = join(pluginRootPath, HISTORY_DIRECTORY_NAME);
		this.sessionsDirectoryPath = join(this.historyDirectoryPath, SESSION_DIRECTORY_NAME);
		this.indexPath = join(this.historyDirectoryPath, INDEX_FILE_NAME);
	}

	async load(): Promise<AiWritingBuddySessionHistorySnapshot> {
		const index = await this.loadOrCreateIndex();
		const currentSessionResult = await this.loadSession(index.currentSessionId);
		const currentSession = currentSessionResult.status === "loaded" ? currentSessionResult.session : this.pluginDataService.createEmptyCurrentSession();

		if (currentSession.id !== index.currentSessionId || currentSessionResult.status !== "loaded") {
			this.index = {
				...index,
				currentSessionId: currentSession.id,
				sessions: {
					...index.sessions,
					[currentSession.id]: this.createSessionListItem(currentSession),
				},
			};
			await this.saveSession(currentSession);
			await this.saveIndex(this.index);
		}

		return {
			currentSession,
			savedSessions: this.getSavedSessionListItems(),
		};
	}

	getSavedSessionListItems(): AiWritingBuddySessionListItem[] {
		const index = this.requireIndex();

		return index.savedSessionIds.map((sessionId) => index.sessions[sessionId]).filter((session): session is AiWritingBuddySessionListItem => Boolean(session));
	}

	async saveCurrentSession(session: AiWritingBuddyCurrentSessionData): Promise<void> {
		const sessionSnapshot: AiWritingBuddyCurrentSessionData = structuredClone(session);

		return this.enqueueMutation(async () => {
			const index = this.requireIndex();

			this.index = {
				...index,
				currentSessionId: sessionSnapshot.id,
				sessions: {
					...index.sessions,
					[sessionSnapshot.id]: this.createSessionListItem(sessionSnapshot),
				},
			};

			await this.saveSession(sessionSnapshot);
			await this.saveIndex(this.index);
		});
	}

	async startNewSession(currentSession: AiWritingBuddyCurrentSessionData, newSession: AiWritingBuddyCurrentSessionData, sessionTitle?: string): Promise<void> {
		const currentSessionSnapshot: AiWritingBuddyCurrentSessionData = structuredClone(currentSession);
		const newSessionSnapshot: AiWritingBuddyCurrentSessionData = structuredClone(newSession);

		return this.enqueueMutation(async () => {
			const index = this.requireIndex();
			const sessionToArchive = this.withOptionalSessionTitle(currentSessionSnapshot, sessionTitle);
			const shouldArchiveCurrent = this.hasSessionEntries(sessionToArchive);
			const savedSessionIds = shouldArchiveCurrent
				? [sessionToArchive.id, ...index.savedSessionIds.filter((sessionId) => sessionId !== sessionToArchive.id && sessionId !== newSessionSnapshot.id)]
				: index.savedSessionIds.filter((sessionId) => sessionId !== currentSessionSnapshot.id && sessionId !== newSessionSnapshot.id);
			const sessions = {
				...index.sessions,
				[newSessionSnapshot.id]: this.createSessionListItem(newSessionSnapshot),
			};

			if (shouldArchiveCurrent) {
				sessions[sessionToArchive.id] = this.createSessionListItem(sessionToArchive);
				await this.saveSession(sessionToArchive);
			} else {
				delete sessions[currentSessionSnapshot.id];
				await this.deleteSessionFile(currentSessionSnapshot.id);
			}

			this.index = {
				currentSessionId: newSessionSnapshot.id,
				savedSessionIds,
				sessions,
			};

			await this.saveSession(newSessionSnapshot);
			await this.saveIndex(this.index);
		});
	}

	async deleteCurrentSession(currentSession: AiWritingBuddyCurrentSessionData, newSession: AiWritingBuddyCurrentSessionData): Promise<void> {
		const currentSessionSnapshot: AiWritingBuddyCurrentSessionData = structuredClone(currentSession);
		const newSessionSnapshot: AiWritingBuddyCurrentSessionData = structuredClone(newSession);

		return this.enqueueMutation(async () => {
			const index = this.requireIndex();
			const sessions = {
				...index.sessions,
				[newSessionSnapshot.id]: this.createSessionListItem(newSessionSnapshot),
			};

			delete sessions[currentSessionSnapshot.id];

			this.index = {
				currentSessionId: newSessionSnapshot.id,
				savedSessionIds: index.savedSessionIds.filter((sessionId) => sessionId !== currentSessionSnapshot.id && sessionId !== newSessionSnapshot.id),
				sessions,
			};

			await this.deleteSessionFile(currentSessionSnapshot.id);
			await this.saveSession(newSessionSnapshot);
			await this.saveIndex(this.index);
		});
	}

	async restoreSavedSession(sessionId: string, currentSession: AiWritingBuddyCurrentSessionData): Promise<AiWritingBuddyCurrentSessionData | null> {
		const currentSessionSnapshot: AiWritingBuddyCurrentSessionData = structuredClone(currentSession);

		return this.enqueueMutation(async () => {
			const targetResult = await this.loadSession(sessionId);

			if (targetResult.status !== "loaded") {
				console.warn("AI Writing Buddy saved session could not be loaded", targetResult);
				return null;
			}

			const index = this.requireIndex();
			const shouldArchiveCurrent = this.hasSessionEntries(currentSessionSnapshot);
			const savedSessionIds = index.savedSessionIds.filter((candidateId) => candidateId !== sessionId && candidateId !== currentSessionSnapshot.id);
			const sessions = {
				...index.sessions,
				[targetResult.session.id]: this.createSessionListItem(targetResult.session),
			};

			if (shouldArchiveCurrent) {
				savedSessionIds.unshift(currentSessionSnapshot.id);
				sessions[currentSessionSnapshot.id] = this.createSessionListItem(currentSessionSnapshot);
				await this.saveSession(currentSessionSnapshot);
			} else {
				delete sessions[currentSessionSnapshot.id];
				await this.deleteSessionFile(currentSessionSnapshot.id);
			}

			this.index = {
				currentSessionId: targetResult.session.id,
				savedSessionIds,
				sessions,
			};

			await this.saveSession(targetResult.session);
			await this.saveIndex(this.index);

			return targetResult.session;
		});
	}

	async deleteSavedSession(sessionId: string): Promise<void> {
		return this.enqueueMutation(async () => {
			const index = this.requireIndex();
			const sessions = { ...index.sessions };

			delete sessions[sessionId];

			this.index = {
				...index,
				savedSessionIds: index.savedSessionIds.filter((candidateId) => candidateId !== sessionId),
				sessions,
			};

			await this.deleteSessionFile(sessionId);
			await this.saveIndex(this.index);
		});
	}

	async renameSavedSession(sessionId: string, title: string): Promise<AiWritingBuddyCurrentSessionData | null> {
		return this.enqueueMutation(async () => {
			const loadResult = await this.loadSession(sessionId);

			if (loadResult.status !== "loaded") {
				console.warn("AI Writing Buddy saved session could not be renamed", loadResult);
				return null;
			}

			const renamedSession = this.pluginDataService.renameCurrentSession(title, loadResult.session);
			const index = this.requireIndex();

			this.index = {
				...index,
				sessions: {
					...index.sessions,
					[renamedSession.id]: this.createSessionListItem(renamedSession),
				},
			};

			await this.saveSession(renamedSession);
			await this.saveIndex(this.index);

			return renamedSession;
		});
	}

	async loadSession(sessionId: string): Promise<AiWritingBuddySessionLoadResult> {
		try {
			const rawData = await readFile(this.getSessionPath(sessionId), "utf8");
			const parsedData = JSON.parse(rawData) as SessionFileData | Partial<AiWritingBuddyCurrentSessionData>;
			const session = this.normaliseSessionFileData(parsedData);

			if (!session || session.id !== sessionId) {
				return { status: "corrupt", sessionId, error: new Error("Session file id did not match the expected session id.") };
			}

			return { status: "loaded", session };
		} catch (error) {
			if (this.isMissingFileError(error)) {
				return { status: "missing", sessionId };
			}

			return { status: "corrupt", sessionId, error };
		}
	}

	private async loadOrCreateIndex(): Promise<SessionHistoryIndex> {
		try {
			const rawIndex = await readFile(this.indexPath, "utf8");
			const parsedIndex = JSON.parse(rawIndex) as Partial<SessionHistoryIndex>;
			const normalisedIndex = this.normaliseIndex(parsedIndex);

			this.index = normalisedIndex;
			return normalisedIndex;
		} catch (error) {
			if (!this.isMissingFileError(error)) {
				console.warn("AI Writing Buddy session index could not be loaded; rebuilding from session files.", error);
			}

			this.index = await this.rebuildIndexFromSessionFiles();
			await this.saveIndex(this.index);

			return this.index;
		}
	}

	private async rebuildIndexFromSessionFiles(): Promise<SessionHistoryIndex> {
		await mkdir(this.sessionsDirectoryPath, { recursive: true });

		const sessions: Record<string, AiWritingBuddySessionListItem> = {};
		const savedSessionIds: string[] = [];
		let fileNames: string[] = [];

		try {
			fileNames = await readdir(this.sessionsDirectoryPath);
		} catch {
			fileNames = [];
		}

		for (const fileName of fileNames) {
			if (!fileName.endsWith(".json")) {
				continue;
			}

			const sessionId = fileName.slice(0, -".json".length);
			const result = await this.loadSession(sessionId);

			if (result.status !== "loaded") {
				console.warn("AI Writing Buddy skipped invalid session history file", result);
				continue;
			}

			sessions[result.session.id] = this.createSessionListItem(result.session);
			savedSessionIds.push(result.session.id);
		}

		savedSessionIds.sort((left, right) => (sessions[right]?.updatedAt ?? "").localeCompare(sessions[left]?.updatedAt ?? ""));

		const currentSession = this.pluginDataService.createEmptyCurrentSession();
		sessions[currentSession.id] = this.createSessionListItem(currentSession);
		await this.saveSession(currentSession);

		return {
			currentSessionId: currentSession.id,
			savedSessionIds,
			sessions,
		};
	}

	private normaliseIndex(index: Partial<SessionHistoryIndex>): SessionHistoryIndex {
		const currentSessionId = typeof index.currentSessionId === "string" && index.currentSessionId.trim() ? index.currentSessionId : crypto.randomUUID();
		const rawSavedSessionIds = Array.isArray(index.savedSessionIds) ? index.savedSessionIds : [];
		const savedSessionIds = rawSavedSessionIds.filter((sessionId): sessionId is string => typeof sessionId === "string" && Boolean(sessionId.trim()) && sessionId !== currentSessionId);
		const rawSessions = index.sessions && typeof index.sessions === "object" ? index.sessions : {};
		const sessions: Record<string, AiWritingBuddySessionListItem> = {};

		for (const [sessionId, metadata] of Object.entries(rawSessions)) {
			if (!metadata || typeof metadata !== "object") {
				continue;
			}

			sessions[sessionId] = {
				id: typeof metadata.id === "string" && metadata.id.trim() ? metadata.id : sessionId,
				createdAt: typeof metadata.createdAt === "string" && metadata.createdAt.trim() ? metadata.createdAt : new Date().toISOString(),
				updatedAt: typeof metadata.updatedAt === "string" && metadata.updatedAt.trim() ? metadata.updatedAt : new Date().toISOString(),
				entryCount: typeof metadata.entryCount === "number" && Number.isFinite(metadata.entryCount) ? metadata.entryCount : 0,
				userTitle: typeof metadata.userTitle === "string" && metadata.userTitle.trim() ? metadata.userTitle : undefined,
			};
		}

		return {
			currentSessionId,
			savedSessionIds: savedSessionIds.filter((sessionId) => Boolean(sessions[sessionId])),
			sessions,
		};
	}

	private normaliseSessionFileData(data: SessionFileData | Partial<AiWritingBuddyCurrentSessionData>): AiWritingBuddyCurrentSessionData | null {
		const rawSession = "session" in data ? data.session : data;

		if (!rawSession || typeof rawSession !== "object") {
			return null;
		}

		return this.pluginDataService.normaliseSessionData(rawSession as Partial<AiWritingBuddyCurrentSessionData>);
	}

	private async saveSession(session: AiWritingBuddyCurrentSessionData): Promise<void> {
		const compactSession = this.pluginDataService.compactSessionForStorage(session);

		await this.writeJsonFile(this.getSessionPath(compactSession.id), { session: compactSession });
	}

	private async saveIndex(index: SessionHistoryIndex): Promise<void> {
		await this.writeJsonFile(this.indexPath, index);
	}

	private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
		const temporaryPath = `${filePath}.tmp`;

		await mkdir(dirname(filePath), { recursive: true });
		await this.backupFile(filePath);
		await writeFile(temporaryPath, JSON.stringify(data, null, "\t"), "utf8");
		await rename(temporaryPath, filePath);
	}

	private async backupFile(filePath: string): Promise<void> {
		try {
			await copyFile(filePath, `${filePath}.backup`);
		} catch {
			// No existing file to back up yet.
		}
	}

	private async deleteSessionFile(sessionId: string): Promise<void> {
		await this.deleteFileIfExists(this.getSessionPath(sessionId));
		await this.deleteFileIfExists(`${this.getSessionPath(sessionId)}.backup`);
	}

	private async deleteFileIfExists(filePath: string): Promise<void> {
		try {
			await unlink(filePath);
		} catch (error) {
			if (!this.isMissingFileError(error)) {
				throw error;
			}
		}
	}

	private getSessionPath(sessionId: string): string {
		return join(this.sessionsDirectoryPath, `${this.sanitiseSessionId(sessionId)}.json`);
	}

	private sanitiseSessionId(sessionId: string): string {
		return sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
	}

	private createSessionListItem(session: AiWritingBuddyCurrentSessionData): AiWritingBuddySessionListItem {
		return {
			id: session.id,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			entryCount: session.entries.length,
			userTitle: session.userTitle,
		};
	}

	private withOptionalSessionTitle(session: AiWritingBuddyCurrentSessionData, sessionTitle?: string): AiWritingBuddyCurrentSessionData {
		if (!sessionTitle?.trim()) {
			return session;
		}

		return this.pluginDataService.renameCurrentSession(sessionTitle, session);
	}

	private hasSessionEntries(session: AiWritingBuddyCurrentSessionData): boolean {
		return session.entryCount > 0 || session.entries.length > 0;
	}

	private enqueueMutation<T>(mutation: () => Promise<T>): Promise<T> {
		const result = this.mutationQueue.then(mutation);

		this.mutationQueue = result.then(
			() => undefined,
			() => undefined,
		);

		return result;
	}

	private requireIndex(): SessionHistoryIndex {
		if (!this.index) {
			throw new Error("Session history store has not been loaded.");
		}

		return this.index;
	}

	private isMissingFileError(error: unknown): boolean {
		return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
	}
}
