# UI and interaction polish

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
- UI-010 TODO: Improve session controls with compact icons, clearer labels, and tooltips.
   - Replace session text buttons with icon buttons where sensible.
   - Add clear tooltips for new session, clear current session, and previous sessions.
   - Make the header feel less crowded.
- UI-011 TODO: Add faster selected-text send actions.
   - Add or improve right-click and command palette actions for sending selected text into AI Draft Bench.
   - Consider a later floating “Ask AI” selection button if Obsidian selection handling proves reliable.
   - Keep the first version simple and Obsidian-native.