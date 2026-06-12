import { setIcon, setTooltip } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { AiWritingBuddyContextScope } from "../types/ai-writing-buddy-context";
import { AiWritingBuddySessionListItem } from "../types/ai-writing-buddy-plugin-data";
import { formatSessionLabel } from "../utils/format-session-label";

type AiWritingBuddyHeaderRendererOptions = {
	hasEntries: boolean;
	currentSessionTitle?: string;
	sessionListItems: AiWritingBuddySessionListItem[];
	contextEnabled: boolean;
	contextScope: AiWritingBuddyContextScope;
	contextIncludeIndexedRag: boolean;
	onClearSession: () => void;
	onStartNewSession: () => void;
	onRestoreSession: (sessionId: string) => void;
	onManageSavedSessions: () => void;
	onContextEnabledChange: (enabled: boolean) => void;
	onContextScopeChange: (scope: AiWritingBuddyContextScope) => void;
	onContextIncludeIndexedRagChange: (enabled: boolean) => void;
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
		this.renderContextControls(actionsEl, options);
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

	private renderContextControls(actionsEl: HTMLElement, options: AiWritingBuddyHeaderRendererOptions): void {
		const controlEl = actionsEl.createEl("label", {
			cls: options.contextEnabled ? "ai-writing-buddy-context-control" : "ai-writing-buddy-context-control is-disabled",
		});

		const checkboxEl = controlEl.createEl("input", {
			attr: {
				type: "checkbox",
			},
		});
		checkboxEl.checked = options.contextEnabled;

		controlEl.createEl("span", {
			text: INTERFACE_TEXT.header.context,
		});

		const selectEl = controlEl.createEl("select", {
			cls: "ai-writing-buddy-context-scope-select",
		});
		selectEl.disabled = !options.contextEnabled;

		selectEl.createEl("option", {
			text: INTERFACE_TEXT.header.contextCurrentNote,
			value: "current-note",
		});
		selectEl.createEl("option", {
			text: INTERFACE_TEXT.header.contextOpenNotes,
			value: "open-notes",
		});
		selectEl.value = options.contextScope === "indexed-notes" ? "open-notes" : options.contextScope;

		const ragControlEl = actionsEl.createEl("label", {
			cls: options.contextEnabled ? "ai-writing-buddy-context-control ai-writing-buddy-rag-control" : "ai-writing-buddy-context-control ai-writing-buddy-rag-control is-disabled",
		});
		const ragCheckboxEl = ragControlEl.createEl("input", {
			attr: {
				type: "checkbox",
			},
		});
		ragCheckboxEl.checked = options.contextIncludeIndexedRag;
		ragCheckboxEl.disabled = !options.contextEnabled;

		ragControlEl.createEl("span", {
			text: INTERFACE_TEXT.header.contextRag,
		});

		checkboxEl.addEventListener("change", () => {
			options.onContextEnabledChange(checkboxEl.checked);
		});

		selectEl.addEventListener("change", () => {
			options.onContextScopeChange(selectEl.value as AiWritingBuddyContextScope);
		});

		ragCheckboxEl.addEventListener("change", () => {
			options.onContextIncludeIndexedRagChange(ragCheckboxEl.checked);
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
		return formatSessionLabel(session);
	}
}
