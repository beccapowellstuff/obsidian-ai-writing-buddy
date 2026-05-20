# AI Draft Bench Tasks

This file tracks the build plan for AI Draft Bench.

AI Draft Bench is an Obsidian writing assistant plugin focused on drafting, rewriting, reviewing, and safely applying AI-generated text to notes.

## Current build focus

The current focus is getting the plugin from mock-only behaviour to a configurable MVP.

1. DONE: Add settings model and default settings.
2. DONE: Add settings load/save to the plugin.
3. DONE: Add settings tab UI.
4. Wire mock provider selection through settings instead of hardcoded mock service.
5. Add OpenAI-compatible AI response service.
6. Add prompt builder using settings prompts.
7. Add template system.

## MVP scope

The MVP should allow the user to:

- DONE: Open the AI Draft Bench side panel.
- DONE: Send general chat prompts using mock responses.
- DONE: Send prompts based on selected note text using mock responses.
- DONE: Review responses in the side panel before applying them.
- DONE: Copy AI responses.
- DONE: Replace original selected text safely.
- DONE: Insert responses after original selected text safely.
- DONE: Configure provider, model, connection, and prompt settings in Obsidian settings.
- Use a configured AI provider instead of mock responses.
- Use system prompts and personality prompt settings when building AI requests.
- Use a small starter set of reusable prompt templates.

The MVP does not need:

- Full vault indexing.
- Drag-and-drop context selection.
- Diff view.
- Multiple visual skins.
- Complex prompt library management.
- Advanced personality switching.

## 1. AI provider and settings

Goal: let the plugin use saved settings instead of hardcoded mock behaviour.

- DONE: Add plugin settings data model.
- DONE: Add default settings.
- DONE: Add settings loading and saving.
- DONE: Add Obsidian settings tab.
- DONE: Add provider selector.
- DONE: Add mock provider option.
- DONE: Add OpenAI-compatible provider option.
- DONE: Add server/base URL setting.
- DONE: Add model name setting.
- DONE: Add API/secret key setting.
- DONE: Add request timeout setting.
- DONE: Add basic prompt settings section.
- DONE: Add open chat system prompt setting.
- DONE: Add selected-text system prompt setting.
- DONE: Add personality prompt setting.
- DONE: Add personality enabled toggle.
- Wire mock provider selection through settings instead of hardcoded mock service.
- Keep mock provider available for development/testing.
- Add OpenAI-compatible local provider support for tools such as LM Studio or Ollama.
- Add “Test connection” button.
- Show connection test success/failure clearly.

## 2. AI response service

Goal: keep the panel flow independent from the AI provider implementation.

- DONE: Add AI response service interface so mock AI and real AI can use the same view flow.
- DONE: Add mock AI response service for selection responses, general chat, and follow-up replies.
- DONE: Add loading placeholder state while AI responses are being generated.
- DONE: Add fallback error responses when AI response generation fails.
- DONE: Pass previous entry context into mock follow-up replies.
- Add OpenAI-compatible chat completion service.
- Use real provider for general chat.
- Use real provider for selected-text requests.
- Use real provider for follow-up replies.
- Build request payloads consistently for each request type.
- Handle provider errors without breaking the panel.
- Later: replace `isPlaceholder` with clearer response states such as loading, mock, ready, and error.

## 3. Prompt system

Goal: build AI requests from clear prompt parts instead of raw user text only.

### 3.1 Prompt builder

- Add prompt builder service.
- Use settings prompts when creating AI requests.
- Apply open chat system prompt to general chat entries.
- Apply selected-text system prompt to selected-text requests.
- Apply personality prompt when enabled.
- Keep system prompt, personality prompt, template prompt, selected text, user instruction, and follow-up context separate internally.
- Build request payloads for:
    - General chat.
    - Selected-text request.
    - Follow-up reply.

### 3.2 Open chat prompt

- DONE: Add editable open chat system prompt setting.
- Add reset-to-default button.
- Use open chat system prompt for general chat entries.
- Keep open chat prompt separate from selected-text templates.

### 3.3 Selected-text prompt

- DONE: Add basic freeform instruction prompt for selected text.
- DONE: Add editable selected-text system prompt setting.
- Use selected text as explicit source context.
- Make sure the AI understands it must respond to the selected text, not overwrite it automatically.
- Add clear instruction formatting for selected-text requests.
- Keep selected text, user instruction, and template prompt separate in the request model.

### 3.4 Personality prompt

- DONE: Add personality prompt setting.
- DONE: Add personality enabled toggle.
- Add reset-to-default button.
- Apply personality prompt to open chat and drafting requests when enabled.
- Make personality prompt clearly separate from task templates.
- Later: add simple personality presets such as Neutral, Friendly editor, Strict editor, and Creative partner.

