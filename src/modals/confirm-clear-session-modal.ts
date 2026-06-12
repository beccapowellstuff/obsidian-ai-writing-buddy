import { App } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import { ConfirmationModal } from "./confirmation-modal";

export class ConfirmClearSessionModal extends ConfirmationModal {
	constructor(app: App, onConfirm: () => void) {
		super(app, {
			title: INTERFACE_TEXT.sessionManager.clearTitle,
			description: INTERFACE_TEXT.sessionManager.clearDescription,
			confirmText: INTERFACE_TEXT.sessionManager.clearSession,
			cancelText: INTERFACE_TEXT.sessionManager.cancel,
			confirmClass: "mod-warning",
			onConfirm,
		});
	}
}
