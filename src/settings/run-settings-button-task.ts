import { Notice } from "obsidian";

type SettingsButton = {
	setDisabled(disabled: boolean): void;
	setButtonText(text: string): void;
};

type SettingsButtonTaskOptions = {
	button: SettingsButton;
	busyText: string;
	restoreButtonText: () => void;
	run: () => Promise<void>;
	logMessage: string;
	fallbackErrorMessage: string;
	formatFailureNotice: (message: string) => string;
	onError?: (error: unknown) => void;
};

export async function runSettingsButtonTask(options: SettingsButtonTaskOptions): Promise<void> {
	options.button.setDisabled(true);
	options.button.setButtonText(options.busyText);

	try {
		await options.run();
	} catch (error) {
		console.error(options.logMessage, error);
		options.onError?.(error);

		const message = error instanceof Error ? error.message : options.fallbackErrorMessage;
		new Notice(options.formatFailureNotice(message));
	} finally {
		options.button.setDisabled(false);
		options.restoreButtonText();
	}
}
