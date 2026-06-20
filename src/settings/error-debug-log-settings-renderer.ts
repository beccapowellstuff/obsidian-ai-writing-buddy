import { Setting } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type AiWritingBuddyPlugin from "../main";
import { ErrorDebugLogModal } from "../modals/error-debug-log-modal";
import type { AiWritingBuddySettings } from "../config/default-settings";

export class ErrorDebugLogSettingsRenderer {
	constructor(
		private readonly plugin: AiWritingBuddyPlugin,
		private readonly settings: AiWritingBuddySettings,
	) {}

	render(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.errorDebugLog.heading).setHeading();

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.errorDebugLog.enable)
			.setDesc(INTERFACE_TEXT.settings.errorDebugLog.enableDescription)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.errorDebugLoggingEnabled).onChange((value) => {
					this.settings.errorDebugLoggingEnabled = value;
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.errorDebugLog.view)
			.setDesc(INTERFACE_TEXT.settings.errorDebugLog.viewDescription)
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.errorDebugLog.view).onClick(() => {
					new ErrorDebugLogModal(this.plugin.app, this.plugin.errorDebugLogService).open();
				});
			});
	}
}
