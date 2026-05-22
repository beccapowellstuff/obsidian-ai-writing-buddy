# AI Draft Bench Memory Planning Notes

Purpose: collect the current thinking about memory for AI Draft Bench so a new chat can continue from a clean starting point.

## Core problem

AI Draft Bench is meant to feel like a writing buddy. A user may paste or select a whole chapter, talk through it, ask for revisions, build decisions over time, and expect the assistant to remember what was discussed.

A local model with a smaller context window, for example around 8,500 tokens, cannot safely receive all of this on every request:

- the full chapter
- the full chat history
- all previous decisions
- selected text
- system prompt
- personality prompt
- template prompt
- current user message

If the plugin simply sends the full saved session every time, large writing sessions will break, slow down, or lose useful context.

The plugin needs to become the memory manager.

## Important distinction

Saving memory and prompt memory are not the same thing.

AI Draft Bench already saves conversations locally:

- `currentSession.entries`
- `savedSessions[]`

That saved data is the raw archive. It is the cupboard.

The model should not receive the whole cupboard. It should receive a carefully packed context package for each request.

The job is to decide what small amount of saved information should be placed into the prompt.

## Current problem example

The user asked:

> what did you last say?

The assistant replied as if it was the first interaction in the session.

That happened because the conversation existed in the plugin data, but the relevant previous turns were not included in the AI request.

The model only knows what is sent in the current request.

## Easiest baseline memory

The first useful memory system does not need vector DB or RAG.

The easiest baseline is:

- include the last few session entries in each chat request
- cap the included history by a character budget
- never send the whole session by default

Example settings:

```ts
memoryEnabled: boolean;
memoryBudgetCharacters: number;
recentHistoryMaxEntries: number;
```

Example defaults could be:

```ts
memoryEnabled: true;
memoryBudgetCharacters: 6000;
recentHistoryMaxEntries: 6;
```

This would fix the simple “what did you last say?” case because the model would receive something like:

```text
Recent conversation:
User: ...
Assistant: ...

Current user message:
what did you last say?
```

## Context budget rule

Memory must be budgeted per request.

Large selected text should reduce the amount of chat history included.

For example, if a user selects a large chapter section, most of the available prompt space should go to that selected text. Recent chat and retrieved memory should shrink or disappear rather than overflowing the model.

A request should never blindly include the whole saved session.

## Layered memory model

The desired architecture is layered memory.

### 1. Current request

Always include the current user request.

### 2. System and behaviour prompts

Include the system prompt, template prompt, and personality prompt where relevant.

### 3. Selected or source text

If the user is working on selected text or source note text, that should be high priority.

### 4. Explicit reply context

If the user clicked reply on a specific entry, that entry should outrank general memory.

### 5. Recent conversation

Include the last few useful turns within budget.

### 6. Session summary

Older history can later be compressed into a compact summary.

This summary should include:

- important writing decisions
- tone preferences
- unresolved questions
- character notes
- plot decisions
- user preferences for the current writing project

### 7. Decision log

Decisions should be stored separately from fuzzy summaries.

Example decisions:

```text
Keep Bell’s narration lightly noir but not gimmicky.
Avoid one-word punchline sentences.
Introduce side characters only when they matter to the scene.
```

### 8. Retrieved memory

Older conversation entries can be searched and retrieved when relevant.

This can start with simple keyword search and later become vector/RAG memory.

## RAG and vector DB explanation

RAG means:

> retrieve relevant stored information, then inject a small amount of it into the prompt.

A vector DB is one possible way to do the retrieval part.

The stack is:

```text
Saved conversations = raw memory
Memory index/database = searchable memory
Vector DB = semantic search over that memory
RAG = retrieve relevant memories and add them to the AI request
```

The model does not usually search the DB directly. The plugin acts as the librarian.

Flow:

```text
User asks a new question
Plugin embeds or searches the question
Plugin searches local memory
Plugin retrieves top relevant snippets
Plugin builds a small context package
Plugin sends that package to the chat model
Model replies
Plugin stores the new exchange
Plugin indexes the new exchange for future retrieval
```

The key principle:

```text
The DB remembers.
The retriever finds.
The budget builder chooses.
The prompt builder explains.
The model answers.
```

## How vector memory would work

Every memory chunk gets turned into an embedding. That embedding is a list of numbers representing the meaning of the text.

Example memory chunks:

```text
Bell’s narration should stay lightly noir but not gimmicky.
We decided to avoid one-word punchline sentences.
Chapter 3 needs to introduce Dot later, not all at once.
```

When the user later asks:

```text
What did we decide about Bell’s voice?
```

The plugin embeds the question, compares it against stored memory embeddings, and retrieves the closest matches.

It might find “Bell’s narration” even though the user said “Bell’s voice”, because vector search can match semantic similarity.

Then the prompt can include:

```text
Relevant previous discussion:
- Bell’s narration should stay lightly noir but not gimmicky.
- Avoid one-word punchline sentences.

Current user request:
What did we decide about Bell’s voice?
```

## Guardrails for retrieval memory

Retrieved memory should be controlled.

Use:

- top K results
- similarity threshold
- metadata filters
- session or project preference
- chunk size limits
- prompt budget limits
- clear labels in the prompt

