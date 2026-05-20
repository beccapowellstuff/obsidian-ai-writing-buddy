# TASK LIST

This list tracks completed and upcoming tasks for AI Draft Bench.

AI Draft Bench is an Obsidian writing assistant plugin focused on drafting, rewriting, reviewing, and safely applying AI-generated text to notes.

## 1. MVP Definition

MVP goal:

- DONE: Open an AI Draft Bench side panel.
- DONE: Send general chat prompts using mock responses.
- DONE: Send prompts based on selected note text using mock responses.
- Use configured AI provider instead of mock responses.
- DONE: Allow copy, insert, and replace actions safely.
- Provide a settings page for AI connection and core prompt behaviour.
- Provide a small starter set of reusable prompt templates.
- Keep the system simple enough to test and use before adding advanced vault context.

MVP does not need:

- Full vault indexing.
- Drag-and-drop context selection.
- Diff view.
- Multiple visual skins.
- Complex prompt marketplace/library.
- Advanced personality switching.

## 2. AI Provider And Settings

- Add plugin settings data model.
- Add settings loading and saving.
- Add settings tab in Obsidian.
- Add provider selector.
- DONE: Support Mock provider internally for development/testing.
- Support OpenAI-compatible local provider first, such as LM Studio or Ollama through an OpenAI-compatible endpoint.
- Add base URL setting.
- Add model name setting.
- Add API key setting, optional for local providers.
- Add request timeout setting.
- Add “Test connection” button.
- Show connection test success/failure clearly.
- Replace hardcoded `MockAiResponseService` creation with provider selection from settings.
- Keep mock provider available for testing.

## 3. AI Response Service

- DONE: Add AI response service interface so mock AI and real AI can use the same view flow.
- DONE: Add mock AI response service for selection responses, general chat, and follow-up replies.
- DONE: Add loading placeholder state while AI responses are being generated.
- DONE: Add fallback error responses when AI response generation fails.
- DONE: Mock follow-up replies now receive the previous entry context.
- Add real AI integration for chat composer.
- Add real AI integration for selection responses.
- Add real AI integration for follow-up replies.
- Build request payloads consistently for each request type.
- Handle provider errors without breaking the panel.
- Consider later replacing `isPlaceholder` with clearer response states such as loading, mock, ready, and error.

## 4. Prompt System

Prompt system goal:

AI Draft Bench should not just send raw user text. It should have a clear prompt pipeline made from system prompts, personality prompts, templates, selected text, user instructions, and chat/follow-up context.

### 4.1 Open Chat System Prompt

- Add default open chat system prompt.
- Let user edit open chat system prompt in settings.
- Add reset-to-default button.
- Use open chat system prompt for general chat entries.
- Keep open chat prompt separate from selected-text prompt templates.
- DONE: Add basic freeform instruction prompt for selected text.

### 4.2 Selection Prompt System

- Add default selected-text system prompt.
- Use selected text as explicit source context.
- Make sure AI understands it must respond to the selected text, not overwrite it automatically.
- Add clear instruction formatting for selected text requests.
- Keep selected text, user instruction, and template prompt separate in the request model.

### 4.3 Prompt Templates

- Add prompt template type/model.
- Add built-in prompt templates:
    - Fix spelling and grammar.
    - Make clearer.
    - Summarise.
    - Critique.
    - Continue writing.
    - Rewrite in same voice.
- Ensure grammar/spelling templates can return only corrected text with no explanation.
- Add template selector to the selection prompt modal.
- Let user add optional extra instruction after selecting a template.
- Show template name and user-added instruction separately in the side panel.
- Do not display the full template prompt by default.
- Hide full template prompt behind an expandable debug/details section if needed.
- Later: allow user-created templates.
- Later: allow editing built-in templates by copying them into user templates.

### 4.4 Personality Prompt System

- Add personality prompt setting.
- Let user enable or disable personality prompt.
- Add default personality prompt.
- Add reset-to-default button.
- Apply personality prompt to open chat and drafting requests when enabled.
- Make personality prompt clearly separate from task templates.
- Consider simple personality presets later, such as Neutral, Friendly Editor, Strict Editor, Creative Partner.

