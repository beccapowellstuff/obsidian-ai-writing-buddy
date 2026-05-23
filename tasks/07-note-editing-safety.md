# Note editing actions and safety

Goal: make note changes explicit, reversible in spirit, and safe from stale selections.

- SAFE-001 DONE: Copy response.
- SAFE-002 DONE: Replace original selection.
- SAFE-003 DONE: Insert response after original selected text.
- SAFE-004 DONE: Never overwrite note text without explicit user action.
- SAFE-005 DONE: Before replacing or inserting, confirm the original selected text still matches the saved selection.
- SAFE-006 DONE: If the source text changed, cancel the edit and warn the user.
- SAFE-007 DONE: Keep copy as a safe non-editing action that does not modify the note.
- SAFE-008 DONE: Consider whether “Insert below selection” is different enough from “Insert after selection” to keep as a separate action.
- SAFE-009 DONE: Add diff view.

- SAFE-010 TODO: When the source text has changed, show a conflict modal with original selected text, current note text, and proposed replacement, then let the user cancel or overwrite anyway.
