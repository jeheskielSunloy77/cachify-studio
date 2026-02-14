# Story 6.1: Tray Menu Quick Actions with Safety Indicator

Status: review

Generated: 2026-02-13
Story Key: `6-1-tray-menu-quick-actions-with-safety-indicator`

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a cache user,
I want core actions accessible from a tray menu with a safety indicator,
so that I can quickly re-enter context and avoid mistakes.

## Acceptance Criteria

1. **Given** the app is running
   **When** I open the tray menu
   **Then** I can access core actions (open app, recent connections) and see current safety/mode indicator (FR44).

## Tasks / Subtasks

- [x] Add main-process tray lifecycle management (AC: 1)
  - [x] Create tray instance after `app.whenReady()` and hold a single instance for app lifetime.
  - [x] Build menu entries for: open app, recent connections, and quit.
  - [x] Ensure tray menu state is rebuilt when connection status changes.
- [x] Add safety indicator content in tray (AC: 1)
  - [x] Surface `environmentLabel` and `safetyMode` from session state in tray label/menu text.
  - [x] Include text + icon/marker semantics (not color-only messaging).
  - [x] Show safe fallback when no active connection exists.
- [x] Add recent-connections provider for tray menu (AC: 1)
  - [x] Reuse existing profile persistence layer to derive recent entries (stable ordering + max count).
  - [x] Selecting a recent connection should focus/open window and initiate switch/connect flow safely.
- [x] Wire lifecycle integration and cleanup (AC: 1)
  - [x] Integrate tray setup into startup path without breaking existing lifecycle and IPC initialization.
  - [x] Clean up global listeners on app exit/reload paths where needed.
- [x] Add tests for tray behavior (AC: 1)
  - [x] Main tests cover tray menu construction for disconnected, read-only, and unlocked states.
  - [x] Main tests cover recent connection item actions and safe fallback labels.
  - [x] Main tests verify no duplicate tray instances and menu refresh behavior.

## Dev Notes

### Developer Context

This is the first story in Epic 6 and establishes desktop productivity entry points while preserving the product's trust-first posture. The tray menu must be treated as a safety surface, not only a convenience surface: users need immediate clarity about active environment and mutation posture before re-entering work.

Primary implementation objective: add robust tray menu integration in the main process that exposes quick actions and a continuously accurate safety indicator, without bypassing existing process boundaries or introducing ad-hoc state.

### Technical Requirements

- Main process owns all tray integration (`electron.Tray`, `Menu.buildFromTemplate`), with no renderer-owned tray logic.
- Tray state must derive from canonical session state (`connectionSessionService.getStatus()`), not duplicated state stores.
- Recent connections in tray should derive from persisted profile metadata with deterministic ordering and bounded list size.
- Tray quick actions must route through existing connection/session flows so safety defaults are preserved (`readOnly` on connect, explicit unlock required).
- Safety indicator must include explicit text for both environment and mode. Avoid color-only meaning.
- Tray menu refresh should be event-driven on status/profile changes and safe on all supported platforms.

### Architecture Compliance

- Respect process boundaries from architecture and existing code:
  - `src/main` handles Electron shell integrations (tray, lifecycle, session orchestration).
  - `src/preload` remains a minimal bridge; no tray APIs are exposed directly to renderer.
  - `src/renderer` remains UI-only and consumes typed preload APIs.
- Preserve typed IPC contract and envelope semantics for any new tray-triggered action requiring renderer/main communication.
- Keep state truth in main domain services and repositories. Avoid introducing cross-process hidden state.

### Library / Framework Requirements

Latest checks completed on 2026-02-13:
- `electron`: latest `40.4.0` (project `40.2.1`)
- `@electron-forge/cli`: latest `7.11.1` (project aligned)
- `react`: latest `19.2.4` (project `19.2.0`)
- `zod`: latest `4.3.6` (project `4.1.5`)
- `@base-ui/react`: latest `1.2.0` (project `1.1.0`)
- `better-sqlite3`: latest `12.6.2` (project `12.4.1`)
- `drizzle-orm`: latest `0.45.1` (project `0.44.5`)
- `vite`: latest `7.3.1` (project aligned)

Electron API guardrails to apply:
- Create tray only after `app.whenReady()`.
- For Linux, tray behavior depends on StatusNotifier/AppIndicator availability; test menu behavior on supported Linux targets.
- If tray menu items are changed dynamically, rebuild and set context menu explicitly to ensure updates are reflected consistently.

No dependency upgrade is required for this story; this is an implementation and integration story.

### File Structure Requirements

