import { Notice } from "obsidian";
import type { AiWritingBuddySettings } from "../config/default-settings";
import { AI_MEMORY_END_MARKER, AI_MEMORY_START_MARKER } from "../config/ai-memory";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type { AiResponseService } from "./ai-response-service";
import { AiMemoryService } from "./ai-memory-service";
import type { AiWritingBuddyChatEntry } from "../types/ai-writing-buddy-entry";

type AiResponseServiceProvider = () => AiResponseService;
type SettingsSaveHandler = () => Promise<void>;

type AiMemoryAddOperation = {
	heading: string;
	text: string;
};

type AiMemoryUpdateOperation = {
	heading: string;
	match: string;
	replacement: string;
};

type AiMemoryRemoveOperation = {
	heading: string;
	match: string;
};

type AiMemoryOperationResponse = {
	add: AiMemoryAddOperation[];
	update: AiMemoryUpdateOperation[];
	remove: AiMemoryRemoveOperation[];
};

type BulletMatch = {
	index: number;
	text: string;
};

export type AiVisibleMemoryUpdateRequest = {
	entry: AiWritingBuddyChatEntry;
	assistantResponseText: string;
};

const MEMORY_UPDATE_NO_CHANGE = "NO_CHANGE";
const MAX_MEMORY_ADD_OPERATIONS = 5;
const MAX_MEMORY_UPDATE_OPERATIONS = 3;
const MAX_MEMORY_REMOVE_OPERATIONS = 3;
const MAX_MEMORY_APPLIED_OPERATIONS = 8;
const MAX_MEMORY_OPERATION_TEXT_CHARACTERS = 1000;

export class AiVisibleMemoryUpdateService {
	private readonly activeEntryIds = new Set<string>();

	constructor(
		private readonly aiMemoryService: AiMemoryService,
		private readonly getAiResponseService: AiResponseServiceProvider,
		private readonly settings: AiWritingBuddySettings,
		private readonly onSaveSettings: SettingsSaveHandler,
	) {}

	async updateAfterChatResponse(request: AiVisibleMemoryUpdateRequest): Promise<void> {
		if (!this.shouldUpdateMemory(request)) {
			return;
		}

		this.activeEntryIds.add(request.entry.id);

		try {
			const currentMemory = await this.aiMemoryService.readManagedBlockForUpdate(this.settings);

			if (!currentMemory) {
				return;
			}

			const providerResponse = await this.getAiResponseService().createMemoryUpdateResponse({
				currentManagedMemory: currentMemory.content,
				latestUserMessage: request.entry.message,
				latestAssistantResponse: request.assistantResponseText,
				usedContextSummary: this.formatUsedContextSummary(request.entry),
			});
			const parsedResponse = this.parseProviderResponse(providerResponse);

			if (parsedResponse === MEMORY_UPDATE_NO_CHANGE || !parsedResponse) {
				return;
			}

			const updatedManagedBlock = this.applyOperations(currentMemory.content, parsedResponse, request.entry.message);

			if (!updatedManagedBlock || updatedManagedBlock === currentMemory.content) {
				return;
			}

			const writeResult = await this.aiMemoryService.replaceManagedBlockIfUnchanged(this.settings, currentMemory.content, updatedManagedBlock);

			if (writeResult !== "updated") {
				console.warn("AI Writing Buddy memory update skipped", {
					reason: writeResult,
					filePath: currentMemory.filePath,
				});
				return;
			}

			this.settings.aiMemoryWriteCount += 1;
			await this.onSaveSettings();

			if (this.settings.aiMemoryCleanupEnabled && this.settings.aiMemoryWriteCount >= this.settings.aiMemoryCleanupWriteThreshold) {
				console.debug("AI Writing Buddy memory cleanup threshold reached; cleanup is reserved for a future step.");
			}

			if (this.settings.aiMemoryShowUpdateNotice) {
				new Notice(INTERFACE_TEXT.notices.aiMemoryUpdated);
			}
		} catch (error) {
			console.warn("AI Writing Buddy memory update failed", error);
		} finally {
			this.activeEntryIds.delete(request.entry.id);
		}
	}

	private shouldUpdateMemory(request: AiVisibleMemoryUpdateRequest): boolean {
		return (
			this.settings.aiMemoryEnabled &&
			this.settings.aiMemoryAutoUpdateEnabled &&
			!this.activeEntryIds.has(request.entry.id) &&
			Boolean(request.entry.message.trim()) &&
			Boolean(request.assistantResponseText.trim())
		);
	}

