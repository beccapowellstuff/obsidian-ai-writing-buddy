import { Plugin, requestUrl } from "obsidian";
import { AiWritingBuddySettings } from "./config/default-settings";
import { INTERFACE_TEXT } from "./config/interface-text";
import { PLUGIN_DISPLAY } from "./config/plugin-display";
import { AiWritingBuddySettingTab } from "./settings/ai-writing-buddy-setting-tab";
import { AiWritingBuddyPluginDataService } from "./services/ai-writing-buddy-plugin-data-service";
import { createAiResponseService } from "./services/create-ai-response-service";
import { AiWritingBuddyViewService } from "./services/view-service";
import { EditorMenuService } from "./services/editor-menu-service";
import { AiWritingBuddyCurrentSessionData, AiWritingBuddySessionListItem } from "./types/ai-writing-buddy-plugin-data";
import { AI_WRITING_BUDDY_VIEW_TYPE, AiWritingBuddyView } from "./views/ai-writing-buddy-view";

type OpenAiModelsResponse = {
	data?: Array<{
		id?: string;
	}>;
};

export default class AiWritingBuddyPlugin extends Plugin {
	private readonly pluginDataService = new AiWritingBuddyPluginDataService();
	private aiWritingBuddyViewService!: AiWritingBuddyViewService;
	settings!: AiWritingBuddySettings;
	currentSession: AiWritingBuddyCurrentSessionData = this.pluginDataService.createEmptyCurrentSession();
	savedSessions: AiWritingBuddyCurrentSessionData[] = [];

	async onload(): Promise<void> {
		console.debug("AI Writing Buddy loaded");

		await this.loadSettings();
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
				(sessionTitle) => {
					const result = this.pluginDataService.startNewSession(this.currentSession, this.savedSessions, sessionTitle);
					this.currentSession = result.currentSession;
					this.savedSessions = result.savedSessions;
					void this.savePluginData();
				},
				() => this.pluginDataService.getSessionListItems(this.savedSessions),
				(sessionId) => {
					const result = this.pluginDataService.restoreSavedSession(sessionId, this.currentSession, this.savedSessions);

					if (!result) {
						return null;
					}

					this.currentSession = result.currentSession;
					this.savedSessions = result.savedSessions;
					void this.savePluginData();

					return this.currentSession;
				},
				(sessionId): AiWritingBuddySessionListItem[] => {
					this.savedSessions = this.pluginDataService.deleteSavedSession(sessionId, this.savedSessions);
					void this.savePluginData();

					return this.pluginDataService.getSessionListItems(this.savedSessions);
				},
				() => this.savedSessions,
				(sessionId, title): AiWritingBuddyCurrentSessionData[] => {
					this.savedSessions = this.pluginDataService.renameSavedSession(sessionId, title, this.savedSessions);
					void this.savePluginData();

					return this.savedSessions;
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
			);
		});

		this.addRibbonIcon(PLUGIN_DISPLAY.ribbonIcon, INTERFACE_TEXT.app.ribbonTooltip, () => {
			void this.aiWritingBuddyViewService.openView();
		});

		const editorMenuService = new EditorMenuService(this, this.aiWritingBuddyViewService);

		editorMenuService.register();
	}

	onunload(): void {
		console.debug("AI Writing Buddy unloaded");
	}

	async loadSettings(): Promise<void> {
		const loadedData = this.pluginDataService.load(await this.loadData());

		this.settings = loadedData.settings;
		this.currentSession = loadedData.currentSession;
		this.savedSessions = loadedData.savedSessions;
	}

	async saveSettings(): Promise<void> {
		await this.savePluginData();
	}

	private async savePluginData(): Promise<void> {
		await this.saveData(this.pluginDataService.createSaveData(this.settings, this.currentSession, this.savedSessions));
	}

	async listAvailableModels(): Promise<string[]> {
		if (this.settings.provider === "mock") {
			return ["mock-model"];
		}

		const baseUrl = this.settings.baseUrl.trim().replace(/\/$/, "");

		if (!baseUrl) {
			throw new Error("Server address is required.");
		}

		const headers: Record<string, string> = {};

		if (this.settings.apiKey.trim()) {
			headers.Authorization = `Bearer ${this.settings.apiKey.trim()}`;
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

	async testProviderConnection(): Promise<string> {
		const aiResponseService = createAiResponseService(this.settings);

		const response = await aiResponseService.createChatResponse({
			message: "Connection test. Reply with a short confirmation.",
		});

		const responseText = response.text.trim();

		if (!responseText) {
			throw new Error("The provider returned an empty response.");
		}

		if (this.settings.provider === "mock") {
			return INTERFACE_TEXT.errors.mockProviderTestSucceeded;
		}

		return INTERFACE_TEXT.errors.connectionTestSucceeded;
	}
}
