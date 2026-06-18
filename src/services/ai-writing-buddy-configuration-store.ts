import { copyFile, mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { AiWritingBuddySettingsService } from "./ai-writing-buddy-settings-service";

type SavedConfiguration = {
	settings?: Partial<AiWritingBuddySettings>;
};

const CONFIGURATION_FILE_NAME = "configuration.json";
const CONFIGURATION_BACKUP_FILE_NAME = "configuration.backup.json";

export class AiWritingBuddyConfigurationStore {
	private readonly settingsService = new AiWritingBuddySettingsService();
	private readonly configurationPath: string;
	private readonly backupPath: string;

	constructor(pluginRootPath: string) {
		this.configurationPath = join(pluginRootPath, CONFIGURATION_FILE_NAME);
		this.backupPath = join(pluginRootPath, CONFIGURATION_BACKUP_FILE_NAME);
	}

	async loadSettings(): Promise<AiWritingBuddySettings> {
		try {
			const rawConfiguration = await readFile(this.configurationPath, "utf8");
			const parsedConfiguration = JSON.parse(rawConfiguration) as SavedConfiguration | Partial<AiWritingBuddySettings>;
			const savedSettings = this.extractSettings(parsedConfiguration);

			return this.settingsService.normaliseSettings(savedSettings);
		} catch (error) {
			console.warn("AI Writing Buddy configuration could not be loaded; using defaults.", error);

			return this.settingsService.createDefaultSettings();
		}
	}

	async saveSettings(settings: AiWritingBuddySettings): Promise<void> {
		const normalisedSettings = this.settingsService.normaliseSettings(settings);
		const content = JSON.stringify({ settings: normalisedSettings }, null, "\t");
		const temporaryPath = `${this.configurationPath}.tmp`;

		await mkdir(dirname(this.configurationPath), { recursive: true });
		await this.backupCurrentConfiguration();
		await writeFile(temporaryPath, content, "utf8");
		await rename(temporaryPath, this.configurationPath);
	}

	private extractSettings(configuration: SavedConfiguration | Partial<AiWritingBuddySettings>): Partial<AiWritingBuddySettings> {
		if (this.hasSettingsWrapper(configuration)) {
			return configuration.settings ?? {};
		}

		return configuration;
	}

	private hasSettingsWrapper(configuration: SavedConfiguration | Partial<AiWritingBuddySettings>): configuration is SavedConfiguration {
		return typeof configuration === "object" && configuration !== null && "settings" in configuration;
	}

	private async backupCurrentConfiguration(): Promise<void> {
		try {
			await copyFile(this.configurationPath, this.backupPath);
		} catch {
			// No existing configuration to back up yet.
		}
	}
}
