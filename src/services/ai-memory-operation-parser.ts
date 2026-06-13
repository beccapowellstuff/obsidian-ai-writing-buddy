import { AI_MEMORY_END_MARKER, AI_MEMORY_START_MARKER } from "../config/ai-memory";

export type AiMemoryAddOperation = {
	heading: string;
	text: string;
};

export type AiMemoryUpdateOperation = {
	heading: string;
	match: string;
	replacement: string;
};

export type AiMemoryRemoveOperation = {
	heading: string;
	match: string;
};

export type AiMemoryOperationResponse = {
	add: AiMemoryAddOperation[];
	update: AiMemoryUpdateOperation[];
	remove: AiMemoryRemoveOperation[];
};

export const MEMORY_UPDATE_NO_CHANGE = "NO_CHANGE" as const;

const MAX_MEMORY_ADD_OPERATIONS = 5;
const MAX_MEMORY_UPDATE_OPERATIONS = 3;
const MAX_MEMORY_REMOVE_OPERATIONS = 3;
const MAX_MEMORY_APPLIED_OPERATIONS = 8;

export class AiMemoryOperationParser {
	parse(response: string): AiMemoryOperationResponse | typeof MEMORY_UPDATE_NO_CHANGE | null {
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
}
