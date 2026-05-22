# Current Focus

Goal: Deliver chat/session management and persistent session memory so AI Draft Bench can remember and continue conversations without relying on huge context windows.

1. PANEL-013 DONE: Add clear current session action
   - Let the user reset the current bench back to an empty/default state without closing Obsidian.
   - Confirm before clearing if the session has entries.

2. CTX-019 DONE: Add persistent draft bench sessions
   - Store sessions properly in plugin data.

3. CTX-022 DONE: Add saved session metadata
   - Include id, createdAt, updatedAt, entryCount, and optional userTitle.

4. CTX-020 DONE: Add new session action
   - Allow the user to intentionally start fresh.

5. CTX-021 DONE: Add session history list
   - Allow the user to return to previous sessions.

6. CTX-025 TODO: Add provider-aware conversation memory strategy
   - Decide how memory works for OpenAI, local providers, and smaller context models.

---
# CTX-025 Provider-aware conversation memory strategy

Goal: Define how AI Draft Bench remembers conversations across different provider types without assuming every model has a huge context window.

## Preferred mode: provider-stateful memory

Use provider-native conversation state where the selected provider supports it.

For OpenAI, prefer the Responses API state model, storing provider response/conversation state against the local AI Draft Bench session.

The local session remains the source of truth for the user interface, but provider state is used to continue the conversation without manually rebuilding the whole transcript every time.

## Local/generic mode: trimmed local memory

For LM Studio, Ollama, and generic OpenAI-compatible chat-completions providers, use local saved session data.

Do not send the full session forever.

Use a provider-aware memory budget and send only the most useful context:
- the current user message
- explicit reply target, if any
- selected text/source context, if any
- recent relevant turns
- compact summary, later
- never blindly attach the whole session
Explicit reply context should beat general session history.

## Provider support expectations

OpenAI:
- preferred stateful mode
- store provider state on the local session
- later support conversation/response IDs

LM Studio:
- use OpenAI-compatible chat-completions mode for now
- use trimmed local memory
- respect smaller context settings

Ollama:
- later provider mode
- likely trimmed local memory first
- avoid assuming OpenAI Responses API support

## Design rule

Provider-native state is preferred when available.
Trimmed local history is the fallback, not the ideal main design.
Small-context models must get less context, not worse behaviour.

memoryMode?: "provider-stateful" | "local-trimmed";

### Follow-on implementation tasks

- CTX-026 trims session history before sending AI requests.
- CTX-027 prioritises explicit reply context over general session history.
- CTX-028 adds compact session summary for older history.
- CTX-029 uses provider-side conversation state when supported.
- CTX-030 falls back to trimmed local history for generic chat-completions providers.

providerState?: {
	provider: "openai";
	apiMode: "responses";
	lastResponseId?: string;
	conversationId?: string;
};

memorySummary?: {
	text: string;
	updatedAt: string;
	sourceEntryId?: string;
};

---

7. CTX-029 TODO: Use provider-side conversation state when supported
   - Use provider state features where available, but do not require them for generic providers.

8. CTX-030 TODO: Fall back to trimmed local history for generic chat-completions providers
   - Keep LM Studio, Ollama, and other compatible providers working.

9. CTX-026 TODO: Trim session history before sending AI requests
   - Avoid burning context on unnecessary older messages.

10. CTX-028 TODO: Add compact session summary for older history
   - Keep older context useful without sending the full transcript.

11. CTX-027 TODO: Prioritise explicit reply context over general session history
   - If the user clicks reply, that specific entry matters most.

12. CTX-008 TODO: Define active context behaviour for follow-up chat
   - Decide what general chat should treat as the active context.