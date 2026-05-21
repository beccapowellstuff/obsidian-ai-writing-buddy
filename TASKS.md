# AI Draft Bench Tasks

This file is the task index for AI Draft Bench.

AI Draft Bench is an Obsidian writing assistant plugin focused on drafting, rewriting, reviewing, and safely applying AI-generated text to notes.

Detailed tasks now live in grouped files under `tasks/` so each area can be edited without turning this file into a giant scroll.

## Task workflow

- Every actionable task has a stable ID.
- Task IDs are globally unique across all task files.
- Future work should anchor to an exact task ID before code changes begin.
- New work should be added to the relevant grouped task file before being treated as part of the plan.
- Completed work should be marked against an existing task ID, not a newly invented task name.
- The current focus should stay short and should be the source of truth for what comes next.

## Task groups

- Current focus and MVP scope: `tasks/00-current-focus.md`
- AI provider and settings: `tasks/01-provider-settings.md`
- AI response service: `tasks/02-ai-response-service.md`
- Prompt system: `tasks/03-prompt-system.md`
- Prompt templates: `tasks/04-prompt-templates.md`
- Context system and sessions: `tasks/05-context-sessions.md`
- Side panel and entry flow: `tasks/06-side-panel.md`
- Note editing actions and safety: `tasks/07-note-editing-safety.md`
- UI and interaction polish: `tasks/08-ui-polish.md`
- Styling, theming, and release readiness: `tasks/09-release-readiness.md`
- Code structure and refactors: `tasks/10-code-structure.md`
- Workflow and accessibility: `tasks/11-workflow-accessibility.md`
- Fun and personality ideas: `tasks/12-fun-ideas.md`
- Settings and documentation: `tasks/13-settings-and-docs.md`

## Recently completed focus

The previous build focus, moving the plugin from mock-only behaviour to a configurable MVP, is now complete.

See `tasks/00-current-focus.md` for the completed focus list.

## Next likely areas

Useful next candidates include:

- `APS-023` Improve provider error messages in the panel.
- `APS-024` Enforce configured request timeout for OpenAI-compatible requests.
- `TMP-020` Move template editing and built-in copying into modals.
- `TMP-021` Show a no-change result for replacement-only templates when the AI output matches the selected text.
- `CTX-019` Add persistent draft bench sessions.
- `CODE-014` Move provider model loading out of main plugin class.
