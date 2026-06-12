import { INTERFACE_TEXT } from "../config/language/en-gb";

type SessionLabelInput = {
	userTitle?: string;
	updatedAt: string;
	entryCount: number;
};

export function formatSessionLabel(session: SessionLabelInput): string {
	if (session.userTitle?.trim()) {
		return session.userTitle.trim();
	}

	const updatedAt = new Date(session.updatedAt);

	if (Number.isNaN(updatedAt.getTime())) {
		return INTERFACE_TEXT.sessionManager.sessionLabel(null, session.entryCount);
	}

	return INTERFACE_TEXT.sessionManager.sessionLabel(updatedAt.toLocaleString(), session.entryCount);
}
