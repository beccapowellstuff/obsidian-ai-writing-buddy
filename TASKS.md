# AI Draft Bench Tasks

This file tracks the build plan for AI Draft Bench.

AI Draft Bench is an Obsidian writing assistant plugin focused on drafting, rewriting, reviewing, and safely applying AI-generated text to notes.

## Task workflow

- Every actionable task has a stable ID.
- Future work should anchor to an exact task ID before code changes begin.
- New work should be added to this file before being treated as part of the plan.
- Completed work should be marked against an existing task ID, not a newly invented task name.
- The current build focus should stay short and should be the source of truth for what comes next.

## Current build focus

The current focus is getting the plugin from mock-only behaviour to a configurable MVP.

1. CBF-001 DONE: Add settings model and default settings.
2. CBF-002 DONE: Add settings load/save to the plugin.
3. CBF-003 DONE: Add settings tab UI.
4. CBF-004 DONE: Wire mock provider selection through settings instead of hardcoded mock service.
5. CBF-005 DONE: Add OpenAI-compatible AI response service for chat completions.
6. CBF-006 DONE: Add AI provider connection test.
7. CBF-007 DONE: Improve provider error messages in the panel.
8. CBF-008 TODO: Add prompt builder using settings prompts.
9. CBF-009 TODO: Add template system.

## MVP scope

The MVP should allow the user to:

- MVP-001 DONE: Open the AI Draft Bench side panel.
- MVP-002 DONE: Send general chat prompts using mock responses.
- MVP-003 DONE: Send prompts based on selected note text using mock responses.
- MVP-004 DONE: Review responses in the side panel before applying them.
- MVP-005 DONE: Copy AI responses.
- MVP-006 DONE: Replace original selected text safely.
- MVP-007 DONE: Insert responses after original selected text safely.
- MVP-008 DONE: Configure provider, model, connection, and prompt settings in Obsidian settings.
- MVP-009 DONE: Use a configured AI provider instead of mock responses.
- MVP-010 TODO: Use system prompts and personality prompt settings when building AI requests.
- MVP-011 TODO: Use a small starter set of reusable prompt templates.
- MVP-012 DONE: Add provider connection test button.
- MVP-013 DONE: Add model list loading from configured provider.

The MVP does not need:

- Full vault indexing.
- Drag-and-drop context selection.
- Diff view.
- Multiple visual skins.
- Complex prompt library management.
- Advanced personality switching.

## 1. AI provider and settings

Goal: let the plugin use saved settings instead of hardcoded mock behaviour.

- APS-001 DONE: Add plugin settings data model.
- APS-002 DONE: Add default settings.
- APS-003 DONE: Add settings loading and saving.
- APS-004 DONE: Add Obsidian settings tab.
- APS-005 DONE: Add provider selector.
- APS-006 DONE: Add mock provider option.
- APS-007 DONE: Add OpenAI-compatible provider option.
- APS-008 DONE: Add server/base URL setting.
- APS-009 DONE: Add model name setting.
- APS-010 DONE: Add API/secret key setting.
- APS-011 DONE: Add request timeout setting.
- APS-012 DONE: Add basic prompt settings section.
- APS-013 DONE: Add open chat system prompt setting.
- APS-014 DONE: Add selected-text system prompt setting.
- APS-015 DONE: Add personality prompt setting.
- APS-016 DONE: Add personality enabled toggle.
- APS-017 DONE: Wire mock provider selection through settings instead of hardcoded mock service.
- APS-018 DONE: Keep mock provider available for development/testing.
- APS-019 DONE: Add OpenAI-compatible local provider support for tools such as LM Studio or Ollama.
- APS-020 DONE: Add “Test connection” button.
- APS-021 DONE: Show connection test success/failure clearly.
- APS-022 DONE: Add model list loading from configured provider.
- APS-023 TODO: Improve provider error messages in the panel.

## 2. AI response service

Goal: keep the panel flow independent from the AI provider implementation.

- AIR-001 DONE: Add AI response service interface so mock AI and real AI can use the same view flow.
- AIR-002 DONE: Add mock AI response service for selection responses, general chat, and follow-up replies.
- AIR-003 DONE: Add loading placeholder state while AI responses are being generated.
- AIR-004 DONE: Add fallback error responses when AI response generation fails.
- AIR-005 DONE: Pass previous entry context into mock follow-up replies.
- AIR-006 DONE: Add OpenAI-compatible chat completion service.
- AIR-007 DONE: Use real provider for general chat.
- AIR-008 DONE: Use real provider for selected-text requests.
- AIR-009 DONE: Use real provider for follow-up replies.
- AIR-010 TODO: Build request payloads consistently for each request type.
- AIR-011 TODO: Handle provider errors without breaking the panel.
- AIR-012 LATER: Replace `isPlaceholder` with clearer response states such as loading, mock, ready, and error.

