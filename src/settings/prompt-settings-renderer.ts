import { Setting } from "obsidian";
import {
	DEFAULT_OPEN_CHAT_SYSTEM_PROMPT,
	DEFAULT_PERSONALITY_PROMPT,
	DEFAULT_SELECTION_SYSTEM_PROMPT,
	type AiWritingBuddySettings,
} from "../config/default-settings";
import { INTERFACE_TEXT } from "../config/language/en-gb";

export class PromptSettingsRenderer {
	constructor(
		private readonly settings: AiWritingBuddySettings,
		private readonly refresh: () => void,
	) {}

	render(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(INTERFACE_TEXT.settings.prompts.heading).setHeading();

		this.renderPromptTextSetting(
			containerEl,
			INTERFACE_TEXT.settings.prompts.openChatSystemPrompt,
			INTERFACE_TEXT.settings.prompts.openChatDescription,
			this.settings.openChatSystemPrompt,
			DEFAULT_OPEN_CHAT_SYSTEM_PROMPT,
			(value) => {
				this.settings.openChatSystemPrompt = value;
			},
		);

		this.renderPromptTextSetting(
			containerEl,
			INTERFACE_TEXT.settings.prompts.selectedTextSystemPrompt,
			INTERFACE_TEXT.settings.prompts.selectedTextDescription,
			this.settings.selectionSystemPrompt,
			DEFAULT_SELECTION_SYSTEM_PROMPT,
			(value) => {
				this.settings.selectionSystemPrompt = value;
			},
		);

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.prompts.enablePersonalityPrompt)
			.setDesc(INTERFACE_TEXT.settings.prompts.enablePersonalityDescription)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.personalityEnabled).onChange((value) => {
					this.settings.personalityEnabled = value;
					this.refresh();
				});
			});

		if (this.settings.personalityEnabled) {
			this.renderPromptTextSetting(
				containerEl,
				INTERFACE_TEXT.settings.prompts.personalityPrompt,
				INTERFACE_TEXT.settings.prompts.personalityDescription,
				this.settings.personalityPrompt,
				DEFAULT_PERSONALITY_PROMPT,
				(value) => {
					this.settings.personalityPrompt = value;
				},
				5,
			);
		}
	}

	private renderPromptTextSetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		value: string,
		defaultValue: string,
		onChange: (value: string) => void,
		rows = 6,
	): void {
		let currentValue = value;
		let revertButton: { setDisabled(disabled: boolean): void } | null = null;
		const updateRevertButton = (): void => {
			revertButton?.setDisabled(currentValue === defaultValue);
		};

		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addTextArea((text) => {
				text.setValue(value).onChange((newValue) => {
					currentValue = newValue;
					onChange(newValue);
					updateRevertButton();
				});

				text.inputEl.rows = rows;
				text.inputEl.cols = 50;
			})
			.addButton((button) => {
				revertButton = button;
				button.setButtonText(INTERFACE_TEXT.settings.prompts.revertToDefault).onClick(() => {
					onChange(defaultValue);
					this.refresh();
				});
				updateRevertButton();
			});
	}
}
