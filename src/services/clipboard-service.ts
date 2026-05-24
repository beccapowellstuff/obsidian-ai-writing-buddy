import { Notice } from "obsidian";
import { INTERFACE_TEXT } from "../config/interface-text";

export class ClipboardService {
	async copyText(text: string): Promise<void> {
		await navigator.clipboard.writeText(text);
		new Notice(INTERFACE_TEXT.notices.copiedResponse);
	}
}
