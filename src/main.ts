import { FileSystemAdapter, Plugin, requestUrl } from "obsidian";
import { join } from "path";
import type { AiWritingBuddySettings } from "./config/default-settings";
import { INTERFACE_TEXT } from "./config/language/en-gb";
import { PLUGIN_DISPLAY } from "./config/plugin-display";
import { AiWritingBuddySettingTab } from "./settings/ai-writing-buddy-setting-tab";
import { AiWritingBuddyConfigurationStore } from "./services/ai-writing-buddy-configuration-store";
import { AiWritingBuddyPluginDataService } from "./services/ai-writing-buddy-plugin-data-service";
import { createAiResponseService } from "./services/create-ai-response-service";
import { AiWritingBuddyViewService } from "./services/view-service";
import { EditorMenuService } from "./services/editor-menu-service";
import { EmbeddingService } from "./services/embedding-service";
import { RagIndexManager } from "./services/rag-index-manager";
import { SessionHistoryStore } from "./services/session-history-store";
import { AiWritingBuddyCurrentSessionData, AiWritingBuddySessionListItem } from "./types/ai-writing-buddy-plugin-data";
import type { AiWritingBuddyRagIndexStatus } from "./types/rag-index";
import { AI_WRITING_BUDDY_VIEW_TYPE, AiWritingBuddyView } from "./views/ai-writing-buddy-view";

type OpenAiModelsResponse = {
	data?: Array<{
		id?: string;
	}>;
};

export default class AiWritingBuddyPlugin extends Plugin {
	private readonly pluginDataService = new AiWritingBuddyPluginDataService();
	private aiWritingBuddyViewService!: AiWritingBuddyViewService;
	private ragIndexManager!: RagIndexManager;
	private configurationStore!: AiWritingBuddyConfigurationStore;
	private sessionHistoryStore!: SessionHistoryStore;
	settings!: AiWritingBuddySettings;
	currentSession: AiWritingBuddyCurrentSessionData = this.pluginDataService.createEmptyCurrentSession();
	savedSessionListItems: AiWritingBuddySessionListItem[] = [];

	async onload(): Promise<void> {
		console.debug("AI Writing Buddy loaded");

		const pluginRootPath = this.getPluginRootPath();

		this.configurationStore = new AiWritingBuddyConfigurationStore(pluginRootPath);
		this.sessionHistoryStore = new SessionHistoryStore(pluginRootPath, this.pluginDataService);
		await this.loadSettings();
		this.ragIndexManager = new RagIndexManager(this.app, this.settings, pluginRootPath);
		await this.refreshRagIndexStatus();
		this.addSettingTab(new AiWritingBuddySettingTab(this.app, this));

		this.aiWritingBuddyViewService = new AiWritingBuddyViewService(this.app);

		this.registerView(AI_WRITING_BUDDY_VIEW_TYPE, (leaf) => {
			return new AiWritingBuddyView(
				leaf,
				() => createAiResponseService(this.settings),
				this.settings,
				this.currentSession.entries,
				this.currentSession.memorySummary,
				(entries, memorySummary) => {
					this.currentSession = this.pluginDataService.withUpdatedCurrentSessionEntries(this.currentSession, entries, memorySummary);
					void this.savePluginData();
				},
				async (sessionTitle) => {
					const newSession = this.pluginDataService.createEmptyCurrentSession();

					await this.sessionHistoryStore.startNewSession(this.currentSession, newSession, sessionTitle);
					this.currentSession = newSession;
					this.savedSessionListItems = this.sessionHistoryStore.getSavedSessionListItems();
				},
				() => this.savedSessionListItems,
				async (sessionId) => {
					const restoredSession = await this.sessionHistoryStore.restoreSavedSession(sessionId, this.currentSession);

					if (!restoredSession) {
						return null;
					}

					this.currentSession = restoredSession;
					this.savedSessionListItems = this.sessionHistoryStore.getSavedSessionListItems();

					return this.currentSession;
				},
				async (sessionId): Promise<AiWritingBuddySessionListItem[]> => {
					await this.sessionHistoryStore.deleteSavedSession(sessionId);
					this.savedSessionListItems = this.sessionHistoryStore.getSavedSessionListItems();

					return this.savedSessionListItems;
				},
				async (sessionId) => {
					const result = await this.sessionHistoryStore.loadSession(sessionId);

					return result.status === "loaded" ? result.session : null;
				},
				async (sessionId, title): Promise<AiWritingBuddySessionListItem[]> => {
					await this.sessionHistoryStore.renameSavedSession(sessionId, title);
					this.savedSessionListItems = this.sessionHistoryStore.getSavedSessionListItems();

					return this.savedSessionListItems;
				},
				() => this.currentSession.userTitle,
				() => (this.currentSession.entryCount > 0 || this.currentSession.entries.length > 0 ? this.currentSession : null),
				(title: string): AiWritingBuddyCurrentSessionData => {
					this.currentSession = this.pluginDataService.renameCurrentSession(title, this.currentSession);
					void this.savePluginData();

					return this.currentSession;
				},
				(): AiWritingBuddyCurrentSessionData => {
					this.currentSession = this.pluginDataService.createEmptyCurrentSession();
					void this.savePluginData();

					return this.currentSession;
				},
				() => this.saveSettings(),
				pluginRootPath,
			);
		});

		this.addRibbonIcon(PLUGIN_DISPLAY.ribbonIcon, INTERFACE_TEXT.app.ribbonTooltip, () => {
			void this.aiWritingBuddyViewService.openView();
		});

		const editorMenuService = new EditorMenuService(this, this.aiWritingBuddyViewService);

		editorMenuService.register();
		this.registerRagIndexEvents();
	}

