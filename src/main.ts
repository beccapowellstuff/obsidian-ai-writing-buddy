import { Plugin, requestUrl } from "obsidian";
import { AiDraftBenchSettings } from "./config/defaultSettings";
import { PLUGIN_DISPLAY } from "./config/pluginDisplay";
import { AiDraftBenchSettingTab } from "./settings/AiDraftBenchSettingTab";
import { AiDraftBenchPluginDataService } from "./services/AiDraftBenchPluginDataService";
import { createAiResponseService } from "./services/createAiResponseService";
import { DraftBenchViewService } from "./services/DraftBenchViewService";
import { EditorMenuService } from "./services/EditorMenuService";
import { AiDraftBenchCurrentSessionData } from "./types/AiDraftBenchPluginData";
import { AI_DRAFT_BENCH_VIEW_TYPE, AiDraftBenchView } from "./views/AiDraftBenchView";

type OpenAiModelsResponse = {
	data?: Array<{
		id?: string;
	}>;
};

export default class AiDraftBenchPlugin extends Plugin {
	private readonly pluginDataService = new AiDraftBenchPluginDataService();
	private draftBenchViewService!: DraftBenchViewService;
	settings!: AiDraftBenchSettings;
	currentSession: AiDraftBenchCurrentSessionData = this.pluginDataService.createEmptyCurrentSession();

	async onload(): Promise<void> {
		console.debug("AI Draft Bench loaded");

		await this.loadSettings();
		this.addSettingTab(new AiDraftBenchSettingTab(this.app, this));

		this.draftBenchViewService = new DraftBenchViewService(this.app);

		this.registerView(AI_DRAFT_BENCH_VIEW_TYPE, (leaf) => {
			return new AiDraftBenchView(
				leaf,
				createAiResponseService(this.settings),
				this.currentSession.entries,
				(entries) => {
					this.currentSession = this.pluginDataService.withUpdatedCurrentSessionEntries(this.currentSession, entries);
					void this.savePluginData();
				},
				() => {
					this.currentSession = this.pluginDataService.createEmptyCurrentSession();
					void this.savePluginData();
				},
			);
		});

		this.addRibbonIcon(PLUGIN_DISPLAY.ribbonIcon, PLUGIN_DISPLAY.ribbonTooltip, () => {
			void this.draftBenchViewService.openView();
		});

		const editorMenuService = new EditorMenuService(this, this.draftBenchViewService);

		editorMenuService.register();
	}

	onunload(): void {
		console.debug("AI Draft Bench unloaded");
	}

	async loadSettings(): Promise<void> {
		const loadedData = this.pluginDataService.load(await this.loadData());

		this.settings = loadedData.settings;
		this.currentSession = loadedData.currentSession;
	}

	async saveSettings(): Promise<void> {
		await this.savePluginData();
	}

	private async savePluginData(): Promise<void> {
		await this.saveData(this.pluginDataService.createSaveData(this.settings, this.currentSession));
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
			return "Mock provider test succeeded.";
		}

		return "Connection test succeeded.";
	}
}
