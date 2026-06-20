import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { ErrorDebugLogEntry, ErrorDebugLogInput } from "../types/error-debug-log";

type SavedDebugLog = {
	entries?: unknown;
};

const DEBUG_LOG_FILE_NAME = "error-debug-log.json";
const DEBUG_LOG_EXPORT_FILE_NAME = "error-debug-log-export.txt";
const MAX_DEBUG_LOG_ENTRIES = 200;
const MAX_MESSAGE_LENGTH = 240;
const SAFE_FIELD_KEYS = ["entries", "timestamp", "source", "providerType", "category", "httpStatus", "code", "message", "pluginVersion", "operation"];
const GENERIC_PLUGIN_ERROR_MESSAGE = "Plugin error.";
const GENERIC_PROVIDER_ERROR_MESSAGE = "Unknown provider error.";

export class ErrorDebugLogService {
	private readonly logPath: string;
	private readonly exportPath: string;

	constructor(pluginRootPath: string) {
		this.logPath = join(pluginRootPath, DEBUG_LOG_FILE_NAME);
		this.exportPath = join(pluginRootPath, DEBUG_LOG_EXPORT_FILE_NAME);
	}

	async appendEntry(loggingEnabled: boolean, input: ErrorDebugLogInput): Promise<void> {
		if (!loggingEnabled) {
			return;
		}

		const entries = await this.readEntries();
		const nextEntries = [...entries, this.createEntry(input)].slice(-MAX_DEBUG_LOG_ENTRIES);

		await this.writeEntries(nextEntries);
	}

	async readEntries(): Promise<ErrorDebugLogEntry[]> {
		try {
			const rawLog = await readFile(this.logPath, "utf8");
			const parsedLog = JSON.parse(rawLog) as SavedDebugLog;

			if (!Array.isArray(parsedLog.entries)) {
				return [];
			}

			return parsedLog.entries.map((entry) => this.normaliseEntry(entry)).filter((entry): entry is ErrorDebugLogEntry => Boolean(entry));
		} catch {
			return [];
		}
	}

	async clearEntries(): Promise<void> {
		await this.writeEntries([]);
	}

	async exportEntries(): Promise<void> {
		await mkdir(dirname(this.exportPath), { recursive: true });
		await writeFile(this.exportPath, await this.serialiseEntries(), "utf8");
	}

	async serialiseEntries(): Promise<string> {
		const entries = await this.readEntries();

		return JSON.stringify({ entries }, SAFE_FIELD_KEYS, "\t");
	}

	createEntry(input: ErrorDebugLogInput): ErrorDebugLogEntry {
		const source = input.source === "provider" ? "provider" : "plugin";
		const entry: ErrorDebugLogEntry = {
			timestamp: new Date().toISOString(),
			source,
			message: sanitiseTechnicalMessage(input.message, source),
		};

		this.addSafeStringField(entry, "providerType", input.providerType);
		this.addSafeStringField(entry, "category", input.category);
		this.addSafeHttpStatus(entry, input.httpStatus);
		this.addSafeStringField(entry, "code", input.code);
		this.addSafeStringField(entry, "pluginVersion", input.pluginVersion);
		this.addSafeStringField(entry, "operation", input.operation);

		return entry;
	}

	private async writeEntries(entries: ErrorDebugLogEntry[]): Promise<void> {
		const content = JSON.stringify({ entries }, SAFE_FIELD_KEYS, "\t");
		const temporaryPath = `${this.logPath}.tmp`;

		await mkdir(dirname(this.logPath), { recursive: true });
		await writeFile(temporaryPath, content, "utf8");
		await rename(temporaryPath, this.logPath);
	}

	private normaliseEntry(entry: unknown): ErrorDebugLogEntry | null {
		const rawEntry = asDebugLogEntryObject(entry);

		if (!rawEntry) {
			return null;
		}

		return {
			...this.createEntry(rawEntry),
			timestamp: this.normaliseTimestamp(rawEntry.timestamp),
		};
	}

	private normaliseTimestamp(timestamp: unknown): string {
		return typeof timestamp === "string" && timestamp.trim() ? timestamp : new Date().toISOString();
	}

	private addSafeStringField(entry: ErrorDebugLogEntry, key: keyof Pick<ErrorDebugLogEntry, "providerType" | "category" | "code" | "pluginVersion" | "operation">, value: unknown): void {
		if (typeof value !== "string") {
			return;
		}

		const sanitisedValue = sanitiseSafeLabel(value);

		if (sanitisedValue) {
			entry[key] = sanitisedValue;
		}
	}

	private addSafeHttpStatus(entry: ErrorDebugLogEntry, value: unknown): void {
		if (!isSafeHttpStatus(value)) {
			return;
		}

		entry.httpStatus = value;
	}
}

function sanitiseTechnicalMessage(message: unknown, source: ErrorDebugLogEntry["source"] = "plugin"): string {
	const fallbackMessage = source === "provider" ? GENERIC_PROVIDER_ERROR_MESSAGE : GENERIC_PLUGIN_ERROR_MESSAGE;
	const trimmedMessage = toTrimmedString(message);
	const sanitisedMessage = trimmedMessage ? sanitiseNonEmptyTechnicalMessage(trimmedMessage) : "";

	return sanitisedMessage || fallbackMessage;
}

function sanitiseNonEmptyTechnicalMessage(message: string): string {
	if (containsPrivateSignal(message)) {
		return "";
	}

	const redactedMessage = message
		.replace(/\b(?:bearer|authorization|api[-_\s]?key|token|secret)\b\s*[:=]\s*\S+/gi, "$1 [redacted]")
		.replace(/\b(?:[A-Za-z]:[\\/]|\/(?:Users|home|var|tmp|mnt)\/)\S+/g, "[redacted-path]")
		.replace(/\b\S+\.md\b/gi, "[redacted-note]")
		.replace(/\s+/g, " ");

	return capMessage(redactedMessage);
}

function toTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function sanitiseSafeLabel(value: string): string {
	const trimmedValue = value.trim();

	if (!trimmedValue || containsPrivateSignal(trimmedValue)) {
		return "";
	}

	return capMessage(trimmedValue.replace(/[^\w .:-]/g, "").replace(/\s+/g, " "), 80);
}

function containsPrivateSignal(message: string): boolean {
	const privatePatterns = [
		/["'`]/,
		/\b(?:prompt|selected text|note content|vault content|request body|response body|user message|ai response|authorization|auth header|api[-_\s]?key|bearer|token|secret)\b/i,
		/\b(?:[A-Za-z]:[\\/]|\/(?:Users|home|var|tmp|mnt)\/)\S+/i,
		/\b\S+\.md\b/i,
	];

	return privatePatterns.some((pattern) => pattern.test(message));
}

function isSafeHttpStatus(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}

function asDebugLogEntryObject(entry: unknown): (Partial<ErrorDebugLogEntry> & Pick<ErrorDebugLogEntry, "source">) | null {
	if (!entry || typeof entry !== "object") {
		return null;
	}

	const rawEntry = entry as Partial<ErrorDebugLogEntry>;

	return isErrorDebugLogSource(rawEntry.source) ? { ...rawEntry, source: rawEntry.source } : null;
}

function isErrorDebugLogSource(source: unknown): source is ErrorDebugLogEntry["source"] {
	return source === "provider" || source === "plugin";
}

function capMessage(message: string, maxLength = MAX_MESSAGE_LENGTH): string {
	if (message.length <= maxLength) {
		return message;
	}

	return `${message.slice(0, maxLength - 3)}...`;
}
