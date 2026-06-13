import { describe, expect, it } from "vitest";

import { formatProviderErrorMessage } from "../../src/utils/format-provider-error-message";

describe("formatProviderErrorMessage", () => {
	it("formats provider timeout errors", () => {
		const result = formatProviderErrorMessage(new Error("AI provider request timed out after 60000ms."));

		expect(result).toBe(
			[
				"The AI provider is asleep and took too long to respond.",
				"",
				"Check that the provider is running, the selected model is loaded, and the timeout setting is high enough for your model.",
				"",
				"Technical detail: AI provider request timed out after 60000ms.",
			].join("\n"),
		);
	});

	it("formats connection failures", () => {
		const result = formatProviderErrorMessage(new TypeError("Failed to fetch"));

		expect(result).toBe(
			["AI Writing Buddy could not reach the AI provider.", "", "Check that the provider is running and that the server address is correct.", "", "Technical detail: Failed to fetch"].join("\n"),
		);
	});

	it("formats HTTP status failures", () => {
		const result = formatProviderErrorMessage(new Error("AI provider request failed with status 503."));

		expect(result).toBe(
			[
				"The AI provider rejected the request.",
				"",
				"Check the server address, selected model, and API key if your provider needs one.",
				"",
				"Technical detail: AI provider request failed with status 503.",
			].join("\n"),
		);
	});

	it("formats empty provider responses", () => {
		const result = formatProviderErrorMessage(new Error("AI provider returned an empty response."));

		expect(result).toBe(
			[
				"The AI provider replied, but did not return any text.",
				"",
				"Try again, or check that the selected model supports chat completions.",
				"",
				"Technical detail: AI provider returned an empty response.",
			].join("\n"),
		);
	});

	it("currently formats cancellation as a general provider failure", () => {
		const result = formatProviderErrorMessage(new DOMException("The request was cancelled.", "AbortError"));

		expect(result).toBe(
			[
				"The AI provider failed while creating a response.",
				"",
				"Check your provider settings, server address, selected model, and API key if needed.",
				"",
				"Technical detail: The request was cancelled.",
			].join("\n"),
		);
	});

	it("formats an unknown error", () => {
		const result = formatProviderErrorMessage(new Error("Something unexpected happened."));

		expect(result).toBe(
			[
				"The AI provider failed while creating a response.",
				"",
				"Check your provider settings, server address, selected model, and API key if needed.",
				"",
				"Technical detail: Something unexpected happened.",
			].join("\n"),
		);
	});

	it.each([
		["undefined", undefined],
		["null", null],
		["an empty string", ""],
		["a whitespace-only string", "   "],
		["an error with an empty message", new Error("")],
	])("uses the unknown-provider fallback for %s", (_description, error) => {
		const result = formatProviderErrorMessage(error);

		expect(result).toBe(
			[
				"The AI provider failed while creating a response.",
				"",
				"Check your provider settings, server address, selected model, and API key if needed.",
				"",
				"Technical detail: Unknown provider error.",
			].join("\n"),
		);
	});
});
