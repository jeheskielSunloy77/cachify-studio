# Story 6.2: Global Shortcut to Focus Search

Status: review

Generated: 2026-02-14
Story Key: `6-2-global-shortcut-to-focus-search`

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a cache user,
I want a global keyboard shortcut to bring the app forward and focus search,
so that I can jump in and find keys immediately.

## Acceptance Criteria

1. **Given** the app is running in the background
   **When** I trigger the global shortcut
   **Then** the app comes to the foreground and focuses the search field (FR45).

## Tasks / Subtasks

- [x] Add main-process global shortcut lifecycle integration (AC: 1)
  - [x] Register one global shortcut only after `app.whenReady()`.
  - [x] Keep a single source of truth for accelerator string (default `CommandOrControl+Shift+K`).
  - [x] Unregister shortcut on quit to avoid stale registrations.
- [x] Implement shortcut action to surface and focus app window (AC: 1)
  - [x] Reuse existing main window instance when available; restore/show/focus in the right order.
  - [x] If no window exists, create one and then focus.
  - [x] Handle registration failure/collision with clear logging and non-crashing fallback.
- [x] Add main-to-renderer focus-search signal via typed contract (AC: 1)
  - [x] Add a dedicated event channel in `src/shared/ipc/ipc.contract.ts` for focus search.
  - [x] Emit event from main after shortcut callback confirms window is available.
  - [x] Expose subscription helper in preload API.
- [x] Focus Explorer search input in renderer (AC: 1)
  - [x] In `RedisExplorerPanel`, subscribe to focus-search event and focus `#redis-key-search` input.
  - [x] Keep behavior safe if input is not mounted (no throw, no UI freeze).
  - [x] Preserve existing keyboard and state behavior.
- [x] Add tests for lifecycle, callback behavior, and renderer focus handoff (AC: 1)
  - [x] Main tests for register/unregister and callback execution path.
  - [x] Main tests for callback when no window exists and when window is minimized/hidden.
  - [x] Renderer test validates focus moves to `redis-key-search` on event.

## Dev Notes

### Developer Context

This story is the second execution story in Epic 6 (desktop productivity). Story 6.1 established tray entry points and safety indicator context. Story 6.2 adds a keyboard-first re-entry path for fast investigations and must preserve the same trust-first posture and process-boundary rules.

Primary objective: implement a robust main-process global shortcut that reliably foregrounds the app and transfers focus to the explorer search field without introducing ad-hoc channels or brittle window logic.

### Technical Requirements

- Global shortcut registration is main-process only (`electron.globalShortcut`) and must happen after app readiness.
- Use a deterministic accelerator default (`CommandOrControl+Shift+K`) for v1 in code; per-user customization is deferred to Story 6.3 (local preferences storage).
- Callback behavior:
  - resolve target BrowserWindow,
  - if minimized, restore,
  - show and focus window,
  - emit typed event to renderer to focus the search input.
- Maintain typed IPC/event boundary through `src/shared/ipc/ipc.contract.ts` + `src/preload/api.ts`; avoid direct renderer access from main internals.
- Renderer focus handler must be idempotent and null-safe (no-op if element unavailable).
- Linux/Wayland guardrail: include compatibility note and safe fallback if registration is unavailable on host session.

### Architecture Compliance

- Preserve process boundaries:
  - `src/main/*` owns globalShortcut lifecycle and window orchestration.
  - `src/preload/*` exposes typed event subscription bridge only.
  - `src/renderer/*` handles input focus behavior only.
- Keep contract-first IPC/event pattern:
  - define channel and payload schema in shared contract,
  - wire through preload API,
  - emit from main via existing BrowserWindow/webContents event pattern.
- No persistence changes are required in this story.

### Library / Framework Requirements

Latest checks completed on 2026-02-14:
- `electron`: latest `40.4.1` (project `40.2.1`)
- `@electron-forge/cli`: latest `7.11.1` (project aligned)
- `react`: latest `19.2.4` (project `19.2.0`)
- `zod`: latest `4.3.6` (project `4.1.5`)

Official Electron guidance to follow:
- Register global shortcuts only after app ready and unregister them on shutdown.
- Shortcut registration can fail when accelerator is already claimed by another app.
- Wayland sessions may require enabling Chromium `GlobalShortcutsPortal` for consistent behavior.

No dependency upgrade is required for this story.

### File Structure Requirements

Primary files to create/update:
- `src/main/app/lifecycle.ts`
  - register/unregister global shortcut in app lifecycle.
- `src/main/app/create-main-window.ts`
  - ensure reusable/focusable window behavior for shortcut callback.
- `src/main/ipc/register-handlers.ts`
  - optional helper for shared event publishing pattern reuse (if centralized emitter path is chosen).
