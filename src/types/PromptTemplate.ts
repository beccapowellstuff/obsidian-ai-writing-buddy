export type PromptTemplateScope = "selection" | "chat";

export type PromptTemplate = {
	id: string;
	name: string;
	description: string;
	scope: PromptTemplateScope;
	prompt: string;
	returnsReplacementTextOnly: boolean;
	highlightChanges: boolean;
	isBuiltIn: boolean;
	createdAt: string;
	updatedAt: string;
};
