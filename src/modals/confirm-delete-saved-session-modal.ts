import { App } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { ConfirmationModal } from "./confirmation-modal";

export class ConfirmDeleteSavedSessionModal extends ConfirmationModal {
	constructor(app: App, sessionLabel: string, onConfirm: () => void) {
		super(app, {
			title: INTERFACE_TEXT.sessionManager.deleteTitle,
			description: INTERFACE_TEXT.sessionManager.deleteDescription(sessionLabel),
			confirmText: INTERFACE_TEXT.sessionManager.deleteSavedSession,
			cancelText: INTERFACE_TEXT.sessionManager.cancel,
			confirmClass: "mod-warning",
			onConfirm,
		});
	}
}
