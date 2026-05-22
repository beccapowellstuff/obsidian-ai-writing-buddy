# Code structure and refactors

Goal: keep the codebase maintainable as the real AI, prompt, and context systems are added.

- CODE-001 DONE: Refactor `SelectionEditService` so replace and insert actions share one selection validation helper.
- CODE-002 DONE: Refactor AI Draft Bench panel opening into a shared service so the ribbon icon and editor menu use the same view-opening logic.
- CODE-003 DONE: Split `AiDraftBenchView` into smaller renderer/helper files now that it handles entries, responses, chat composer, and actions.
- CODE-004 DONE: Keep `styles.css` grouped by UI area and avoid duplicate selectors.
- CODE-005 TODO: Add settings service or settings helpers if `main.ts` starts carrying too much settings logic.
- CODE-006 TODO: Add prompt builder service before real AI integration becomes messy.
- CODE-007 TODO: Add context builder service before follow-up/chat context becomes messy.
- CODE-008 DONE: Split template settings rendering out of AiDraftBenchSettingTab.
- CODE-009 DONE: Split provider and prompt settings rendering out of AiDraftBenchSettingTab.
- CODE-010 DONE: Split DraftBenchEntryRenderer into smaller response/source/diff renderers.
  - DraftBenchEntryRenderer.ts
  - DraftBenchSourcePanelRenderer.ts
  - DraftBenchResponseRenderer.ts
  - ResponseDiffRenderer.ts
- CODE-011 DONE: Move side-panel session flow out of AiDraftBenchView.
  - AiDraftBenchView.ts
  - DraftBenchSessionController.ts
  - DraftBenchScrollService.ts
- CODE-012 TODO: Move side-panel session state into DraftBenchSessionController.
- CODE-013 TODO: Keep AiDraftBenchView focused on layout and rendering orchestration.
- CODE-014 TODO: Move provider model loading out of main plugin class.
- CODE-015 TODO: Add selected-text request factory.
- CODE-016 TODO: Review duplicate built-in continuation templates.
- CODE-017 DONE: Add standing rule to split busy files before they become large refactors.
- CODE-018 DONE: Split TASKS.md into grouped task files.
- CODE-019 TODO: Split AiDraftBenchView header/session actions into smaller renderer or controller helpers
- CODE-020 TODO: Move plugin data persistence and session upgrade logic out of main.ts