	private parseProviderResponse(response: string): AiMemoryOperationResponse | typeof MEMORY_UPDATE_NO_CHANGE | null {
		const trimmedResponse = response.trim();

		if (trimmedResponse === MEMORY_UPDATE_NO_CHANGE) {
			return MEMORY_UPDATE_NO_CHANGE;
		}

		const rejectionReason = this.getResponseRejectionReason(trimmedResponse);

		if (rejectionReason) {
			console.warn("AI Writing Buddy memory update rejected", {
				reason: rejectionReason,
			});
			return null;
		}

		try {
			const parsedResponse: unknown = JSON.parse(trimmedResponse);

			if (!this.isMemoryOperationResponse(parsedResponse)) {
				console.warn("AI Writing Buddy memory update rejected", {
					reason: "invalid-schema",
				});
				return null;
			}

			if (this.exceedsOperationLimits(parsedResponse)) {
				console.warn("AI Writing Buddy memory update rejected", {
					reason: "too-many-operations",
				});
				return null;
			}

			return parsedResponse;
		} catch (error) {
			console.warn("AI Writing Buddy memory update rejected", {
				reason: "malformed-json",
				error,
			});
			return null;
		}
	}

	private getResponseRejectionReason(response: string): string | null {
		if (!response) {
			return "empty";
		}

		if (response.includes("```")) {
			return "code-fence";
		}

		if (response.includes(AI_MEMORY_START_MARKER) || response.includes(AI_MEMORY_END_MARKER)) {
			return "contains-markers";
		}

		if (/^#\s+AI Writing Buddy Memory\b/m.test(response)) {
			return "contains-full-note-title";
		}

		if (!response.startsWith("{") || !response.endsWith("}")) {
			return "commentary";
		}

		return null;
	}

	private isMemoryOperationResponse(value: unknown): value is AiMemoryOperationResponse {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return false;
		}

		const candidate = value as Partial<AiMemoryOperationResponse>;

		if (!Array.isArray(candidate.add) || !Array.isArray(candidate.update) || !Array.isArray(candidate.remove)) {
			return false;
		}

