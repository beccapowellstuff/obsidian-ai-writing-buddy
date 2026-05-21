# AI Draft Bench Tasks

This file is the task index for AI Draft Bench.

AI Draft Bench is an Obsidian writing assistant plugin focused on drafting, rewriting, reviewing, and safely applying AI-generated text to notes.

Detailed tasks now live in grouped files under `tasks/` so each area can be edited without turning this file into a giant scroll.

## Task workflow

- Every actionable task has a stable ID.
- Task IDs are globally unique across all task files.
- Future work should anchor to an exact task ID before code changes begin.
- New work should be added to the relevant grouped task file before being treated as part of the plan.
- Completed work should be marked against an existing task ID, not a newly invented task name.
- The current focus should stay short and should be the source of truth for what comes next.

## Task groups

- Current focus and MVP scope: `tasks/00-current-focus.md`
- AI provider and settings: `tasks/01-provider-settings.md`
- AI response service: `tasks/02-ai-response-service.md`
- Prompt system: `tasks/03-prompt-system.md`
- Prompt templates: `tasks/04-prompt-templates.md`
- Context system and sessions: `tasks/05-context-sessions.md`
- Side panel and entry flow: `tasks/06-side-panel.md`
- Note editing actions and safety: `tasks/07-note-editing-safety.md`
- UI and interaction polish: `tasks/08-ui-polish.md`
- Styling, theming, and release readiness: `tasks/09-release-readiness.md`
- Code structure and refactors: `tasks/10-code-structure.md`
- Workflow and accessibility: `tasks/11-workflow-accessibility.md`
- Fun and personality ideas: `tasks/12-fun-ideas.md`
- Settings and documentation: `tasks/13-settings-and-docs.md`

## Recently completed focus

The previous build focus, moving the plugin from mock-only behaviour to a configurable MVP, is now complete.

See `tasks/00-current-focus.md` for the completed focus list.

## Next likely areas

Useful next candidates include:

<<<<<<< HEAD
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
- APS-024 TODO: Enforce configured request timeout for OpenAI-compatible requests
- APS-025 DONE: Move prompt size limit into plugin settings/config

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

- PB-001 DONE: Add prompt builder service.
- PB-002 DONE: Use settings prompts when creating AI requests.
- PB-003 DONE: Apply open chat system prompt to general chat entries.
- PB-004 DONE: Apply selected-text system prompt to selected-text requests.
- PB-005 DONE: Apply personality prompt when enabled.
- PB-006 TODO: Keep system prompt, personality prompt, template prompt, selected text, user instruction, and follow-up context separate internally.
- PB-007 TODO: Build request payloads for general chat.
- PB-008 TODO: Build request payloads for selected-text requests.
- PB-009 TODO: Build request payloads for follow-up replies.
- PB-010 DONE: Add prompt/context size guard before sending AI requests.

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
- TMP-020 TODO: Move template editing and built-in copying into modals
- - ConnectionSettingsRenderer.ts
- - PromptSettingsRenderer.ts
- - OpenAiCompatibleResponseService.ts
- - DraftBenchPromptBuilder.ts
- - EditorMenuService.ts
- - AiPromptModal.ts
- - Add TemplateEditModal
- - Add CopyBuiltInTemplateModal
- - Keep TemplateSettingsRenderer as a compact summary/list
- TMP-021 TODO: Show a no-change result for replacement-only templates when the AI output matches the selected text
- - For spelling and grammar fixes, if the returned text is effectively identical to the selected text, show a friendly no-change message instead of repeating the full selected text.
- - Suggested message: “No spelling or grammar changes found.”
- - Keep the original response available only if needed for debugging later.

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
- CTX-017 TODO: Add context size guard for selected text and follow-up context.
- CTX-018 TODO: Add surrounding note context for selected-text requests.
- CTX-019 TODO: Add persistent draft bench sessions
- CTX-020 TODO: Add new session action
- CTX-021 TODO: Add session history list
- CTX-022 TODO: Add saved session metadata
- - id
- - createdAt
- - updatedAt
- - entryCount
- - optional userTitle
- CTX-023 TODO: Add delete saved session action
- CTX-024 TODO: Add rename saved session action

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
- PANEL-015 DONE: Preserve panel scroll position while rendering new entries.

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
- UI-009 DONE: Highlight changed words in replacement-style responses.

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
- REL-009 TODO: Clean package metadata before release
- REL-010 TODO: Validate mobile compatibility or mark plugin desktop-only

