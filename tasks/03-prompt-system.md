# Prompt system

Goal: build AI requests from clear prompt parts instead of raw user text only.

## Prompt builder

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

## Open chat prompt

- OCP-001 DONE: Add editable open chat system prompt setting.
- OCP-002 TODO: Add reset-to-default button.
- OCP-003 TODO: Use open chat system prompt for general chat entries.
- OCP-004 TODO: Keep open chat prompt separate from selected-text templates.

## Selected-text prompt

- STP-001 DONE: Add basic freeform instruction prompt for selected text.
- STP-002 DONE: Add editable selected-text system prompt setting.
- STP-003 TODO: Use selected text as explicit source context.
- STP-004 TODO: Make sure the AI understands it must respond to the selected text, not overwrite it automatically.
- STP-005 TODO: Add clear instruction formatting for selected-text requests.
- STP-006 TODO: Keep selected text, user instruction, and template prompt separate in the request model.

## Personality prompt

- PER-001 DONE: Add personality prompt setting.
- PER-002 DONE: Add personality enabled toggle.
- PER-003 TODO: Add reset-to-default button.
- PER-004 TODO: Apply personality prompt to open chat and drafting requests when enabled.
- PER-005 TODO: Make personality prompt clearly separate from task templates.
- PER-006 LATER: Add simple personality presets such as Neutral, Friendly editor, Strict editor, and Creative partner.
