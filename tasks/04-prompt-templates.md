# Prompt templates

Goal: provide reusable prompt actions without forcing the user to write the same instruction every time.

- TMP-001 DONE: Add prompt template type/model.
- TMP-002 DONE: Add built-in template for fixing spelling and grammar.
- TMP-003 DONE: Add built-in template for making text clearer.
- TMP-004 DONE: Add built-in template for summarising text.
- TMP-005 DONE: Add built-in template for critique.
- TMP-006 DONE: Add built-in template for continuing writing.
- TMP-007 DONE: Add built-in template for rewriting in the same voice.
- TMP-008 DONE: Ensure grammar/spelling templates can return only corrected text with no explanation.
- TMP-009 DONE: Add template selector to the selected-text prompt modal.
- TMP-010 DONE: Let user add optional extra instruction after selecting a template.
- TMP-011 DONE: Show template name and user-added instruction separately in the side panel.
- TMP-012 DONE: Do not display the full template prompt by default.
- TMP-013 DONE: Hide full template prompt behind an expandable debug/details section if needed.
- TMP-014 DONE: Allow user-created templates.
- TMP-015 DONE: Allow editing built-in templates by copying them into user templates.
- TMP-016 DONE: Add per-template generation settings such as temperature.

- TMP-017 TODO: Add grouped template submenu to editor right-click menu.
- TMP-018 TODO: Add template submenu actions to editor right-click menu.
- TMP-019 TODO: Add run last template action.
- TMP-020 TODO: Move template editing and built-in copying into modals.
  - ConnectionSettingsRenderer.ts
  - PromptSettingsRenderer.ts
  - OpenAiCompatibleResponseService.ts
  - DraftBenchPromptBuilder.ts
  - EditorMenuService.ts
  - AiPromptModal.ts
  - Add TemplateEditModal
  - Add CopyBuiltInTemplateModal
  - Keep TemplateSettingsRenderer as a compact summary/list
- TMP-021 TODO: Show a no-change result for replacement-only templates when the AI output matches the selected text.
  - For spelling and grammar fixes, if the returned text is effectively identical to the selected text, show a friendly no-change message instead of repeating the full selected text.
  - Suggested message: “No spelling or grammar changes found.”
  - Keep the original response available only if needed for debugging later.