## 3. Prompt system

Goal: build AI requests from clear prompt parts instead of raw user text only.

### 3.1 Prompt builder

- PB-001 TODO: Add prompt builder service.
- PB-002 TODO: Use settings prompts when creating AI requests.
- PB-003 TODO: Apply open chat system prompt to general chat entries.
- PB-004 TODO: Apply selected-text system prompt to selected-text requests.
- PB-005 TODO: Apply personality prompt when enabled.
- PB-006 TODO: Keep system prompt, personality prompt, template prompt, selected text, user instruction, and follow-up context separate internally.
- PB-007 TODO: Build request payloads for general chat.
- PB-008 TODO: Build request payloads for selected-text requests.
- PB-009 TODO: Build request payloads for follow-up replies.

### 3.2 Open chat prompt

- OCP-001 DONE: Add editable open chat system prompt setting.
- OCP-002 TODO: Add reset-to-default button.
- OCP-003 TODO: Use open chat system prompt for general chat entries.
- OCP-004 TODO: Keep open chat prompt separate from selected-text templates.

### 3.3 Selected-text prompt

- STP-001 DONE: Add basic freeform instruction prompt for selected text.
- STP-002 DONE: Add editable selected-text system prompt setting.
- STP-003 TODO: Use selected text as explicit source context.
- STP-004 TODO: Make sure the AI understands it must respond to the selected text, not overwrite it automatically.
- STP-005 TODO: Add clear instruction formatting for selected-text requests.
- STP-006 TODO: Keep selected text, user instruction, and template prompt separate in the request model.

### 3.4 Personality prompt

- PER-001 DONE: Add personality prompt setting.
- PER-002 DONE: Add personality enabled toggle.
- PER-003 TODO: Add reset-to-default button.
- PER-004 TODO: Apply personality prompt to open chat and drafting requests when enabled.
- PER-005 TODO: Make personality prompt clearly separate from task templates.
- PER-006 LATER: Add simple personality presets such as Neutral, Friendly editor, Strict editor, and Creative partner.

## 4. Prompt templates

Goal: provide reusable prompt actions without forcing the user to write the same instruction every time.

- TMP-001 TODO: Add prompt template type/model.
- TMP-002 TODO: Add built-in template for fixing spelling and grammar.
- TMP-003 TODO: Add built-in template for making text clearer.
- TMP-004 TODO: Add built-in template for summarising text.
- TMP-005 TODO: Add built-in template for critique.
- TMP-006 TODO: Add built-in template for continuing writing.
- TMP-007 TODO: Add built-in template for rewriting in the same voice.
- TMP-008 TODO: Ensure grammar/spelling templates can return only corrected text with no explanation.
- TMP-009 TODO: Add template selector to the selected-text prompt modal.
- TMP-010 TODO: Let user add optional extra instruction after selecting a template.
- TMP-011 TODO: Show template name and user-added instruction separately in the side panel.
- TMP-012 TODO: Do not display the full template prompt by default.
- TMP-013 TODO: Hide full template prompt behind an expandable debug/details section if needed.
- TMP-014 LATER: Allow user-created templates.
- TMP-015 LATER: Allow editing built-in templates by copying them into user templates.

## 5. Context system

Goal: let chat and follow-up requests include the right context without sending everything blindly.

- CTX-001 DONE: Keep a session history in the side panel instead of replacing the existing panel contents.
- CTX-002 DONE: Refactor the side panel from a single latest request into a scrolling request/response history.
- CTX-003 DONE: Make each history entry keep its own source selection metadata.
- CTX-004 DONE: Allow general chat without selected text. Currently uses mock responses.
- CTX-005 DONE: Add follow-up replies for existing draft entries. Currently uses mock responses.
- CTX-006 DONE: Show reply context snippets when replying to a previous entry.
- CTX-007 DONE: Refer to a specific previous entry by passing reply context into the AI response service.
- CTX-008 TODO: Continue discussing the last selected text.
- CTX-009 TODO: Decide how much session history to send to the AI.
- CTX-010 TODO: Add context builder service for general chat.
- CTX-011 TODO: Add context builder service for selected-text requests.
- CTX-012 TODO: Add context builder service for follow-up replies.
- CTX-013 TODO: Let follow-up replies include previous entry text and response.
- CTX-014 LATER: Let the user choose, drag, or select which note context is attached.
- CTX-015 LATER: Allow attaching the current note as context.
- CTX-016 LATER: Allow attaching linked notes or search results as context.

