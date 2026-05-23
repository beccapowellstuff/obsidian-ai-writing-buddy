import { setIcon, setTooltip } from "obsidian";
import { PLUGIN_DISPLAY } from "../config/plugin-display";
import { AiDraftBenchSessionListItem } from "../types/ai-writing-buddy-plugin-data";

type DraftBenchHeaderRendererOptions = {
	hasEntries: boolean;
	currentSessionTitle?: string;
	sessionListItems: AiDraftBenchSessionListItem[];
	onClearSession: () => void;
	onStartNewSession: () => void;
	onRestoreSession: (sessionId: string) => void;
	onManageSavedSessions: () => void;
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

		//	May add this back in IF wanted later.
		//		headerEl.createEl("p", {
		//			text: PLUGIN_DISPLAY.headerDescription,
		//		});
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

		this.renderSessionHistory(actionsEl, options);

		const newSessionButton = actionsEl.createEl("button", {
			cls: "ai-draft-bench-session-icon-button",
			attr: {
				type: "button",
				"aria-label": "Start a new session",
			},
		});

		setIcon(newSessionButton, "plus");
		setTooltip(newSessionButton, "Start a new session");

		newSessionButton.addEventListener("click", () => {
			options.onStartNewSession();
		});

		const clearButton = actionsEl.createEl("button", {
			cls: "ai-draft-bench-session-icon-button",
			attr: {
				type: "button",
				"aria-label": "Clear the current session",
			},
		});

		setIcon(clearButton, "eraser");
		setTooltip(clearButton, "Clear the current session");

		clearButton.disabled = !options.hasEntries;
		clearButton.addEventListener("click", () => {
			options.onClearSession();
		});
	}

	private renderSessionHistory(actionsEl: HTMLElement, options: DraftBenchHeaderRendererOptions): void {
		if (options.sessionListItems.length === 0) {
			return;
		}

		const sessionSelect = actionsEl.createEl("select", {
			cls: "ai-draft-bench-session-history-select",
		});

		sessionSelect.createEl("option", {
			text: options.currentSessionTitle?.trim() || "Open a previous session",
			value: "",
		});

		for (const session of options.sessionListItems) {
			sessionSelect.createEl("option", {
				text: this.getSessionLabel(session),
				value: session.id,
			});
		}

		sessionSelect.addEventListener("change", () => {
			if (!sessionSelect.value) {
				return;
			}

			options.onRestoreSession(sessionSelect.value);
		});

		const manageSessionsButton = actionsEl.createEl("button", {
			cls: "ai-draft-bench-session-icon-button",
			attr: {
				type: "button",
				"aria-label": "Manage saved sessions",
			},
		});

		setIcon(manageSessionsButton, "history");
		setTooltip(manageSessionsButton, "Manage saved sessions");

		manageSessionsButton.addEventListener("click", () => {
			options.onManageSavedSessions();
		});
	}

	private getSessionLabel(session: AiDraftBenchSessionListItem): string {
		if (session.userTitle?.trim()) {
			return session.userTitle.trim();
		}

		const updatedAt = new Date(session.updatedAt);

		if (Number.isNaN(updatedAt.getTime())) {
			return `${session.entryCount} entries`;
		}

		return `${updatedAt.toLocaleString()} · ${session.entryCount} entries`;
	}
}