Recommended search priority:

```text
1. Current session memory
2. Other sessions from the same source note/file
3. Older saved sessions
4. Later, wider project/vault memory
```

This avoids dragging random unrelated memories into the prompt.

## Private AI Chat comparison

Private AI Chat is useful as a reference, but it should not be copied blindly.

Useful ideas from Private AI Chat:

- local-first LM Studio usage
- separate chat endpoint and embedding endpoint
- RAG over Obsidian notes
- settings for max results, thresholds, and context percentage
- retrieval before prompt injection
- local vector database for indexed chunks

Important warning:

Its chat history appears to be passed through as conversation history. That is simple, but risky for long writing sessions if not trimmed.

AI Draft Bench should be more careful.

The useful pattern to copy is:

```text
Retrieve relevant context.
Format it clearly.
Inject only what fits.
```

Not:

```text
Send the entire chat forever.
```

## Embedding endpoint

In Private AI Chat, the embedding endpoint and model are for building searchable vectors.

Example:

```text
Chat endpoint:
http://localhost:1234/v1/chat/completions

Embedding endpoint:
http://localhost:1234/v1/embeddings

Chat model:
writing/chat model

Embedding model:
text-embedding-nomic-embed-text-v1.5 or similar
```

The embedding model does not write the reply. It helps search memory by meaning.

The chat model receives the retrieved snippets and writes the answer.

## Proposed staged implementation

Do not try to build everything at once.

### Stage 1: baseline recent memory

Goal: stop the model acting like every chat is the first message.

Implementation:

- add memory settings
- pass recent session entries into chat requests
- trim by `memoryBudgetCharacters`
- limit by `recentHistoryMaxEntries`
- do not include full session history

This aligns with `CTX-026`.

### Stage 2: context budget builder

Create a proper budget builder that decides what fits before sending the request.

Priority order:

```text
1. System prompt
2. Personality prompt if enabled
3. Template or instruction
4. Current user message
5. Selected text/source text
6. Explicit reply target
7. Recent session turns
8. Retrieved memory snippets
9. Compact session summary once available
```

### Stage 3: explicit reply priority

If the user replies to a specific entry, that specific entry should beat general recent history.

This aligns with `CTX-027`.

### Stage 4: local trimmed history for LM Studio/Ollama

Use the budget builder to send local memory to generic chat-completions providers.

This aligns with `CTX-030`.

### Stage 5: compact session summary

Add summaries for older session history.

This aligns with `CTX-028`.

### Stage 6: local searchable memory index

Add a local memory index over saved session entries.

First version can use simple keyword/text scoring.

Possible memory record shape:

```ts
id: string;
sessionId: string;
entryId: string;
createdAt: string;
kind: "user-message" | "assistant-response" | "exchange";
text: string;
keywords: string[];
```

### Stage 7: vector/RAG memory

Upgrade the local memory index with embeddings.

Possible memory record shape:

```ts
id: string;
sessionId: string;
entryId: string;
createdAt: string;
kind: "exchange";
userText: string;
assistantText: string;
searchableText: string;
embedding: number[];
```

### Stage 8: debug view

Add a debug view to show what memory was included in the last request.

Show:

```text
selected text included
reply context included
recent turns included
retrieved memory snippets
summary included
total estimated prompt characters
```

## Relationship to existing tasks

Existing tasks:

```text
CTX-026 TODO: Trim session history before sending AI requests
CTX-027 TODO: Prioritise explicit reply context over general session history
CTX-028 TODO: Add compact session summary for older history
CTX-029 TODO: Use provider-side conversation state when supported
CTX-030 TODO: Fall back to trimmed local history for generic chat-completions provider
```

Recommended immediate focus:

```text
CTX-026: baseline recent memory plus trimming
CTX-027: explicit reply priority
CTX-030: use trimmed local history with LM Studio/OpenAI-compatible providers
CTX-028: compact summaries
CTX-029: later, for providers that actually support provider-side state
```

Suggested new Memory task section:

```text
MEM-001 Add memory settings
MEM-002 Add recent session memory to chat requests
MEM-003 Add context budget builder
MEM-004 Prevent full session injection by default
MEM-005 Add simple conversation memory index
MEM-006 Add memory search service
MEM-007 Add retrieved memory snippets to chat requests
MEM-008 Add compact session summary memory
MEM-009 Add writing decision log
MEM-010 Add memory rebuild action
MEM-011 Upgrade memory index with embeddings
MEM-012 Add memory debug view
```

## Suggested baseline design for next chat

Start with the simplest useful memory:

```text
Use saved session entries.
Include recent entries in chat requests.
Trim by character budget.
Expose memory settings.
Do not include full sessions.
Do not start with vector DB.
```

This gives immediate practical memory without creating a large architecture swamp.

Then move toward searchable/RAG memory once the baseline context builder exists.

## Possible working name note

The phrase “writing buddy” came up because the plugin’s intended behaviour is more than a draft bench. It should support an ongoing writing conversation, remember decisions, help with chapters, and work across longer creative sessions.

Potential future naming direction:

```text
AI Writing Buddy
Writing Buddy
Draft Buddy
Obsidian Writing Buddy
```

This is only a naming thought, not a current implementation requirement.
