import { AI_MEMORY_END_MARKER, AI_MEMORY_START_MARKER } from "../config/ai-memory";
import type { AiMemoryAddOperation, AiMemoryOperationResponse, AiMemoryRemoveOperation, AiMemoryUpdateOperation } from "./ai-memory-operation-parser";

type BulletMatch = {
	index: number;
	text: string;
};

const MAX_MEMORY_APPLIED_OPERATIONS = 8;
const MAX_MEMORY_OPERATION_TEXT_CHARACTERS = 1000;

export class AiMemoryPatchApplier {
	apply(currentManagedMemory: string, operations: AiMemoryOperationResponse, removalAllowed: boolean): string | null {
		const lines = currentManagedMemory.replace(/\r\n/g, "\n").split("\n");
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
		if (!this.isValidOperationField(operation.heading, "heading") || !this.isValidOperationField(operation.match, "match") || !this.isValidOperationField(operation.replacement, "replacement")) {
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
		return heading
			.trim()
			.replace(/^#{1,6}\s*/, "")
			.replace(/\s+#+$/, "")
			.trim();
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
}
