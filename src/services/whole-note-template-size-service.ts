import type { PromptTemplate } from "../types/prompt-template";

export type WholeNoteTemplateSizeCheck = {
	fits: boolean;
	estimatedCharacters: number;
	maxCharacters: number;
};

const WHOLE_NOTE_TEMPLATE_OVERHEAD_CHARACTERS = 4000;

export class WholeNoteTemplateSizeService {
	checkWholeNoteTemplateSize(template: PromptTemplate, noteContent: string, instruction: string, maxCharacters: number): WholeNoteTemplateSizeCheck {
		const estimatedCharacters = template.prompt.length + noteContent.length + instruction.length + WHOLE_NOTE_TEMPLATE_OVERHEAD_CHARACTERS;

		return {
			fits: estimatedCharacters <= maxCharacters,
			estimatedCharacters,
			maxCharacters,
		};
	}
}
