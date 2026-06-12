import { App, TFolder, normalizePath } from "obsidian";

export async function ensureVaultFolderExists(app: App, folderPath: string, getBlockedPathMessage: (path: string) => string): Promise<void> {
	const normalisedFolderPath = normalizePath(folderPath);
	const parts = normalisedFolderPath.split("/").filter(Boolean);
	let currentPath = "";

	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;

		const existingFile = app.vault.getAbstractFileByPath(currentPath);

		if (existingFile instanceof TFolder) {
			continue;
		}

		if (existingFile) {
			throw new Error(getBlockedPathMessage(currentPath));
		}

		await app.vault.createFolder(currentPath);
	}
}