	onunload(): void {
		this.ragIndexManager.dispose();
		console.debug("AI Writing Buddy unloaded");
	}

	async loadSettings(): Promise<void> {
		this.settings = await this.configurationStore.loadSettings();
		const loadedHistory = await this.sessionHistoryStore.load();

		this.currentSession = loadedHistory.currentSession;
		this.savedSessionListItems = loadedHistory.savedSessions;
	}

	async saveSettings(): Promise<void> {
		await this.configurationStore.saveSettings(this.settings);
	}

	private async savePluginData(): Promise<void> {
		await this.sessionHistoryStore.saveCurrentSession(this.currentSession);
	}

	async listAvailableModels(settings: AiWritingBuddySettings = this.settings): Promise<string[]> {
		if (settings.provider === "mock") {
			return ["mock-model"];
		}

		return this.listModelsFromProvider(settings.baseUrl, settings.apiKey);
	}

	async listAvailableEmbeddingModels(settings: AiWritingBuddySettings = this.settings): Promise<string[]> {
		return this.listModelsFromProvider(settings.embeddingBaseUrl, settings.embeddingApiKey.trim() || settings.apiKey);
	}

	private async listModelsFromProvider(baseUrlSetting: string, apiKeySetting: string): Promise<string[]> {
		const baseUrl = baseUrlSetting.trim().replace(/\/$/, "");

		if (!baseUrl) {
			throw new Error("Server address is required.");
		}

		const headers: Record<string, string> = {};

		if (apiKeySetting.trim()) {
			headers.Authorization = `Bearer ${apiKeySetting.trim()}`;
		}

		const response = await requestUrl({
			url: `${baseUrl}/models`,
			method: "GET",
			headers,
			throw: false,
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Model list request failed with status ${response.status}.`);
		}

		const data = response.json as OpenAiModelsResponse;
		const modelNames = data.data?.map((model) => model.id?.trim()).filter((modelName): modelName is string => Boolean(modelName));

		if (!modelNames || modelNames.length === 0) {
			throw new Error("No models were returned by the provider.");
		}

		return modelNames;
	}

	async testProviderConnection(settings: AiWritingBuddySettings = this.settings): Promise<string> {
		const aiResponseService = createAiResponseService(settings);

		const response = await aiResponseService.createChatResponse({
			message: "Connection test. Reply with a short confirmation.",
		});

		const responseText = response.text.trim();

		if (!responseText) {
			throw new Error("The provider returned an empty response.");
		}

		if (settings.provider === "mock") {
			return INTERFACE_TEXT.errors.mockProviderTestSucceeded;
		}

		return INTERFACE_TEXT.errors.connectionTestSucceeded;
	}

	async testEmbeddingConnection(settings: AiWritingBuddySettings = this.settings): Promise<string> {
		return new EmbeddingService(settings).testConnection();
	}

	getRagIndexStatusSnapshot(): AiWritingBuddyRagIndexStatus {
		return this.ragIndexManager.getStatusSnapshot();
	}

	async buildOrRebuildRagIndex(rebuild: boolean): Promise<void> {
		if (rebuild) {
			await this.ragIndexManager.rebuildIndex();
			return;
		}

		await this.ragIndexManager.buildIndex();
	}

	async clearRagIndex(): Promise<void> {
		await this.ragIndexManager.clearIndex();
	}

	getPluginRootPath(): string {
		const adapter = this.app.vault.adapter;

		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error("AI Writing Buddy RAG indexing requires a desktop vault file system adapter.");
		}

		return join(adapter.getBasePath(), this.app.vault.configDir, "plugins", this.manifest.id);
	}

	private registerRagIndexEvents(): void {
		this.registerEvent(this.app.vault.on("create", (file) => {
			this.ragIndexManager.handleVaultFileCreatedOrModified(file);
		}));
		this.registerEvent(this.app.vault.on("modify", (file) => {
			this.ragIndexManager.handleVaultFileCreatedOrModified(file);
		}));
		this.registerEvent(this.app.vault.on("delete", (file) => {
			this.ragIndexManager.handleVaultFileDeleted(file);
		}));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			this.ragIndexManager.handleVaultFileRenamed(file, oldPath);
		}));
	}

	private async refreshRagIndexStatus(): Promise<void> {
		try {
			await this.ragIndexManager.getStatus();
		} catch (error) {
			console.warn("AI Writing Buddy RAG index status refresh failed", error);
		}
	}
}