## 5. Context System

- DONE: Keep a session history in the side panel instead of replacing the existing panel contents.
- DONE: Refactor the side panel from a single latest request into a scrolling request/response history.
- DONE: Make each history entry keep its own source selection metadata.
- DONE: Allow general chat without a selected text source. Currently uses mock responses.
- DONE: Add follow-up replies for existing draft entries. Currently uses mock responses.
- DONE: Show reply context snippets when replying to a previous entry.
- DONE: Refer to a specific previous entry by passing reply context into the AI response service.
- Continue discussing the last selected text.
- Decide how much session history to send to the AI.
- Add simple context builder for:
    - General chat.
    - Selected-text request.
    - Follow-up reply.
- Let follow-up replies include the previous entry text and response.
- Later: let the user choose, drag, or select which note context is attached.
- Later: allow attaching the current note as context.
- Later: allow attaching linked notes or search results as context.

## 6. Side Panel And Entry Flow

- DONE: Add bottom chat composer UI.
- DONE: Add fixed bottom chat composer.
- DONE: Add selection-based entries.
- DONE: Add general chat entries.
- DONE: Add follow-up entries.
- DONE: Add reply action.
- DONE: Hide response action buttons while a response is still generating.
- For future general chat entries, only show safe actions such as copy unless a target note or selection exists.
- Keep replace and insert actions only for selection-based entries with saved source metadata.
- Consider clearer labels for mock responses while development mode is active.
- Consider a “clear session” action.

## 7. Note Editing Actions And Safety

- DONE: Copy response.
- DONE: Replace original selection.
- DONE: Insert response after original selection.
- DONE: Never overwrite note text without explicit user action.
- DONE: Before replacing or inserting, confirm the original selected text still matches the saved selection.
- DONE: If the source text changed, cancel the edit and warn the user.
- DONE: Keep copy as a safe non-editing action that does not modify the note.
- Consider whether “Insert below selection” is different enough from “Insert after selection” to keep as a separate action.
- Add diff view.
- Consider a conflict resolution option when the source text has changed, such as showing the old selection, current text, and proposed replacement before allowing any manual override.

## 8. UI And Interaction Polish

- DONE: Use compact icon-only response actions with tooltips.
- DONE: Add ribbon button to open the AI Draft Bench panel.
- DONE: Add shared plugin display config for name, header text, and icons.
- DONE: Disable empty chat sends and clear the chat box after sending.
- DONE: Improve disabled chat send button styling and composer spacing.
- Review the ribbon/tab icon once the plugin identity is clearer.
- Test alternative ribbon and tab icons through `pluginDisplay.ts`.
- Improve selected-text prompt modal layout.
- Add template selector to selected-text prompt modal.
- Add clearer empty-state guidance.
- Add loading/error styling that is distinct from mock styling later.

## 9. Styling, Theming, And Release Readiness

- Before release, review CSS for Obsidian community plugin readiness:
    - Scope all selectors under `.ai-draft-bench`.
    - Avoid global element selectors.
    - Use Obsidian theme variables instead of hardcoded colours.
    - Test in light mode, dark mode, and narrow side panels.
- Add plugin-scoped CSS variables so users can customise AI Draft Bench styling safely.
- Consider future visual skins such as Default, Soft, Minimal, Paper, and High Contrast.
- Add skin selection later through the settings page.

## 10. Code Structure And Refactors

- DONE: Refactor `SelectionEditService` so replace and insert actions share one selection validation helper.
- DONE: Refactor AI Draft Bench panel opening into a shared service so the ribbon icon and editor menu use the same view-opening logic.
- DONE: Split `AiDraftBenchView` into smaller renderer/helper files now that it handles entries, responses, chat composer, and actions.
- DONE: Keep `styles.css` grouped by UI area and avoid duplicate selectors.
- Add settings service or settings helpers if `main.ts` starts carrying too much settings logic.
- Add prompt builder service before real AI integration becomes messy.
- Add context builder service before follow-up/chat context becomes messy.