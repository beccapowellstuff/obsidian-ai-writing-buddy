import { setIcon, setTooltip } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";
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
		//			text: INTERFACE_TEXT.header.description,
		//		});
	}

	private renderTitle(headerTopEl: HTMLElement): void {
		const titleGroupEl = headerTopEl.createEl("div", {
			cls: "ai-writing-buddy-header-title-group",
		});

		titleGroupEl.createEl("div", {
			cls: "ai-writing-buddy-header-kicker",
			text: INTERFACE_TEXT.header.kicker,
		});

		titleGroupEl.createEl("h2", {
			text: INTERFACE_TEXT.app.name,
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
				"aria-label": INTERFACE_TEXT.header.startNewSession,
			},
		});

		setIcon(newSessionButton, "plus");
		setTooltip(newSessionButton, INTERFACE_TEXT.header.startNewSession);

		newSessionButton.addEventListener("click", () => {
			options.onStartNewSession();
		});

		const clearButton = actionsEl.createEl("button", {
			cls: "ai-writing-buddy-session-icon-button",
			attr: {
				type: "button",
				"aria-label": INTERFACE_TEXT.header.clearCurrentSession,
			},
		});

		setIcon(clearButton, "eraser");
		setTooltip(clearButton, INTERFACE_TEXT.header.clearCurrentSession);

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
			text: hasCurrentSessionTitle && currentSessionTitle ? currentSessionTitle : INTERFACE_TEXT.header.openPreviousSession,
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
				"aria-label": INTERFACE_TEXT.header.openSessionManager,
			},
		});

		setIcon(manageSessionsButton, "history");
		setTooltip(manageSessionsButton, INTERFACE_TEXT.header.openSessionManager);

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
			return INTERFACE_TEXT.sessionManager.sessionLabel(null, session.entryCount);
		}

		return INTERFACE_TEXT.sessionManager.sessionLabel(updatedAt.toLocaleString(), session.entryCount);
	}
}
