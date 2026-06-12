import { App } from "obsidian";
import { ButtonRowModal, renderModalButton } from "./modal-layout";

type ConfirmationModalOptions = {
	title: string;
	description: string;
	confirmText: string;
	cancelText: string;
	confirmClass?: string;
	onConfirm: () => void;
};

export class ConfirmationModal extends ButtonRowModal {
	constructor(
		app: App,
		private readonly options: ConfirmationModalOptions,
	) {
		super(app, options);
	}

	protected renderButtons(buttonRowEl: HTMLElement): void {
		renderModalButton(buttonRowEl, this.options.cancelText, () => {
			this.close();
		});

		renderModalButton(buttonRowEl, this.options.confirmText, () => {
			this.options.onConfirm();
			this.close();
		}, this.options.confirmClass);
	}
}
