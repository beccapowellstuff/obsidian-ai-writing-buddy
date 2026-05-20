import { Plugin, requestUrl } from "obsidian";
import { AiDraftBenchSettings, DEFAULT_AI_DRAFT_BENCH_SETTINGS } from "./config/defaultSettings";
import { DEFAULT_PROMPT_TEMPLATES } from "./config/defaultPromptTemplates";
import { PLUGIN_DISPLAY } from "./config/pluginDisplay";
import { AiDraftBenchSettingTab } from "./settings/AiDraftBenchSettingTab";
import { createAiResponseService } from "./services/createAiResponseService";
import { DraftBenchViewService } from "./services/DraftBenchViewService";
import { EditorMenuService } from "./services/EditorMenuService";
import { AI_DRAFT_BENCH_VIEW_TYPE, AiDraftBenchView } from "./views/AiDraftBenchView";

type OpenAiModelsResponse = {
	data?: Array<{
		id?: string;
	}>;
};

export default class AiDraftBenchPlugin extends Plugin {
	private draftBenchViewService!: DraftBenchViewService;
	settings!: AiDraftBenchSettings;

	async onload(): Promise<void> {
		console.debug("AI Draft Bench loaded");

		await this.loadSettings();
		this.addSettingTab(new AiDraftBenchSettingTab(this.app, this));

		this.draftBenchViewService = new DraftBenchViewService(this.app);

		this.registerView(AI_DRAFT_BENCH_VIEW_TYPE, (leaf) => {
			return new AiDraftBenchView(leaf, createAiResponseService(this.settings));
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
		const savedSettings = (await this.loadData()) as Partial<AiDraftBenchSettings> | null;

		this.settings = {
			...DEFAULT_AI_DRAFT_BENCH_SETTINGS,
			...(savedSettings ?? {}),
			promptTemplates: this.mergePromptTemplates(savedSettings?.promptTemplates ?? []),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private mergePromptTemplates(savedTemplates: AiDraftBenchSettings["promptTemplates"]): AiDraftBenchSettings["promptTemplates"] {
		const savedUserTemplates = savedTemplates.filter((template) => !template.isBuiltIn);
		const savedBuiltInTemplates = savedTemplates.filter((template) => template.isBuiltIn);

		const mergedBuiltInTemplates = DEFAULT_PROMPT_TEMPLATES.map((defaultTemplate) => {
			const savedTemplate = savedBuiltInTemplates.find((template) => template.id === defaultTemplate.id);

			return {
				...defaultTemplate,
				...(savedTemplate ?? {}),
				highlightChanges: defaultTemplate.highlightChanges,
				prompt: defaultTemplate.prompt,
				returnsReplacementTextOnly: defaultTemplate.returnsReplacementTextOnly,
				updatedAt: defaultTemplate.updatedAt,
			};
		});

		return [...mergedBuiltInTemplates, ...savedUserTemplates];
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
