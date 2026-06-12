import { App } from "obsidian";
import { ButtonRowModal, renderModalButton } from "./modal-layout";

type UnsavedChangesModalOptions = {
	title: string;
	description: string;
	cancelText: string;
	discardText: string;
	saveText: string;
	onSave: () => Promise<void>;
	onDiscard: () => void;
	onCancel: () => void;
};

export class UnsavedChangesModal extends ButtonRowModal {
	constructor(
		app: App,
		private readonly options: UnsavedChangesModalOptions,
	) {
		super(app, options);
	}

	protected renderButtons(buttonRowEl: HTMLElement): void {
		renderModalButton(buttonRowEl, this.options.cancelText, () => {
			this.options.onCancel();
			this.close();
		});

		renderModalButton(buttonRowEl, this.options.discardText, () => {
			this.options.onDiscard();
			this.close();
		}, "mod-warning");

		renderModalButton(buttonRowEl, this.options.saveText, () => {
			void this.options.onSave().then(() => {
				this.close();
			});
		}, "mod-cta");
	}
}
