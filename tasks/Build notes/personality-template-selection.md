The user enables personality.

They choose a personality from a dropdown.

Built-in personalities appear in that dropdown, such as:

Neutral

Friendly editor

Strict editor

Creative partner

The selected personality fills/uses a prompt template.

Users can create custom personality templates.

Custom personality templates are stored and also appear in the dropdown.

That is a better model than just one loose textarea.

I’d be slightly careful with the word template, though, because you already have PromptTemplate for selected-text tasks, with fields like scope, returnsReplacementTextOnly, highlightChanges, and temperature. The existing type technically has scope: "selection" | "chat", but it is currently used as task/template behaviour, not personality behaviour.

So I would not reuse PromptTemplate for personality. That would muddy the water.

I’d make a separate type later, something like:

export type PersonalityPreset = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
};

Then settings would eventually become something like:

personalityEnabled: boolean;
selectedPersonalityPresetId: string;
personalityPresets: PersonalityPreset[];

Possibly keep personalityPrompt temporarily for migration, so existing users don’t lose their custom text.

UI-wise, I’d make it:

Enable personality prompt toggle

Personality dropdown

Description small text under it

Prompt preview/edit box

If built-in preset is selected, the text box could be read-only with a Copy to custom button.

If custom preset is selected, the text box is editable.

That mirrors your selected-text template approach without mixing the two systems.

For task status, I’d write:

PER-006 TODO: Add personality presets and custom personality templates.

And maybe add a child note:

Replace the single personality prompt textarea with a dropdown of built-in and user-created personality presets. Keep these separate from selected-text task templates.

This is not needed before CTX-008, but it would make the settings feel much more “real plugin” and less prototype-y. Also, honestly, it’s a cute feature. The strict editor preset can be the one that gently bonks weak prose with a ruler.