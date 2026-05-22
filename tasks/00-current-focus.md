# Current Focus

Goal: Deliver chat/session management and persistent session memory so AI Draft Bench can remember and continue conversations without relying on huge context windows.

1. PANEL-013 DONE: Add clear current session action
2. CTX-019 DONE: Add persistent draft bench sessions
3. CTX-022 DONE: Add saved session metadata
4. CTX-020 DONE: Add new session action
5. CTX-021 DONE: Add session history list
6. CTX-025 DONE: Add provider-aware conversation memory strategy
8. CTX-030 DONE: Fall back to trimmed local history for generic chat-completions providers
9. CTX-026 DONE: Trim session history before sending AI requests
10. CTX-027 DONE: Prioritise explicit reply context over general session history
   - Clicked reply targets are treated as the main context.
   - Reply target is excluded from generic recent history.
   - Selected-text reply context includes source note, original instruction, selected text, and assistant draft response.
   - Recent session history remains secondary.
11. CTX-028 DONE: Add compact session summary for older history
12. CTX-008: TODO: Define active context behaviour for follow-up chat
13. CTX-029: TODO: Provider-side state later, probably much later