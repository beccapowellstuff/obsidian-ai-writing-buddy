# AI Writing Buddy

AI Writing Buddy is an experimental Obsidian writing assistant plugin for drafting, rewriting, reviewing, chatting with notes, and safely applying AI-generated text.

The main idea is simple: select text, ask AI to work with it, review the result in a side panel, then choose whether to copy it, insert it, or replace the original selection. The plugin is designed to keep the user in control instead of silently changing note content.

AI Writing Buddy can also use local RAG context to answer questions about notes without pasting whole notes into every prompt. Context-aware chat retrieves relevant excerpts from indexed note chunks and sends only those retrieved excerpts to the configured AI provider.

## Current status

AI Writing Buddy is in active development. It supports mock responses for development, OpenAI-compatible chat providers for real AI requests, and local RAG context using a sql.js-backed database.

Current features include:

* A side panel for reviewing AI responses before using them.
* General chat from the side panel.
* Context-aware chat for the current note, open notes, and indexed notes.
* Persistent local RAG indexing using a sql.js SQLite database stored inside the plugin folder.
* Semantic RAG using an OpenAI-compatible `/embeddings` endpoint.
* Keyword fallback retrieval when embeddings are not configured or fail.
* Retrieved-context footers showing scope, fallback mode, files, and chunk counts.
* Selected-text prompts from the editor right-click menu.
* Reusable prompt templates for selected text.
* Built-in templates for common writing tasks.
* User-created custom templates.
* Copying built-in templates into editable user templates.
* Per-template settings such as temperature.
* Optional personality prompt support.
* OpenAI-compatible provider support for tools such as LM Studio and Ollama.
* Model list loading from the configured provider.
* A provider connection test button.
* Embedding model loading and embedding connection testing.
* Safe note actions: copy response, replace original selection, and insert after original selection.
* Selection validation before replacing or inserting, so changed source text is not overwritten blindly.
* Optional changed-word highlighting for replacement-style responses.

This is still not ready for general release. Some areas are still being refined, especially provider error messages, broader command palette support, mobile validation, RAG indexing controls, and the template settings UX.

## How it works

AI Writing Buddy keeps AI output separate from the note until you explicitly choose what to do with it.

A typical selected-text workflow looks like this:

1. Highlight text in an Obsidian note.
2. Right click the selected text.
3. Choose **Ask AI about selection**.
4. Choose a template, or leave the template blank and write your own instruction.
5. Add any extra instruction if needed.
6. Press **Ask**.
7. Review the response in the AI Writing Buddy side panel.
8. Choose whether to copy the response, reply to it, replace the original selection, or insert the response after the selection.

For general chat, open the AI Writing Buddy side panel with the ribbon icon and type into the chat box at the bottom of the panel.

When **Context** is enabled in the side panel, chat can use note context without requiring selected text. The plugin indexes relevant Markdown notes into local chunks, retrieves the most relevant chunks for the current question, and adds only those retrieved excerpts to the prompt.

## RAG note context

AI Writing Buddy includes a local RAG system for note-aware chat.

RAG stands for retrieval-augmented generation. In this plugin, that means note content is split into chunks, indexed locally, searched when you ask a question, and then only the most relevant retrieved excerpts are sent to the AI provider.

This is different from simply pasting a whole note into the prompt. The plugin is intended to avoid silent whole-note prompt injection during context-aware chat.

### Context scopes

The side panel includes a **Context** checkbox and a context scope selector.

Available context modes include:

* **Current note**: indexes and searches the active Markdown note.
* **Open notes**: indexes and searches open Markdown notes, ignoring non-Markdown tabs and de-duplicating files by path.
* **Indexed notes**: searches notes that already exist in the local RAG index.

Depending on the current UI settings, indexed RAG context may also be included alongside the selected note scope.

### How RAG storage works

The RAG index is stored locally inside the plugin folder using a sql.js-backed SQLite database.

The runtime database path is:

```text
.obsidian/plugins/<manifest.id>/rag-index/embeddings.db
```

The plugin does not ship with a prebuilt RAG database. The database is created on demand when RAG indexing/search is first used.

