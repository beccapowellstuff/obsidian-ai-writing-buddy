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

6. CTX-025 DONE: Add provider-aware conversation memory strategy
   - Decide how memory works for OpenAI, local providers, and smaller context models.

7. CTX-029 TODO: Use provider-side conversation state when supported
   - Use provider state features where available, but do not require them for generic providers.

8. CTX-030 TODO: Fall back to trimmed local history for generic chat-completions providers
   - Keep LM Studio, Ollama, and other compatible providers working.
    
9. CTX-026 DONE: Trim session history before sending AI requests
   - Includes recent current-session history using proper chat roles.
   - Includes a recent user-message index for recall questions.
   - Capped by memory budget and recent history settings.

1.  CTX-028 TODO: Add compact session summary for older history
   - Keep older context useful without sending the full transcript.

2.  CTX-027 TODO: Prioritise explicit reply context over general session history
   - If the user clicks reply, that specific entry matters most.

3.  CTX-008 TODO: Define active context behaviour for follow-up chat
   - Decide what general chat should treat as the active context.