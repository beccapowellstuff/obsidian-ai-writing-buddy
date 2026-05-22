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
- CTX-019 DONE: Add persistent draft bench sessions.
- CTX-020 DONE: Add new session action.
- CTX-021 DONE: Add session history list.
- CTX-022 DONE: Add saved session metadata.
- CTX-025 DONE: Add provider-aware conversation memory strategy
- CTX-026 DONE: Trim session history before sending AI requests
- CTX-027 DONE: Prioritise explicit reply context over general session history
- CTX-028 DONE: Add compact session summary for older history
- CTX-030 DONE: Fall back to trimmed local history for generic chat-completions providers
- CTX-009 DONE: Decide how much session history to send to the AI.
- CTX-013 DONE: Let follow-up replies include previous entry text and response.

- CTX-008 TODO: Define active context behaviour for follow-up chat
   - Explicit Reply target wins.
   - If there is no explicit Reply target, the latest assistant response is the default follow-up context for vague follow-ups like “why?”, “what does that mean?”, “make it shorter”, or “try again”.
   - If the latest meaningful action was a selected-text draft, that selected-text entry becomes the active context.
   - Recent history and memory summary support the answer, but do not override the active context.
   - The model should not apologise or claim missing context when the relevant item is present in recent history or memory summary.
- CTX-010 TODO: Refactor general chat context into a dedicated context builder service.
- CTX-011 TODO: Refactor selected-text context into a dedicated context builder service.
- CTX-012 TODO: Refactor follow-up reply context into a dedicated context builder service.
- CTX-013 DONE: Let follow-up replies include previous entry text and response.
- CTX-017 TODO: Add context size guard for selected text and follow-up context.
- CTX-018 TODO: Add surrounding note context for selected-text requests.
- CTX-023 TODO: Add delete saved session action.
- CTX-024 TODO: Add rename saved session action.

- CTX-029 LATER: Provider-side state later, probably much later
- CTX-014 LATER: Let the user choose, drag, or select which note context is attached.
- CTX-015 LATER: Allow attaching the current note as context.
- CTX-016 LATER: Allow attaching linked notes or search results as context.