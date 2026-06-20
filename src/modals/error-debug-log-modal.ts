import { App, Modal, Notice, Setting } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { ErrorDebugLogService } from "../services/error-debug-log-service";

export class ErrorDebugLogModal extends Modal {
	constructor(
		app: App,
		private readonly debugLogService: ErrorDebugLogService,
	) {
		super(app);
	}

	onOpen(): void {
		void this.render();
	}

	private async render(): Promise<void> {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.createEl("h2", { text: INTERFACE_TEXT.settings.errorDebugLog.heading });

		const serialisedLog = await this.debugLogService.serialiseEntries();
		const entries = await this.debugLogService.readEntries();
		const textArea = contentEl.createEl("textarea", {
			cls: "ai-writing-buddy-error-debug-log-textarea",
			text: entries.length === 0 ? INTERFACE_TEXT.settings.errorDebugLog.empty : serialisedLog,
		});

		textArea.readOnly = true;
		textArea.rows = 16;

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.errorDebugLog.copy).onClick(async () => {
					await navigator.clipboard.writeText(serialisedLog);
					new Notice(INTERFACE_TEXT.settings.errorDebugLog.copied);
				});
			})
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.errorDebugLog.export).onClick(async () => {
					const exportPath = await this.debugLogService.exportEntries();
					new Notice(INTERFACE_TEXT.settings.errorDebugLog.exported(exportPath));
				});
			})
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.errorDebugLog.clear).onClick(async () => {
					await this.debugLogService.clearEntries();
					new Notice(INTERFACE_TEXT.settings.errorDebugLog.cleared);
					await this.render();
				});
			})
			.addButton((button) => {
				button.setButtonText(INTERFACE_TEXT.settings.errorDebugLog.close).onClick(() => {
					this.close();
				});
			});
	}
}
