# Memory

Goal: Build a local memory system so AI Draft Bench can act like a writing buddy without sending the whole session or whole chapter to the model on every request.

Memory must be local first. The saved conversation, session history, summaries, decisions, and retrieval index should remain inside the Obsidian plugin data or local plugin storage.

The model should only receive a carefully built context package for each request. Never blindly send the full session by default.

## Design principles

1. The saved session is the source of truth.
   AI Draft Bench already stores current and previous sessions. This saved data is the raw memory source.

2. Prompt memory is not the same as saved memory.
   Saved memory can be large. Prompt memory must be small, relevant, and budgeted.

3. Large selected text should reduce history.
   If the user asks about a whole chapter or a large section, the model should receive less chat history, not overflow the context window.

4. Recent conversation matters, but only within budget.
   Include recent turns when they fit, but do not send the whole conversation forever.

5. Explicit reply context beats general memory.
   If the user replies to a specific entry, that entry should outrank older general history.

6. Older history should become summary and retrieval memory.
   Older conversation should be summarised or retrieved selectively rather than always included raw.

7. Generic local providers need local memory.
   LM Studio and Ollama use OpenAI compatible chat completions. They need AI Draft Bench to build and inject memory locally.

8. Provider-side state is optional.
   If a provider supports conversation state, use it later. Do not depend on it for local providers.

## Tasks

### MEM-001 TODO: Add local conversation memory index

Create a local searchable memory index from saved session entries.

First version can use simple keyword and text scoring. Do not start with vector embeddings.

Store memory records with enough metadata to trace them back to the source session and entry.

Suggested record fields:

```ts
id: string;
sessionId: string;
entryId: string;
createdAt: string;
kind: "user-message" | "assistant-response" | "exchange";
text: string;
keywords: string[];
```

### MEM-002 TODO: Build memory records when session entries are saved

When a chat or selection entry is completed, create or update memory records for that entry.

Avoid indexing placeholder responses.

Keep memory indexing separate from rendering and session control.

### MEM-003 TODO: Add simple memory search service

Add a service that searches memory records using the current user request.

First version should use keyword overlap, title words, repeated terms, and simple scoring.

Return only the top few relevant snippets.

### MEM-004 TODO: Add context budget builder

Build a request context package using the configured prompt size limit.

The budget builder decides what can fit before the request is sent.

Priority order:

1. System prompt.
2. Personality prompt if enabled.
3. Current template or instruction.
4. Current user message.
5. Selected text or source text.
6. Explicit reply target.
7. Recent session turns.
8. Retrieved memory snippets.
9. Compact session summary once available.

### MEM-005 TODO: Prevent full session injection by default

Add a rule that full session history is never sent automatically.

Session entries must pass through the memory budget builder before being included in a request.

### MEM-006 TODO: Add retrieved memory snippets to chat requests

For generic OpenAI compatible providers, include selected memory snippets in the prompt.

Retrieved memory should be clearly labelled so the model understands it is previous context, not the current user request.

Example label:

```text
Relevant previous discussion:
...
```

### MEM-007 TODO: Add compact session summary memory

Add a short summary field to each saved session.

The summary should capture important decisions, ongoing writing concerns, character notes, tone preferences, and unresolved questions.

Do not use the summary as a replacement for the raw saved session. Use it as compact prompt memory.

### MEM-008 TODO: Add writing decision log

Store important user decisions separately from the general session summary.

Example decisions:

```text
Keep Bell’s narration lightly noir but not gimmicky.
Avoid one word punchline sentences.
Introduce side characters only when they matter to the scene.
```

### MEM-009 TODO: Add memory rebuild action

Add a command or settings action to rebuild the local memory index from saved sessions.

This is useful if memory format changes or old sessions were created before indexing existed.

### MEM-010 TODO: Upgrade memory index with embeddings later

Add vector search only after the simple memory index and budget builder are working.

Use embeddings to retrieve semantically similar old conversation entries.

This should improve recall when the user asks about something using different wording.

### MEM-011 TODO: Add memory debug view

Add a developer/debug view that shows what memory was included in the last AI request.

This should help diagnose why the model remembered or forgot something.

Show:

```text
selected text included
reply context included
recent turns included
retrieved memory snippets
summary included
total estimated prompt characters
```

## Relationship to existing context tasks

CTX-026 should use the context budget builder to trim session history before sending AI requests.

CTX-027 should ensure explicit reply context outranks general history and retrieved memory.

CTX-028 should create compact summary memory for older history.

CTX-030 should use trimmed local memory for LM Studio, Ollama, and generic chat completions providers.

CTX-029 should remain provider-side state support for providers that support it. This is optional and should not be required for local memory.