## 4. Prompt templates

Goal: provide reusable prompt actions without forcing the user to write the same instruction every time.

- Add prompt template type/model.
- Add built-in templates:
    - Fix spelling and grammar.
    - Make clearer.
    - Summarise.
    - Critique.
    - Continue writing.
    - Rewrite in same voice.
- Ensure grammar/spelling templates can return only corrected text with no explanation.
- Add template selector to the selected-text prompt modal.
- Let user add optional extra instruction after selecting a template.
- Show template name and user-added instruction separately in the side panel.
- Do not display the full template prompt by default.
- Hide full template prompt behind an expandable debug/details section if needed.
- Later: allow user-created templates.
- Later: allow editing built-in templates by copying them into user templates.

## 5. Context system

Goal: let chat and follow-up requests include the right context without sending everything blindly.

- DONE: Keep a session history in the side panel instead of replacing the existing panel contents.
- DONE: Refactor the side panel from a single latest request into a scrolling request/response history.
- DONE: Make each history entry keep its own source selection metadata.
- DONE: Allow general chat without selected text. Currently uses mock responses.
- DONE: Add follow-up replies for existing draft entries. Currently uses mock responses.
- DONE: Show reply context snippets when replying to a previous entry.
- DONE: Refer to a specific previous entry by passing reply context into the AI response service.
- Continue discussing the last selected text.
- Decide how much session history to send to the AI.
- Add context builder service for:
    - General chat.
    - Selected-text request.
    - Follow-up reply.
- Let follow-up replies include previous entry text and response.
- Later: let the user choose, drag, or select which note context is attached.
- Later: allow attaching the current note as context.
- Later: allow attaching linked notes or search results as context.

## 6. Side panel and entry flow

Goal: keep the draft bench usable while responses are generated and reviewed.

- DONE: Add bottom chat composer UI.
- DONE: Add fixed bottom chat composer.
- DONE: Add selection-based entries.
- DONE: Add general chat entries.
- DONE: Add follow-up entries.
- DONE: Add reply action.
- DONE: Disable empty chat sends and clear the chat box after sending.
- DONE: Improve disabled chat send button styling and composer spacing.
- DONE: Hide response action buttons while a response is still generating.
- For future general chat entries, only show safe actions such as copy unless a target note or selection exists.
- Keep replace and insert actions only for selection-based entries with saved source metadata.
- Consider clearer labels for mock responses while development mode is active.
- Consider a “clear session” action.
- Add clearer empty-state guidance.

## 7. Note editing actions and safety

Goal: make note changes explicit, reversible in spirit, and safe from stale selections.

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

## 8. UI and interaction polish

Goal: make the plugin pleasant and clear without spending too long polishing before the AI core works.

- DONE: Use compact icon-only response actions with tooltips.
- DONE: Add ribbon button to open the AI Draft Bench panel.
- DONE: Add shared plugin display config for name, header text, and icons.
- Review the ribbon/tab icon once the plugin identity is clearer.
- Test alternative ribbon and tab icons through `pluginDisplay.ts`.
- Improve selected-text prompt modal layout.
- Add template selector to selected-text prompt modal.
- Add loading/error styling that is distinct from mock styling later.

## 9. Styling, theming, and release readiness

Goal: prepare the plugin for real-world Obsidian use.

- Before release, review CSS for Obsidian community plugin readiness:
    - Scope all selectors under `.ai-draft-bench`.
    - Avoid global element selectors.
    - Use Obsidian theme variables instead of hardcoded colours.
    - Test in light mode, dark mode, and narrow side panels.
- Add plugin-scoped CSS variables so users can customise AI Draft Bench styling safely.
- Consider future visual skins such as Default, Soft, Minimal, Paper, and High contrast.
- Add skin selection later through the settings page.

## 10. Code structure and refactors

Goal: keep the codebase maintainable as the real AI, prompt, and context systems are added.

- DONE: Refactor `SelectionEditService` so replace and insert actions share one selection validation helper.
- DONE: Refactor AI Draft Bench panel opening into a shared service so the ribbon icon and editor menu use the same view-opening logic.
- DONE: Split `AiDraftBenchView` into smaller renderer/helper files now that it handles entries, responses, chat composer, and actions.
- DONE: Keep `styles.css` grouped by UI area and avoid duplicate selectors.
- Add settings service or settings helpers if `main.ts` starts carrying too much settings logic.
- Add prompt builder service before real AI integration becomes messy.
- Add context builder service before follow-up/chat context becomes messy.