		return (
			candidate.add.every((operation) => this.isRecord(operation) && typeof operation.heading === "string" && typeof operation.text === "string") &&
			candidate.update.every(
				(operation) => this.isRecord(operation) && typeof operation.heading === "string" && typeof operation.match === "string" && typeof operation.replacement === "string",
			) &&
			candidate.remove.every((operation) => this.isRecord(operation) && typeof operation.heading === "string" && typeof operation.match === "string")
		);
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return Boolean(value) && typeof value === "object" && !Array.isArray(value);
	}

	private exceedsOperationLimits(response: AiMemoryOperationResponse): boolean {
		return (
			response.add.length > MAX_MEMORY_ADD_OPERATIONS ||
			response.update.length > MAX_MEMORY_UPDATE_OPERATIONS ||
			response.remove.length > MAX_MEMORY_REMOVE_OPERATIONS ||
			response.add.length + response.update.length + response.remove.length > MAX_MEMORY_APPLIED_OPERATIONS
		);
	}

	private applyOperations(currentManagedMemory: string, operations: AiMemoryOperationResponse, latestUserMessage: string): string | null {
		const lines = currentManagedMemory.replace(/\r\n/g, "\n").split("\n");
		const removalAllowed = this.isExplicitMemoryRemovalRequest(latestUserMessage);
		let appliedOperationCount = 0;

		for (const operation of operations.update) {
			if (appliedOperationCount >= MAX_MEMORY_APPLIED_OPERATIONS) {
				break;
			}

			if (this.applyUpdateOperation(lines, operation)) {
				appliedOperationCount += 1;
			}
		}

		if (!removalAllowed && operations.remove.length > 0) {
			console.warn("AI Writing Buddy memory remove operations skipped", {
				reason: "removal-without-intent",
				count: operations.remove.length,
			});
		}

		if (removalAllowed) {
			for (const operation of operations.remove) {
				if (appliedOperationCount >= MAX_MEMORY_APPLIED_OPERATIONS) {
					break;
				}

				if (this.applyRemoveOperation(lines, operation)) {
					appliedOperationCount += 1;
				}
			}
		}

		for (const operation of operations.add) {
			if (appliedOperationCount >= MAX_MEMORY_APPLIED_OPERATIONS) {
				break;
			}

			if (this.applyAddOperation(lines, operation)) {
				appliedOperationCount += 1;
			}
		}

		return appliedOperationCount > 0 ? lines.join("\n") : null;
	}

	private applyAddOperation(lines: string[], operation: AiMemoryAddOperation): boolean {
		if (!this.isValidOperationField(operation.heading, "heading") || !this.isValidOperationField(operation.text, "text")) {
			console.warn("AI Writing Buddy memory add skipped", { reason: "invalid-fields" });
			return false;
		}

		const heading = this.normaliseHeadingForDisplay(operation.heading);
		const text = operation.text.trim();

		if (this.getAllBulletMatches(lines, text).length > 0) {
			console.warn("AI Writing Buddy memory add skipped", { reason: "duplicate" });
			return false;
		}

		const headingRange = this.getHeadingRange(lines, heading);
		const bullet = `- ${text}`;

		if (headingRange) {
			const insertIndex = this.getHeadingInsertIndex(lines, headingRange.endIndex);
			lines.splice(insertIndex, 0, bullet);
			return true;
		}

		this.appendHeading(lines, heading, bullet);
		return true;
	}

	private applyUpdateOperation(lines: string[], operation: AiMemoryUpdateOperation): boolean {
		if (
			!this.isValidOperationField(operation.heading, "heading") ||
			!this.isValidOperationField(operation.match, "match") ||
			!this.isValidOperationField(operation.replacement, "replacement")
		) {
			console.warn("AI Writing Buddy memory update skipped", { reason: "invalid-fields" });
			return false;
		}

		const match = this.getUniqueBulletMatchUnderHeading(lines, operation.heading, operation.match);

		if (!match) {
			return false;
		}

		const replacement = operation.replacement.trim();

		if (this.normaliseBulletText(match.text) === this.normaliseBulletText(replacement)) {
			console.warn("AI Writing Buddy memory update skipped", { reason: "unchanged" });
			return false;
		}

		const existingLine = lines[match.index] ?? "";
		lines[match.index] = `${this.getBulletIndent(existingLine)}- ${replacement}`;
		return true;
	}

	private applyRemoveOperation(lines: string[], operation: AiMemoryRemoveOperation): boolean {
		if (!this.isValidOperationField(operation.heading, "heading") || !this.isValidOperationField(operation.match, "match")) {
			console.warn("AI Writing Buddy memory remove skipped", { reason: "invalid-fields" });
			return false;
		}

		const match = this.getUniqueBulletMatchUnderHeading(lines, operation.heading, operation.match);

		if (!match) {
			return false;
		}

		lines.splice(match.index, 1);
		return true;
	}

	private getUniqueBulletMatchUnderHeading(lines: string[], heading: string, bulletText: string): BulletMatch | null {
		const headingRange = this.getHeadingRange(lines, heading);

		if (!headingRange) {
			console.warn("AI Writing Buddy memory operation skipped", { reason: "missing-heading", heading });
			return null;
		}

		const matches = this.getBulletMatchesInRange(lines, bulletText, headingRange.startIndex + 1, headingRange.endIndex);

		if (matches.length === 0) {
			console.warn("AI Writing Buddy memory operation skipped", { reason: "missing-match", heading });
			return null;
		}

		if (matches.length > 1) {
			console.warn("AI Writing Buddy memory operation skipped", { reason: "ambiguous-match", heading });
			return null;
		}

		return matches[0] ?? null;
	}

	private getAllBulletMatches(lines: string[], bulletText: string): BulletMatch[] {
		return this.getBulletMatchesInRange(lines, bulletText, 0, lines.length);
	}

	private getBulletMatchesInRange(lines: string[], bulletText: string, startIndex: number, endIndex: number): BulletMatch[] {
		const normalisedBulletText = this.normaliseBulletText(bulletText);
		const matches: BulletMatch[] = [];

		for (let index = startIndex; index < endIndex; index += 1) {
			const line = lines[index];
			if (line === undefined) {
				continue;
			}

			const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);

			if (!bulletMatch) {
				continue;
			}

			const text = bulletMatch[2]?.trim() ?? "";

			if (this.normaliseBulletText(text) === normalisedBulletText) {
				matches.push({ index, text });
			}
		}

		return matches;
	}

	private getHeadingRange(lines: string[], heading: string): { startIndex: number; endIndex: number } | null {
		const normalisedHeading = this.normaliseHeading(heading);

		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];

			if (line === undefined || !this.isHeadingLine(line) || this.normaliseHeading(line) !== normalisedHeading) {
				continue;
			}

			let endIndex = lines.length;

			for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
				const nextLine = lines[nextIndex];

				if (nextLine !== undefined && this.isHeadingLine(nextLine)) {
					endIndex = nextIndex;
					break;
				}
			}

			return {
				startIndex: index,
				endIndex,
			};
		}

		return null;
	}

	private getHeadingInsertIndex(lines: string[], headingEndIndex: number): number {
		let insertIndex = headingEndIndex;

		while (insertIndex > 0) {
			const previousLine = lines[insertIndex - 1];

			if (previousLine === undefined || previousLine.trim()) {
				break;
			}

			insertIndex -= 1;
		}

		return insertIndex;
	}

	private appendHeading(lines: string[], heading: string, bullet: string): void {
		while (lines.length > 0) {
			const lastLine = lines[lines.length - 1];

			if (lastLine === undefined || lastLine.trim()) {
				break;
			}

			lines.pop();
		}

		if (lines.length > 0) {
			lines.push("");
		}

		lines.push(`## ${heading}`, "", bullet);
	}

	private isValidOperationField(value: string, fieldName: string): boolean {
		const trimmedValue = value.trim();

		if (!trimmedValue) {
			return false;
		}

		if (trimmedValue.length > MAX_MEMORY_OPERATION_TEXT_CHARACTERS) {
			return false;
		}

		if (trimmedValue.includes("\n") || trimmedValue.includes("\r")) {
			return false;
		}

		if (trimmedValue.includes("```") || trimmedValue.includes(AI_MEMORY_START_MARKER) || trimmedValue.includes(AI_MEMORY_END_MARKER)) {
			return false;
		}

		if (/^#\s+AI Writing Buddy Memory\b/i.test(trimmedValue)) {
			return false;
		}

		return fieldName !== "heading" || this.normaliseHeading(trimmedValue) !== this.normaliseHeading("AI Writing Buddy Memory");
	}

	private isHeadingLine(line: string): boolean {
		return /^#{1,6}\s+\S/.test(line.trim());
	}

	private normaliseHeadingForDisplay(heading: string): string {
		return heading.trim().replace(/^#{1,6}\s*/, "").replace(/\s+#+$/, "").trim();
	}

	private normaliseHeading(heading: string): string {
		return this.normaliseHeadingForDisplay(heading).replace(/\s+/g, " ").toLowerCase();
	}

	private normaliseBulletText(text: string): string {
		return text
			.trim()
			.replace(/^[-*+]\s+/, "")
			.replace(/\s+/g, " ")
			.replace(/\.$/, "")
			.toLowerCase();
	}

	private getBulletIndent(line: string): string {
		return line.match(/^\s*/)?.[0] ?? "";
	}

	private isExplicitMemoryRemovalRequest(text: string): boolean {
		return /\b(forget|remove|delete|clear|clean up|cleanup|prune|drop|stop remembering|no longer remember|no longer true|was wrong|replace the old)\b/i.test(text);
	}

	private formatUsedContextSummary(entry: AiWritingBuddyChatEntry): string | undefined {
		const lines: string[] = [];

		if (entry.usedMemory) {
			lines.push(`Visible memory was included from ${entry.usedMemory.filePath}${entry.usedMemory.wasTruncated ? " and was shortened" : ""}.`);
		}

		if (entry.usedContext) {
			const noteCount = entry.usedContext.notes.length;
			const chunkCount = entry.usedContext.notes.reduce((sum, note) => sum + (note.retrievedChunkCount ?? 0), 0);
			const contextParts: string[] = [entry.usedContext.scope];

			if (entry.usedContext.includeIndexedRag) {
				contextParts.push("RAG");
			}

			lines.push(`RAG/note context was used: ${contextParts.join(" + ")}; ${noteCount} notes; ${chunkCount} retrieved chunks.`);
		}

		return lines.length > 0 ? lines.join("\n") : undefined;
	}
}
