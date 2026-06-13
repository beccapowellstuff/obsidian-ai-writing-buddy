import { describe, expect, it } from "vitest";

import { formatProviderErrorMessage } from "../../src/utils/format-provider-error-message";

describe("formatProviderErrorMessage", () => {
	it("uses the unknown-provider fallback for an undefined error", () => {
		const result = formatProviderErrorMessage(undefined);

		expect(result).toContain("The AI provider failed while creating a response.");

		expect(result).toContain("Technical detail: Unknown provider error.");
	});
});
