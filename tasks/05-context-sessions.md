# Context system and sessions

Goal: let chat and follow-up requests include the right context without sending everything blindly.

- CTX-001 DONE: Keep a session history in the side panel instead of replacing the existing panel contents.
- CTX-002 DONE: Refactor the side panel from a single latest request into a scrolling request/response history.
- CTX-003 DONE: Make each history entry keep its own source selection metadata.
- CTX-004 DONE: Allow general chat without selected text. Currently uses mock responses.
- CTX-005 DONE: Add follow-up replies for existing draft entries. Currently uses mock responses.
- CTX-006 DONE: Show reply context snippets when replying to a previous entry.
- CTX-007 DONE: Refer to a specific previous entry by passing reply context into the AI response service.
- CTX-008 TODO: Define active context behaviour for follow-up chat
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
- CTX-019 TODO: Add persistent draft bench sessions.
  - persistent local sessions stays important.
- CTX-020 TODO: Add new session action.
- CTX-021 TODO: Add session history list.
- CTX-022 TODO: Add saved session metadata.
  - id
  - createdAt
  - updatedAt
  - entryCount
  - optional userTitle
- CTX-023 TODO: Add delete saved session action.
- CTX-024 TODO: Add rename saved session action.
- CTX-025 TODO: Add provider-aware conversation memory strategy
- CTX-026 TODO: Trim session history before sending AI requests
- CTX-027 TODO: Prioritise explicit reply context over general session history
- CTX-028 TODO: Add compact session summary for older history
- CTX-029 TODO: Use provider-side conversation state when supported
- CTX-030 TODO: Fall back to trimmed local history for generic chat-completions providers