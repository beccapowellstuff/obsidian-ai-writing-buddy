import { setIcon, setTooltip } from "obsidian";
import { PLUGIN_DISPLAY } from "../config/plugin-display";
import { AiWritingBuddySessionListItem } from "../types/ai-writing-buddy-plugin-data";

type AiWritingBuddyHeaderRendererOptions = {
	hasEntries: boolean;
	currentSessionTitle?: string;
	sessionListItems: AiWritingBuddySessionListItem[];
	onClearSession: () => void;
	onStartNewSession: () => void;
	onRestoreSession: (sessionId: string) => void;
	onManageSavedSessions: () => void;
};
export class AiWritingBuddyHeaderRenderer {
	render(container: HTMLElement, options: AiWritingBuddyHeaderRendererOptions): void {
		const headerEl = container.createEl("div", {
			cls: "ai-writing-buddy-header",
		});

		const headerTopEl = headerEl.createEl("div", {
			cls: "ai-writing-buddy-header-top",
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
			cls: "ai-writing-buddy-header-title-group",
		});

		titleGroupEl.createEl("div", {
			cls: "ai-writing-buddy-header-kicker",
			text: PLUGIN_DISPLAY.headerKicker,
		});

		titleGroupEl.createEl("h2", {
			text: PLUGIN_DISPLAY.name,
		});
	}

	private renderActions(headerTopEl: HTMLElement, options: AiWritingBuddyHeaderRendererOptions): void {
		const actionsEl = headerTopEl.createEl("div", {
			cls: "ai-writing-buddy-header-actions",
		});

		this.renderSessionHistory(actionsEl, options);
		this.renderSessionManagerButton(actionsEl, options);

		const newSessionButton = actionsEl.createEl("button", {
			cls: "ai-writing-buddy-session-icon-button",
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
			cls: "ai-writing-buddy-session-icon-button",
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

	private renderSessionHistory(actionsEl: HTMLElement, options: AiWritingBuddyHeaderRendererOptions): void {
		const currentSessionTitle = options.currentSessionTitle?.trim();
		const hasCurrentSessionTitle = Boolean(currentSessionTitle && options.hasEntries);
		const hasSavedSessions = options.sessionListItems.length > 0;

		if (!hasCurrentSessionTitle && !hasSavedSessions) {
			return;
		}

		const sessionSelect = actionsEl.createEl("select", {
			cls: "ai-writing-buddy-session-history-select",
		});

		sessionSelect.createEl("option", {
			text: hasCurrentSessionTitle && currentSessionTitle ? currentSessionTitle : "Open a previous session",
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
	}

	private renderSessionManagerButton(actionsEl: HTMLElement, options: AiWritingBuddyHeaderRendererOptions): void {
		const manageSessionsButton = actionsEl.createEl("button", {
			cls: "ai-writing-buddy-session-icon-button",
			attr: {
				type: "button",
				"aria-label": "Open session manager",
			},
		});

		setIcon(manageSessionsButton, "history");
		setTooltip(manageSessionsButton, "Open session manager");

		manageSessionsButton.addEventListener("click", () => {
			options.onManageSavedSessions();
		});
	}

	private getSessionLabel(session: AiWritingBuddySessionListItem): string {
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