The generated `rag-index/` folder is ignored by Git and should not be committed.

The database stores indexed file metadata and chunk records, including:

* note path
* note title
* file hash
* chunk text
* chunk index
* heading path
* line range
* retrieval mode
* embedding model and vector dimension when embeddings are available
* embedding vectors when semantic RAG is used

If a note changes, the file hash changes, and the plugin replaces only that file’s index records rather than rebuilding everything.

### Semantic RAG and keyword fallback

Semantic RAG requires an OpenAI-compatible `/embeddings` endpoint.

Embedding settings include:

* embedding server address
* embedding model
* optional embedding secret key
* embedding connection test

The embedding server address and key can fall back to the main chat provider settings when left blank.

If embeddings are not configured or an embedding request fails, the plugin stores and searches chunks using keyword fallback instead. Keyword fallback is deliberately labelled as keyword fallback in the used-context footer so it is not confused with semantic retrieval.

### Prompt behaviour with RAG

When context-aware chat uses RAG, the prompt receives retrieved excerpts, not full notes.

Each retrieved source includes information such as:

* file path
* heading path
* line range
* chunk index
* retrieved text
* retrieval mode
* chunks used versus total chunks

The prompt tells the model to use only the retrieved excerpts as evidence. If the retrieved context is insufficient, the model should say so rather than pretending it read the rest of the note.

## Templates

Templates are reusable instructions for selected text.

Built-in templates currently include:

* Fix spelling and grammar.
* Make clearer.
* Summarise.
* Critique.
* Continue writing.
* Rewrite in same voice.

Templates can control whether the response is intended to be replacement text only, whether changed words should be highlighted, and what temperature should be used for the request.

User templates can be created in settings. Built-in templates can also be copied into user templates so they can be edited without changing the built-in source templates.

The current template settings page works, but it is visually large. A future task may move template editing and built-in copying into modals to make the settings page easier to use.

## Provider setup

AI Writing Buddy can use either the mock provider or an OpenAI-compatible provider.

To configure a real chat provider:

1. Open **Settings → AI Writing Buddy**.
2. Set **Provider** to **Compatible provider**.
3. Set **Server address** to your provider base URL.
4. Set **Secret key** if your provider requires one.
5. Press **Load models** to fetch available models.
6. Choose or enter a model.
7. Press **Test connection**.

For local tools, the server address depends on the tool and how it is configured. For example, LM Studio commonly uses an OpenAI-compatible local server URL similar to:

```text
http://localhost:1234/v1
```

Ollama and other local servers may use different OpenAI-compatible endpoints depending on setup.

The mock provider remains useful while developing UI behaviour because it does not require a running model server.

## Embedding setup for RAG

Semantic RAG requires an embedding model.

To configure embeddings:

1. Open **Settings → AI Writing Buddy**.
2. Find the **RAG context** settings.
3. Set **Embedding server address**, or leave it blank to use the main chat server address.
4. Set **Embedding model**.
5. Set **Embedding secret key** if needed, or leave it blank to use the main chat secret key.
6. Press **Test embedding connection**.

If the embedding model is left blank, context can still use keyword fallback, but semantic retrieval will not be available.

## Safe note editing

AI Writing Buddy should never silently overwrite note content.

When you ask AI about selected text, the plugin stores the source note path, the selected text, and the selection position. Before replacing or inserting later, it checks that the original selected text still matches the note. If the note changed, the edit is cancelled and a warning is shown.

This does not replace proper version control or backups, but it avoids the most obvious stale-selection mistake.

RAG context does not modify note files. It reads Markdown note content, creates local index records, retrieves relevant chunks for chat, and leaves the note content itself unchanged.

## Prompt behaviour

The plugin has editable prompt settings for:

* Open chat system prompt.
* Selected-text system prompt.
* Optional personality prompt.

When personality is enabled, the personality prompt is added as style guidance. Templates, selected text, retrieved note context, recent chat history, and user instructions are then combined into the request sent to the configured provider.

A full prompt preview is available from selected-text entries in the side panel, so you can inspect what was sent for that request.

