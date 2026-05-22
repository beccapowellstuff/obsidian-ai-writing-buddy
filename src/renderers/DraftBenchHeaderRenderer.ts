import { PLUGIN_DISPLAY } from "../config/pluginDisplay";

type DraftBenchHeaderRendererOptions = {
	hasEntries: boolean;
	onClearSession: () => void;
	onStartNewSession: () => void;
};

export class DraftBenchHeaderRenderer {
	render(container: HTMLElement, options: DraftBenchHeaderRendererOptions): void {
		const headerEl = container.createEl("div", {
			cls: "ai-draft-bench-header",
		});

		const headerTopEl = headerEl.createEl("div", {
			cls: "ai-draft-bench-header-top",
		});

		this.renderTitle(headerTopEl);
		this.renderActions(headerTopEl, options);

		headerEl.createEl("p", {
			text: PLUGIN_DISPLAY.headerDescription,
		});
	}

	private renderTitle(headerTopEl: HTMLElement): void {
		const titleGroupEl = headerTopEl.createEl("div", {
			cls: "ai-draft-bench-header-title-group",
		});

		titleGroupEl.createEl("div", {
			cls: "ai-draft-bench-header-kicker",
			text: PLUGIN_DISPLAY.headerKicker,
		});

		titleGroupEl.createEl("h2", {
			text: PLUGIN_DISPLAY.name,
		});
	}

	private renderActions(headerTopEl: HTMLElement, options: DraftBenchHeaderRendererOptions): void {
		const actionsEl = headerTopEl.createEl("div", {
			cls: "ai-draft-bench-header-actions",
		});

		const newSessionButton = actionsEl.createEl("button", {
			cls: "ai-draft-bench-session-button",
			text: "Start a new session",
		});
		newSessionButton.type = "button";
		newSessionButton.title = "Start a new session";
		newSessionButton.addEventListener("click", () => {
			options.onStartNewSession();
		});

		const clearButton = actionsEl.createEl("button", {
			cls: "ai-draft-bench-session-button",
			text: "Clear the current session",
		});
		clearButton.type = "button";
		clearButton.title = "Clear the current session";
		clearButton.disabled = !options.hasEntries;
		clearButton.addEventListener("click", () => {
			options.onClearSession();
		});
	}
}
