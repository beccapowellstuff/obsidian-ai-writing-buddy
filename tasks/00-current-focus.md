# Current focus

The current focus is getting the plugin from mock-only behaviour to a configurable MVP.

1. CBF-001 DONE: Add settings model and default settings.
2. CBF-002 DONE: Add settings load/save to the plugin.
3. CBF-003 DONE: Add settings tab UI.
4. CBF-004 DONE: Wire mock provider selection through settings instead of hardcoded mock service.
5. CBF-005 DONE: Add OpenAI-compatible AI response service for chat completions.
6. CBF-006 DONE: Add AI provider connection test.
7. CBF-007 DONE: Improve provider error messages in the panel.
8. CBF-008 DONE: Add prompt builder using settings prompts.
9. CBF-009 DONE: Add template system.
10. CPB-010 DONE: Add prompt/context size guard before sending AI requests.

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