- `src/shared/ipc/ipc.contract.ts`
  - add typed focus-search event channel/schema.
- `src/preload/api.ts`
  - add typed subscription method for focus-search event.
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
  - focus `#redis-key-search` when focus-search event is received.

Likely test files to create/update:
- `src/main/test/lifecycle.global-shortcut.test.ts` (new)
- `src/renderer/test/explorer.test.tsx` (update)

### Testing Requirements

- Main-process tests:
  - Registers shortcut once after lifecycle start.
  - Unregisters shortcut on app quit path.
  - Handles register failure path without crash.
  - Callback brings existing window to foreground and emits focus event.
  - Callback creates window when none exists and still emits focus event.
- Renderer tests:
  - `RedisExplorerPanel` receives focus-search event and moves focus to `#redis-key-search`.
  - Behavior is safe when panel/input is not yet mounted.
- Regression checks:
  - Existing tray/lifecycle behavior remains intact.
  - Existing IPC handlers remain untouched except typed event addition.

### Previous Story Intelligence

From Story 6.1 (`_bmad-output/implementation-artifacts/6-1-tray-menu-quick-actions-with-safety-indicator.md`):
- Desktop integration features should be treated as safety surfaces, not convenience-only.
- Main process lifecycle wiring should remain centralized and deterministic.
- Existing patterns favor explicit, typed, test-covered integration over ad-hoc eventing.

### Git Intelligence Summary

Recent commit patterns (last 5 commits) indicate:
- Work is shipped as cohesive vertical slices across shared contract, preload bridge, main handlers/services, renderer, and tests.
- IPC/event changes are centralized in `src/shared/ipc/ipc.contract.ts` and mirrored in `src/preload/api.ts`.
- Safety/guardrail behaviors are regression-sensitive and routinely tested.

Implication for this story:
- Implement shortcut as one cohesive slice (shared contract + preload + main lifecycle + renderer focus + tests), not partial wiring.

### Latest Tech Information

Web research completed on 2026-02-14 (official sources):
- Electron `globalShortcut` API: register after app is ready; registration may fail when accelerator is already in use.
- Electron `globalShortcut` Wayland note: `GlobalShortcutsPortal` switch may be required for Wayland sessions.
- Electron `BrowserWindow` API: restore/show/focus sequencing for foreground behavior.
- Electron keyboard accelerators list for cross-platform accelerator formatting.

### Project Context Reference

No `project-context.md` file was found with pattern `**/project-context.md` in this repository.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.2)
- `_bmad-output/planning-artifacts/prd.md` (FR45)
- `_bmad-output/planning-artifacts/architecture.md` (main/preload/renderer boundary and typed IPC constraints)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (keyboard-first productivity and jump-in behavior)
- `_bmad-output/implementation-artifacts/6-1-tray-menu-quick-actions-with-safety-indicator.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/main/app/lifecycle.ts`
- `src/main/app/create-main-window.ts`
- `src/preload/api.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- https://www.electronjs.org/docs/latest/api/global-shortcut
- https://www.electronjs.org/docs/latest/api/browser-window
- https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts

### Story Completion Status

- Story document created with comprehensive implementation context.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added `src/main/app/global-shortcut.ts` with singleton registration, graceful registration-failure handling, foreground/focus callback, and explicit unregister support.
- Wired global shortcut startup/cleanup in `src/main/app/lifecycle.ts`.
- Added typed focus-search event channel/schema in `src/shared/ipc/ipc.contract.ts` and preload subscription bridge in `src/preload/api.ts`.
- Added renderer focus handoff in `src/renderer/features/explorer/RedisExplorerPanel.tsx` via `focusSearch.onRequested`.
- Added tests in `src/main/test/global-shortcut.test.ts`, `src/main/test/lifecycle.desktop-integrations.test.ts`, and `src/renderer/test/explorer.test.tsx`.
- Full validation passed on 2026-02-14: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Implemented global shortcut registration after app ready with default accelerator `CommandOrControl+Shift+K`.
- Shortcut callback now reuses existing window when present, creates one when absent, and sends typed focus-search event to renderer.
- Added robust non-crashing fallback when shortcut registration fails (collision/host limitation paths).
- Renderer now focuses `#redis-key-search` on focus-search events and safely no-ops when input is unavailable.

### File List

- `_bmad-output/implementation-artifacts/6-2-global-shortcut-to-focus-search.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/main/app/global-shortcut.ts`
- `src/main/app/lifecycle.ts`
- `src/main/app/create-main-window.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/global-shortcut.test.ts`
- `src/main/test/lifecycle.desktop-integrations.test.ts`
- `src/renderer/test/explorer.test.tsx`

## Change Log

- 2026-02-14: Implemented global shortcut lifecycle and typed focus-search event handoff with main + renderer coverage; moved story status to `review`.