## 6. Side panel and entry flow

Goal: keep the draft bench usable while responses are generated and reviewed.

- PANEL-001 DONE: Add bottom chat composer UI.
- PANEL-002 DONE: Add fixed bottom chat composer.
- PANEL-003 DONE: Add selection-based entries.
- PANEL-004 DONE: Add general chat entries.
- PANEL-005 DONE: Add follow-up entries.
- PANEL-006 DONE: Add reply action.
- PANEL-007 DONE: Disable empty chat sends and clear the chat box after sending.
- PANEL-008 DONE: Improve disabled chat send button styling and composer spacing.
- PANEL-009 DONE: Hide response action buttons while a response is still generating.
- PANEL-010 TODO: For future general chat entries, only show safe actions such as copy unless a target note or selection exists.
- PANEL-011 TODO: Keep replace and insert actions only for selection-based entries with saved source metadata.
- PANEL-012 TODO: Consider clearer labels for mock responses while development mode is active.
- PANEL-013 TODO: Consider a clear session action.
- PANEL-014 TODO: Add clearer empty-state guidance.

## 7. Note editing actions and safety

Goal: make note changes explicit, reversible in spirit, and safe from stale selections.

- SAFE-001 DONE: Copy response.
- SAFE-002 DONE: Replace original selection.
- SAFE-003 DONE: Insert response after original selection.
- SAFE-004 DONE: Never overwrite note text without explicit user action.
- SAFE-005 DONE: Before replacing or inserting, confirm the original selected text still matches the saved selection.
- SAFE-006 DONE: If the source text changed, cancel the edit and warn the user.
- SAFE-007 DONE: Keep copy as a safe non-editing action that does not modify the note.
- SAFE-008 TODO: Consider whether “Insert below selection” is different enough from “Insert after selection” to keep as a separate action.
- SAFE-009 TODO: Add diff view.
- SAFE-010 TODO: Consider a conflict resolution option when the source text has changed, such as showing the old selection, current text, and proposed replacement before allowing any manual override.

## 8. UI and interaction polish

Goal: make the plugin pleasant and clear without spending too long polishing before the AI core works.

- UI-001 DONE: Use compact icon-only response actions with tooltips.
- UI-002 DONE: Add ribbon button to open the AI Draft Bench panel.
- UI-003 DONE: Add shared plugin display config for name, header text, and icons.
- UI-004 TODO: Review the ribbon/tab icon once the plugin identity is clearer.
- UI-005 TODO: Test alternative ribbon and tab icons through `pluginDisplay.ts`.
- UI-006 TODO: Improve selected-text prompt modal layout.
- UI-007 TODO: Add template selector to selected-text prompt modal.
- UI-008 TODO: Add loading/error styling that is distinct from mock styling later.

## 9. Styling, theming, and release readiness

Goal: prepare the plugin for real-world Obsidian use.

- REL-001 TODO: Before release, review CSS for Obsidian community plugin readiness.
- REL-002 TODO: Scope all selectors under `.ai-draft-bench` where practical.
- REL-003 TODO: Avoid global element selectors.
- REL-004 TODO: Use Obsidian theme variables instead of hardcoded colours.
- REL-005 TODO: Test in light mode, dark mode, and narrow side panels.
- REL-006 TODO: Add plugin-scoped CSS variables so users can customise AI Draft Bench styling safely.
- REL-007 LATER: Consider future visual skins such as Default, Soft, Minimal, Paper, and High contrast.
- REL-008 LATER: Add skin selection later through the settings page.

## 10. Code structure and refactors

Goal: keep the codebase maintainable as the real AI, prompt, and context systems are added.

- CODE-001 DONE: Refactor `SelectionEditService` so replace and insert actions share one selection validation helper.
- CODE-002 DONE: Refactor AI Draft Bench panel opening into a shared service so the ribbon icon and editor menu use the same view-opening logic.
- CODE-003 DONE: Split `AiDraftBenchView` into smaller renderer/helper files now that it handles entries, responses, chat composer, and actions.
- CODE-004 DONE: Keep `styles.css` grouped by UI area and avoid duplicate selectors.
- CODE-005 TODO: Add settings service or settings helpers if `main.ts` starts carrying too much settings logic.
- CODE-006 TODO: Add prompt builder service before real AI integration becomes messy.
- CODE-007 TODO: Add context builder service before follow-up/chat context becomes messy.
