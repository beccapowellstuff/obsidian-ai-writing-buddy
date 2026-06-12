import { Notice, Setting } from "obsidian";
import {
	MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD,
	MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS,
} from "../config/ai-memory";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type AiWritingBuddyPlugin from "../main";
import { AiMemoryService } from "../services/ai-memory-service";

export class AiMemorySettingsRenderer {
	private readonly aiMemoryService: AiMemoryService;

	constructor(
		private readonly plugin: AiWritingBuddyPlugin,
		private readonly settings: AiWritingBuddySettings,
		private readonly refresh: () => void,
		private readonly saveSettings: () => Promise<void>,
	) {
		this.aiMemoryService = new AiMemoryService(this.plugin.app);
	}

	render(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.aiMemory.heading).setHeading();

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.enableAiMemory)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.enableAiMemoryDescription)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.aiMemoryEnabled).onChange((value) => {
					this.settings.aiMemoryEnabled = value;
					void this.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.allowAutoUpdate)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.allowAutoUpdateDescription)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.aiMemoryAutoUpdateEnabled).onChange((value) => {
					this.settings.aiMemoryAutoUpdateEnabled = value;
					void this.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.memoryFolder)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.memoryFolderDescription)
			.addText((text) => {
				text.setValue(this.settings.aiMemoryFolderPath).onChange((value) => {
					this.settings.aiMemoryFolderPath = value.trim();
					void this.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.memoryFileName)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.memoryFileNameDescription)
			.addText((text) => {
				text.setValue(this.settings.aiMemoryFileName).onChange((value) => {
					this.settings.aiMemoryFileName = value
						.replace(/[\\/]/g, " ")
						.replace(/\s+/g, " ")
						.trim();
					void this.saveSettings();
				});
			});

		this.renderNumberSetting(
			containerEl,
			INTERFACE_TEXT.settings.aiMemory.maxPromptCharacters,
			INTERFACE_TEXT.settings.aiMemory.maxPromptCharactersDescription,
			this.settings.aiMemoryMaxPromptCharacters,
			MIN_AI_MEMORY_MAX_PROMPT_CHARACTERS,
			(value) => {
				this.settings.aiMemoryMaxPromptCharacters = value;
				void this.saveSettings();
			},
		);

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.showUpdateNotice)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.showUpdateNoticeDescription)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.aiMemoryShowUpdateNotice).onChange((value) => {
					this.settings.aiMemoryShowUpdateNotice = value;
					void this.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.enableCleanup)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.enableCleanupDescription)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.aiMemoryCleanupEnabled).onChange((value) => {
					this.settings.aiMemoryCleanupEnabled = value;
					void this.saveSettings();
				});
			});

		this.renderNumberSetting(
			containerEl,
			INTERFACE_TEXT.settings.aiMemory.cleanupAfterWrites,
			INTERFACE_TEXT.settings.aiMemory.cleanupAfterWritesDescription,
			this.settings.aiMemoryCleanupWriteThreshold,
			MIN_AI_MEMORY_CLEANUP_WRITE_THRESHOLD,
			(value) => {
				this.settings.aiMemoryCleanupWriteThreshold = value;
				void this.saveSettings();
			},
		);

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.createMemoryNote)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.createMemoryNoteDescription)
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.aiMemory.createMemoryNote).onClick(async () => {
					button.setDisabled(true);

					try {
						await this.aiMemoryService.createMemoryNote(this.normaliseDraftSettings());
						this.refresh();
					} catch (error) {
						console.error("AI Writing Buddy memory note creation failed", error);
						const message = error instanceof Error ? error.message : INTERFACE_TEXT.settings.aiMemory.createMemoryNoteFailed;
						new Notice(message);
					} finally {
						button.setDisabled(false);
					}
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.openMemoryNote)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.openMemoryNoteDescription)
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.aiMemory.openMemoryNote).onClick(async () => {
					button.setDisabled(true);

					try {
						await this.aiMemoryService.openMemoryNote(this.normaliseDraftSettings());
					} catch (error) {
						console.error("AI Writing Buddy memory note open failed", error);
						const message = error instanceof Error ? error.message : INTERFACE_TEXT.settings.aiMemory.openMemoryNoteFailed;
						new Notice(message);
					} finally {
						button.setDisabled(false);
					}
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.aiMemory.repairMemoryNote)
			.setDesc(INTERFACE_TEXT.settings.aiMemory.repairMemoryNoteDescription)
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.aiMemory.repairMemoryNote).onClick(async () => {
					button.setDisabled(true);

					try {
						await this.aiMemoryService.repairMemoryNoteManagedBlock(this.normaliseDraftSettings());
					} catch (error) {
						console.error("AI Writing Buddy memory note repair failed", error);
						const message = error instanceof Error ? error.message : INTERFACE_TEXT.settings.aiMemory.repairMemoryNoteFailed;
						new Notice(message);
					} finally {
						button.setDisabled(false);
					}
				});
			});
	}

	private renderNumberSetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		value: number,
		minimum: number,
		onChange: (value: number) => void,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => {
				text.setValue(String(this.getMinimumNumber(value, minimum))).onChange((newValue) => {
					const parsedValue = Number.parseInt(newValue, 10);

					if (Number.isNaN(parsedValue)) {
						return;
					}

					onChange(this.getMinimumNumber(parsedValue, minimum));
				});

				text.inputEl.type = "number";
				text.inputEl.min = String(minimum);
				text.inputEl.step = "1";
			});
	}

	private normaliseDraftSettings(): AiWritingBuddySettings {
		const normalisedSettings = this.aiMemoryService.normaliseMemorySettings(this.settings);

		Object.assign(this.settings, normalisedSettings);

		return normalisedSettings;
	}

	private getMinimumNumber(value: number, minimum: number): number {
		if (!Number.isFinite(value)) {
			return minimum;
		}

		return Math.max(minimum, Math.floor(value));
	}
}