For context-aware chat, the prompt includes retrieved note excerpts only. It also includes rules telling the model not to claim that it has read omitted note sections.

## Current limitations

Known limitations include:

* The plugin is still experimental and should be treated as a work in progress.
* RAG currently searches indexed chunks, not a fully automatic always-on vault-wide index.
* Indexed notes are limited to notes that have already been indexed through RAG use.
* Very broad questions may still require careful testing because retrieval can miss relevant chunks if the question is vague.
* Keyword fallback is useful, but it is not the same as semantic embedding search.
* Provider error messages need more detail.
* Command palette and hotkey support are not complete yet.
* Template editing currently happens directly in the settings page and is due for UX cleanup.
* Mobile compatibility has not been fully validated.
* The RAG database is written through sql.js and should be treated as local plugin data, not as a human-edited file.

See `TASKS.md` for the current build plan.

## Development setup

Install dependencies:

```bash
npm install
```

Start the development watcher:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

Run the TypeScript check used during development:

```bash
npx tsc --noEmit --skipLibCheck --pretty false
```

## Deploying to an Obsidian vault

This project includes a deploy script:

```bash
npm run deploy
```

The deploy script copies the built plugin files into the configured Obsidian vault plugin folder.

The expected plugin files are:

```text
main.js
manifest.json
styles.css
```

The build generates both `main.js` and `styles.css` at the plugin root. Project stylesheet changes belong in `src/styles/`. The generated `styles.css` is intentionally left readable so an installed copy can be locally adjusted in a vault; running the build or redeploying replaces those local output-file edits.

After deploying, reload the plugin in Obsidian. During development, this usually means disabling and re-enabling **AI Writing Buddy** under **Settings → Community plugins**. Sometimes closing and reopening the side panel is also useful after UI changes.

The RAG database is not part of the deployed plugin bundle. It is created at runtime inside the installed plugin folder when RAG is first used.

## Project structure

The source code lives under `src/` and is split by responsibility:

```text
src/
  config/       Default settings, prompt templates, plugin display config
  controllers/  Session and workflow controllers
  modals/       Obsidian modal UI
  renderers/    Side-panel and response rendering helpers
  services/     Provider, prompt, RAG, clipboard, and note editing services
  settings/     Settings tab renderers
  styles/       Modular CSS sources bundled into root styles.css
  types/        Shared TypeScript types
  utils/        Small helper functions
  views/        Obsidian view classes
```

The current architecture aims to keep `main.ts` focused on plugin lifecycle and registration, with feature logic delegated into smaller modules.

## Design principles

AI Writing Buddy is being built around a few practical rules:

* Keep note edits explicit.
* Keep AI responses reviewable before applying them.
* Prefer local/OpenAI-compatible providers where possible.
* Avoid sending whole notes when retrieved excerpts are enough.
* Clearly label fallback behaviour.
* Keep mock mode available for development.
* Split code into small, readable modules.
* Avoid giant rewrites when small safe changes will do.
* Keep the workflow useful before adding too much polish.

## Privacy notes

AI Writing Buddy sends selected text, chat messages, prompt settings, template instructions, and retrieved note excerpts to the configured provider when you make a request.

If you use a local provider, that data is sent to your local server. If you configure a hosted provider, that data is sent to that external service.

RAG indexing stores note chunks and embeddings locally in the plugin folder. The local RAG database is created at:

```text
.obsidian/plugins/<manifest.id>/rag-index/embeddings.db
```

The plugin should not send note content unless you explicitly ask it to work with selected text or enable/use chat context. Provider behaviour depends on the service you configure.

There is no hidden telemetry in the current project.

## Release status

This plugin is not ready for Obsidian community release yet. Before release, the README, package metadata, CSS scoping, provider error handling, RAG UX, timeout behaviour, and mobile/desktop support should be reviewed again.

## Development tools and licences

AI Writing Buddy uses open-source tools and libraries. Thank you to the people who build useful things and release them under permissive licences.

Notable RAG-related dependencies include:

* [`@webreflection/sql.js`](https://github.com/WebReflection/sql.js), an MIT-licensed ESM repackaging of sql.js that helps with the WASM bundling used by this plugin.
