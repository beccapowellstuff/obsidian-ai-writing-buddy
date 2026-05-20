# TASK LIST

This list tracks completed and upcoming tasks. It is not a full kanban board yet, just a simple way to track the experiment before the plugin becomes public.

# AI Draft Bench Tasks

## 1. AI Integration

- Add real AI integration for chat composer, selection responses, and follow-up replies.
- Settings screen for API/model configuration.
- Add prompt presets such as grammar/spelling fix.
- Ensure grammar/spelling presets return only corrected text with no explanation.
- When prompt presets are added, show the preset name and user-added instruction separately instead of displaying the full template prompt.
- Hide full template prompt behind an expandable debug/details section if needed.
- DONE: Add AI response service interface so mock AI and real AI can use the same view flow.
- DONE: Add mock AI response service for selection responses, general chat, and follow-up replies.
- DONE: Add loading placeholder state while AI responses are being generated.
- DONE: Add fallback error responses when AI response generation fails.

## DONE: 2. Response History And Panel Flow

- DONE: Keep a session history in the side panel instead of replacing the existing panel contents.
- DONE: Refactor the side panel from a single latest request into a scrolling request/response history.
- DONE: Make each history entry keep its own source selection metadata.
- DONE: Add bottom chat composer to the AI Draft Bench panel for general chat without needing selected text. Currently uses mock responses.
- DONE: Add follow-up replies for existing draft entries. Currently uses mock responses.

## 3. Follow-up Chat Behaviour

- DONE: Allow general chat without a selected text source. Currently uses mock responses.
- Continue discussing the last selected text.
- DONE: Show reply context snippets when replying to a previous entry.
- Let the user choose, drag, or select which note context is attached.
- For future general chat entries, only show safe actions such as copy unless a target note or selection exists.
- Keep replace and insert actions only for selection-based entries with saved source metadata.

## 4. Note Editing Actions And Safety

- DONE: Copy response.
- DONE: Replace original selection.
- DONE: Insert response after original selection.
- DONE: Never overwrite note text without explicit user action.
- DONE: Before replacing or inserting, confirm the original selected text still matches the saved selection.
- DONE: If the source text changed, cancel the edit and warn the user.
- DONE: Keep copy as a safe non-editing action that does not modify the note.
- Consider whether “Insert below selection” is different enough from “Insert after selection” to keep as a separate action.
- Diff view.
- Consider a conflict resolution option when the source text has changed, such as showing the old selection, current text, and proposed replacement before allowing any manual override.

## 5. UI And Interaction Polish

- DONE: Use compact icon-only response actions with tooltips.
- DONE: Add ribbon button to open the AI Draft Bench panel.
- DONE: Add shared plugin display config for name, header text, and icons.
- DONE: Add bottom chat composer UI.
- Review the ribbon/tab icon once the plugin identity is clearer.
- Test alternative ribbon and tab icons through `pluginDisplay.ts`.
- DONE: Disable empty chat sends and clear the chat box after sending.
- DONE: Improve disabled chat send button styling and composer spacing.
- DONE: Disable empty chat sends and clear the chat box after sending.
- DONE: Improve disabled chat send button styling and composer spacing.
- DONE: Hide response action buttons while a response is still generating.

## 6. Styling, Theming, And Release Readiness

- Before release, review CSS for Obsidian community plugin readiness:
    - Scope all selectors under `.ai-draft-bench`.
    - Avoid global element selectors.
    - Use Obsidian theme variables instead of hardcoded colours.
    - Test in light mode, dark mode, and narrow side panels.
- Add plugin-scoped CSS variables so users can customise AI Draft Bench styling safely.
- Consider future visual skins such as Default, Soft, Minimal, Paper, and High Contrast.
- Add skin selection later through the settings page.

## 7. Code Structure And Refactors

- DONE: Refactor `SelectionEditService` so replace and insert actions share one selection validation helper.
- DONE: Refactor AI Draft Bench panel opening into a shared service so the ribbon icon and editor menu use the same view-opening logic.
- DONE: Split `AiDraftBenchView` into smaller renderer/helper files now that it handles entries, responses, chat composer, and actions.
- DONE: Keep `styles.css` grouped by UI area and avoid duplicate selectors.
