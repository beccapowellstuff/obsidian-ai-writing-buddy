import { App, Modal } from "obsidian";

export type ModalLayoutOptions = {
	title: string;
	description: string;
};

export abstract class ButtonRowModal extends Modal {
	constructor(
		app: App,
		protected readonly layoutOptions: ModalLayoutOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const buttonRowEl = renderModalHeaderAndButtonRow(this.contentEl, this.layoutOptions);

		this.renderButtons(buttonRowEl);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	protected abstract renderButtons(buttonRowEl: HTMLElement): void;
}

export function renderModalButton(container: HTMLElement, text: string, onClick: () => void, cls?: string): HTMLButtonElement {
	const buttonEl = container.createEl("button", {
		text,
		cls,
	});

	buttonEl.type = "button";
	buttonEl.addEventListener("click", onClick);

	return buttonEl;
}

function renderModalHeaderAndButtonRow(contentEl: HTMLElement, options: ModalLayoutOptions): HTMLElement {
	contentEl.empty();

	contentEl.createEl("h2", {
		text: options.title,
	});

	contentEl.createEl("p", {
		text: options.description,
	});

	return contentEl.createEl("div", {
		cls: "ai-writing-buddy-modal-button-row",
	});
}
