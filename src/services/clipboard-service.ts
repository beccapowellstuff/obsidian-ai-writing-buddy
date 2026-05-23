import { Notice } from "obsidian";

export class ClipboardService {
	async copyText(text: string): Promise<void> {
		await navigator.clipboard.writeText(text);
		new Notice("Copied response");
	}
}