## 10. Code structure and refactors

Goal: keep the codebase maintainable as the real AI, prompt, and context systems are added.

- CODE-001 DONE: Refactor `SelectionEditService` so replace and insert actions share one selection validation helper.
- CODE-002 DONE: Refactor AI Draft Bench panel opening into a shared service so the ribbon icon and editor menu use the same view-opening logic.
- CODE-003 DONE: Split `AiDraftBenchView` into smaller renderer/helper files now that it handles entries, responses, chat composer, and actions.
- CODE-004 DONE: Keep `styles.css` grouped by UI area and avoid duplicate selectors.
- CODE-005 TODO: Add settings service or settings helpers if `main.ts` starts carrying too much settings logic.
- CODE-006 TODO: Add prompt builder service before real AI integration becomes messy.
- CODE-007 TODO: Add context builder service before follow-up/chat context becomes messy.
- CODE-008 DONE: Split template settings rendering out of AiDraftBenchSettingTab.
- CODE-009 DONE: Split provider and prompt settings rendering out of AiDraftBenchSettingTab.
- CODE-010 DONE: Split DraftBenchEntryRenderer into smaller response/source/diff renderers.
- - DraftBenchEntryRenderer.ts
- - DraftBenchSourcePanelRenderer.ts
- - DraftBenchResponseRenderer.ts
- - ResponseDiffRenderer.ts
- CODE-011 DONE: Move side-panel session flow out of AiDraftBenchView.
- - AiDraftBenchView.ts
- - DraftBenchSessionController.ts
- - DraftBenchScrollService.ts
- CODE-012 TODO: Move side-panel session state into DraftBenchSessionController
- CODE-013 TODO: Keep AiDraftBenchView focused on layout and rendering orchestration
- CODE-014 TODO: Move provider model loading out of main plugin class
- CODE-015 TODO: Add selected-text request factory
- CODE-016 TODO: Review duplicate built-in continuation templates

## 11. Workflow/Accessibility

- CMD-001 LATER: Add command palette commands for common AI Draft Bench actions.
- CMD-002 LATER: Add command palette command to ask about current selection.
- CMD-003 LATER: Add command palette command to run last template.
- CMD-004 LATER: Add command palette commands for favourite templates.
- CMD-005 LATER: Allow users to assign hotkeys to AI Draft Bench commands.

## 12. Fun and personality ideas

Goal: keep AI Draft Bench practical, but allow a few tiny optional touches that make it feel playful and memorable.

- FUN-001 LATER: Add a glitter button that sprays glitter over the plugin UI.
    - This should be a harmless visual flourish, not part of the core writing workflow.
    - Keep the effect scoped to AI Draft Bench UI so it does not escape into the whole vault like a tiny sparkly menace.
    - Consider a reduced-motion fallback before doing anything too dramatic.
    - The button should probably not explain itself too much. A little mystery is part of the charm.
- FUN-002 LATER: Add a playful fox easter egg to the settings page.
    - Add a small fox icon somewhere subtle in the settings UI.
    - When clicked, show a tiny animated fox briefly playing, spinning, peeking, or carrying a little note.
    - Keep it lightweight and non-blocking so it does not interfere with real settings work.
    - Possible future idea: the fox occasionally carries a tiny dev note such as “scope your CSS, darling” and then vanishes.
    - This should stay optional in spirit, but not become a whole mascot system before the MVP is stable.

## 13. Settings
- SET-001 TODO: Debounce settings saves for text inputs

## 14. Documentation
- DOC-001 DONE: Update README to match current real-provider MVP state
=======
- `APS-023` Improve provider error messages in the panel.
- `APS-024` Enforce configured request timeout for OpenAI-compatible requests.
- `TMP-020` Move template editing and built-in copying into modals.
- `TMP-021` Show a no-change result for replacement-only templates when the AI output matches the selected text.
- `CTX-019` Add persistent draft bench sessions.
- `CODE-014` Move provider model loading out of main plugin class.
>>>>>>> 562ef1487f9358b8146204d0ade88cecfa1e3340
