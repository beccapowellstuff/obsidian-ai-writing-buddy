# AI Writing Buddy

AI Writing Buddy is an experimental Obsidian writing assistant plugin for drafting, rewriting, reviewing, and safely applying AI-generated text to notes.

The main idea is simple: select text, ask AI to work with it, review the result in a side panel, then choose whether to copy it, insert it, or replace the original selection. The plugin is designed to keep the user in control instead of silently changing note content.

## Current status

AI Writing Buddy is in active development. It now supports both mock responses for development and OpenAI-compatible providers for real AI requests.

Current features include:

- A side panel for reviewing AI responses before using them.
- General chat from the side panel.
- Selected-text prompts from the editor right-click menu.
- Reusable prompt templates for selected text.
- Built-in templates for common writing tasks.
- User-created custom templates.
- Copying built-in templates into editable user templates.
- Per-template settings such as temperature.
- Optional personality prompt support.
- OpenAI-compatible provider support for tools such as LM Studio and Ollama.
- Model list loading from the configured provider.
- A provider connection test button.
- Safe note actions: copy response, replace original selection, and insert after original selection.
- Selection validation before replacing or inserting, so changed source text is not overwritten blindly.
- Optional changed-word highlighting for replacement-style responses.

This is still not ready for general release. Some areas are still being refined, especially provider error handling, context limits, command palette support, and the template settings UX.

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

## Templates

Templates are reusable instructions for selected text.

Built-in templates currently include:

- Fix spelling and grammar.
- Make clearer.
- Summarise.
- Critique.
- Continue writing.
- Rewrite in same voice.

Templates can control whether the response is intended to be replacement text only, whether changed words should be highlighted, and what temperature should be used for the request.

User templates can be created in settings. Built-in templates can also be copied into user templates so they can be edited without changing the built-in source templates.

The current template settings page works, but it is visually large. A future task will move template editing and built-in copying into modals to make the settings page easier to use.

## Provider setup

AI Writing Buddy can use either the mock provider or an OpenAI-compatible provider.

To configure a real provider:

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

## Safe note editing

AI Writing Buddy should never silently overwrite note content.

When you ask AI about selected text, the plugin stores the source note path, the selected text, and the selection position. Before replacing or inserting later, it checks that the original selected text still matches the note. If the note changed, the edit is cancelled and a warning is shown.

This does not replace proper version control or backups, but it avoids the most obvious stale-selection mistake.

## Prompt behaviour

The plugin has editable prompt settings for:

- Open chat system prompt.
- Selected-text system prompt.
- Optional personality prompt.

When personality is enabled, the personality prompt is added as style guidance. Templates, selected text, and user instructions are then combined into the request sent to the configured provider.

A full prompt preview is available from selected-text entries in the side panel, so you can inspect what was sent for that request.

## Current limitations

Known limitations include:

- Provider request timeout is configurable, but timeout enforcement still needs to be completed.
- Provider error messages need more detail.
- Context size guarding still needs to be added.
- Command palette and hotkey support are not complete yet.
- Template editing currently happens directly in the settings page and is due for UX cleanup.
- Mobile compatibility has not been fully validated.
- The plugin is still experimental and should be treated as a work in progress.

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

## Project structure

The source code lives under `src/` and is split by responsibility:

```text
src/
  config/       Default settings, prompt templates, plugin display config
  modals/       Obsidian modal UI
  renderers/    Side-panel and response rendering helpers
  services/     Provider, editor menu, prompt, clipboard, and note editing services
  settings/     Settings tab renderers
  styles/       Modular CSS sources bundled into root styles.css
  types/        Shared TypeScript types
  utils/        Small helper functions
  views/        Obsidian view classes
```

The current architecture aims to keep `main.ts` focused on plugin lifecycle and registration, with feature logic delegated into smaller modules.

## Design principles

AI Writing Buddy is being built around a few practical rules:

- Keep note edits explicit.
- Keep AI responses reviewable before applying them.
- Prefer local/OpenAI-compatible providers where possible.
- Keep mock mode available for development.
- Split code into small, readable modules.
- Avoid giant rewrites when small safe changes will do.
- Keep the workflow useful before adding too much polish.

## Privacy notes

AI Writing Buddy sends selected text, chat messages, prompt settings, and template instructions to the configured provider when you make a request.

If you use a local provider, that data is sent to your local server. If you configure a hosted provider, that data is sent to that external service. The plugin should not send note content unless you explicitly ask it to work with selected text or chat context, but provider behaviour depends on the service you configure.

There is no hidden telemetry in the current project.

## Release status

This plugin is not ready for Obsidian community release yet. Before release, the README, package metadata, CSS scoping, provider error handling, timeout behaviour, and mobile/desktop support should be reviewed again.
