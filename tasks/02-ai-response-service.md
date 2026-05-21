# AI response service

Goal: keep the panel flow independent from the AI provider implementation.

- AIR-001 DONE: Add AI response service interface so mock AI and real AI can use the same view flow.
- AIR-002 DONE: Add mock AI response service for selection responses, general chat, and follow-up replies.
- AIR-003 DONE: Add loading placeholder state while AI responses are being generated.
- AIR-004 DONE: Add fallback error responses when AI response generation fails.
- AIR-005 DONE: Pass previous entry context into mock follow-up replies.
- AIR-006 DONE: Add OpenAI-compatible chat completion service.
- AIR-007 DONE: Use real provider for general chat.
- AIR-008 DONE: Use real provider for selected-text requests.
- AIR-009 DONE: Use real provider for follow-up replies.
- AIR-010 TODO: Build request payloads consistently for each request type.
- AIR-011 TODO: Handle provider errors without breaking the panel.
- AIR-012 LATER: Replace `isPlaceholder` with clearer response states such as loading, mock, ready, and error.