Primary files to create/update:
- `src/main/app/lifecycle.ts` (initialize tray in startup flow after app readiness)
- `src/main/app/create-main-window.ts` (reuse/focus behavior for tray open action)
- `src/main/app/tray.ts` (new: tray instance creation, menu template, dynamic rebuild)
- `src/main/domain/cache/session/connection-session.service.ts` (consume status for tray indicator and connect/switch actions)
- `src/main/domain/persistence/repositories/connection-profiles.repository.ts` or service layer wrapper (recent-connection selection source)
- `src/main.ts` (entry remains unchanged unless lifecycle bootstrap signature changes)

Likely test files to create/update:
- `src/main/test/tray.test.ts` (new: tray menu composition + action wiring)
- `src/main/test/lifecycle.test.ts` (optional if lifecycle integration needs direct unit coverage)
- `src/main/test/connection-session.service.test.ts` (if tray-driven connection/switch behavior expands service surface)

### Testing Requirements

- Main-process unit tests:
  - Build tray menu for disconnected state (no active connection).
  - Build tray menu for connected read-only state and connected unlocked state.
  - Verify safety indicator text includes environment + mode labels.
- Action tests:
  - "Open app" tray action focuses existing window or creates one when absent.
  - Recent connection action triggers connect/switch flow through existing session service.
- Lifecycle tests:
  - Tray created once per process lifecycle, no duplicate instances.
  - Menu rebuild executes on relevant status transitions.
- Regression checks:
  - Existing lifecycle startup path (persistence init, IPC registration, window creation) remains intact.

### Git Intelligence Summary

Recent repository patterns (latest 5 commits) show:
- Feature work is shipped end-to-end across main + preload + renderer with test coverage in the same change set.
- IPC contract evolution is centralized in `src/shared/ipc/ipc.contract.ts` and mirrored in preload/main handlers.
- Safety behavior and error-envelope consistency are treated as regression-sensitive and tested explicitly.

Implication for this story:
- Keep tray work cohesive (main lifecycle + tray module + tests), and avoid ad-hoc shortcuts that bypass existing typed/session patterns.

### Latest Tech Information

Web research completed on 2026-02-13 (official Electron docs):
- Tray API reference: `https://www.electronjs.org/docs/latest/api/tray`
- Global shortcut API reference (for upcoming Story 6.2 sequencing context): `https://www.electronjs.org/docs/latest/api/global-shortcut`

Story-relevant implications from official docs:
- Tray and application event wiring must happen after app readiness.
- Linux tray support can vary by desktop environment/status notifier support, so test behavior on Linux package targets.
- Dynamic menu changes should rebuild/reset tray context menus explicitly for reliable updates.

### Project Context Reference

No `project-context.md` file was found with pattern `**/project-context.md` in this repository.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.1)
- `_bmad-output/planning-artifacts/prd.md` (FR44)
- `_bmad-output/planning-artifacts/architecture.md` (desktop integration and process boundaries)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (tray/global shortcut UX intent and trust-state visibility)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/main.ts`
- `src/main/app/lifecycle.ts`
- `src/main/app/create-main-window.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/domain/persistence/repositories/connection-profiles.repository.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `https://www.electronjs.org/docs/latest/api/tray`
- `https://www.electronjs.org/docs/latest/api/global-shortcut`

### Story Completion Status

- Story document created with comprehensive implementation context.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Implemented `src/main/app/tray.ts` with single-instance lifecycle, status-driven menu refresh, safety indicator text markers, and recent-connection actions.
- Integrated tray bootstrap/cleanup into `src/main/app/lifecycle.ts` and reused window focus/create behavior via `src/main/app/create-main-window.ts`.
- Added tray + lifecycle coverage in `src/main/test/tray.test.ts` and `src/main/test/lifecycle.desktop-integrations.test.ts`.
- Full validation passed on 2026-02-14: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Added tray menu entries for `Open app`, `Recent connections`, and `Quit`, with deterministic rebuilds and no duplicate tray instances.
- Added safety indicator semantics with explicit text markers (`[SAFE]` / `[UNLOCKED]`), environment label, and disconnected fallback copy.
- Recent connections are sourced from persisted profile metadata (`profilesService.list()` ordering) and capped to 5 entries.
- Selecting a recent connection opens/focuses the app and executes safe connect/switch flow through `connectionSessionService`.

### File List

- `_bmad-output/implementation-artifacts/6-1-tray-menu-quick-actions-with-safety-indicator.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/main/app/tray.ts`
- `src/main/app/lifecycle.ts`
- `src/main/app/create-main-window.ts`
- `src/main/test/tray.test.ts`
- `src/main/test/lifecycle.desktop-integrations.test.ts`

## Change Log

- 2026-02-14: Implemented tray lifecycle, safety indicator, and recent-connection quick actions with full test coverage; moved story status to `review`.
