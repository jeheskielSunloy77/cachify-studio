# Story 6.3: Local Preferences Storage

Status: review

Generated: 2026-02-14
Story Key: `6-3-local-preferences-storage`

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a cache user,
I want my preferences stored locally,
so that the app behaves consistently across sessions without needing a backend.

## Acceptance Criteria

1. **Given** I change user preferences
   **When** I restart the app
   **Then** preferences are restored from local storage (FR46) (NFR12).

## Tasks / Subtasks

- [x] Define typed preferences domain and persistence adapter (AC: 1)
  - [x] Create a main-process preferences service with explicit schema/validation.
  - [x] Persist preferences under userData (no renderer direct file access).
  - [x] Keep a versioned preference payload for safe migration.
- [x] Add typed IPC contract for preferences read/update (AC: 1)
  - [x] Add request/response schemas in `src/shared/ipc/ipc.contract.ts`.
  - [x] Register handlers in main with envelope format (`ok/data` or `ok/error`).
  - [x] Expose preload bridge methods in `src/preload/api.ts`.
- [x] Migrate existing renderer-local preference to main persistence (AC: 1)
  - [x] Replace `window.localStorage` decode pipeline preference usage in `RedisExplorerPanel` with IPC-backed preference API.
  - [x] Keep fallback defaults if persistence is unavailable.
  - [x] Ensure preference writes are debounced or scoped to meaningful user actions.
- [x] Define v1 preference set and defaults (AC: 1)
  - [x] Include decode pipeline preference (`raw-text`/`json-pretty`).
  - [x] Include future-safe shape for desktop settings (e.g., global shortcut accelerator, compact density) without requiring immediate UI exposure.
  - [x] Ensure secrets are excluded from preference storage by design.
- [x] Add tests for round-trip persistence and restart behavior (AC: 1)
  - [x] Main tests validate create/read/update persistence across service re-instantiation.
  - [x] IPC tests validate schema and envelope handling.
  - [x] Renderer tests validate decode preference is restored from persisted value.

## Dev Notes

### Developer Context

This story is the third implementation story in Epic 6 and should build directly on Story 6.1/6.2 desktop integration work. The product already persists profile and saved-search metadata in main persistence layers; this story formalizes user preference persistence and removes renderer-only localStorage reliance.

Primary objective: centralize preference persistence in the main process using typed IPC contracts so settings survive app restarts while preserving strict Electron process boundaries.

### Technical Requirements

- Main process owns preference IO and schema validation.
- Renderer must not use `window.localStorage` as the source of truth for durable app preferences.
- IPC must use the existing typed contract/envelope pattern in `src/shared/ipc/ipc.contract.ts`.
- Preferences should live under userData via a deterministic store path.
- Preference payload must be structured-clone safe and versioned for future migrations.
- Preferences are non-secret only (credentials remain in secure storage flow already implemented).

### Architecture Compliance

- Keep boundaries explicit:
  - `src/main/*`: preference persistence and business logic.
  - `src/preload/*`: typed bridge methods only.
  - `src/renderer/*`: read/write through preload API only.
- Reuse established persistence and IPC design:
  - Zod validation in shared contract.
  - main handlers return standardized envelopes.
- Do not introduce duplicated persistence patterns in renderer feature modules.

### Library / Framework Requirements

Latest checks completed on 2026-02-14:
- `electron-store`: latest `11.0.2` (not currently installed in project)
- `electron`: latest `40.4.1` (project `40.2.1`)
- `zod`: latest `4.3.6` (project `4.1.5`)
- `better-sqlite3`: latest `12.6.2` (project `12.4.1`)
- `drizzle-orm`: latest `0.45.1` (project `0.44.5`)

Implementation choice guidance:
- Architecture recommends `electron-store` for app preferences and SQLite for structured domain data.
- If `electron-store` is adopted here, keep it scoped to preferences only.
- If current sprint chooses to defer dependency addition, use an equivalent main-process persisted preference adapter with the same contract shape and migration hooks.

No mandatory dependency upgrade is required for this story to be marked ready.

### File Structure Requirements

Primary files to create/update:
- `src/shared/ipc/ipc.contract.ts`
  - add preferences channels + request/response schemas.
- `src/preload/api.ts`
  - add typed preferences API bridge.
- `src/main/ipc/register-handlers.ts`
  - register preferences handlers.
- `src/main/domain/persistence/services/preferences.service.ts` (new)
  - read/update defaults, merge, migration handling.
- `src/main/domain/persistence/stores/preferences.store.ts` (new)
  - adapter for underlying local storage implementation.
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
  - remove durable localStorage dependency for decode preference.

Likely test files to create/update:
- `src/main/test/preferences.service.test.ts` (new)
- `src/main/test/register-handlers.preferences.test.ts` (new)
- `src/renderer/test/explorer.test.tsx` (update persisted decode-preference tests)

### Testing Requirements

- Main tests:
  - Default preferences returned on first launch.
  - Updated preferences persist across service re-initialization.
  - Invalid preference payloads are rejected with deterministic error envelopes.
- IPC tests:
  - preferences get/update channels validate schemas and envelope shape.
- Renderer tests:
  - Existing decode pipeline preference behavior continues to work, now sourced through API.
  - App behavior remains stable when preference API returns error (fallback defaults).
- Regression checks:
  - Existing profile/search persistence remains unaffected.

### Previous Story Intelligence

From Stories 6.1 and 6.2:
- Desktop productivity features should remain centralized in main-process lifecycle/services.
- Shared IPC contract + preload bridge is the repository-standard integration pattern.
- Avoid ad-hoc renderer state that bypasses domain boundaries.

### Git Intelligence Summary

Recent commits show consistent vertical integration patterns:
- `src/shared/ipc/ipc.contract.ts` is the single source for contract changes.
- `src/preload/api.ts` mirrors shared contract updates.
- Main/renderer behavior changes are shipped with tests in the same slice.

Implication for this story:
- Deliver preferences as a cohesive contract-to-UI slice, not a renderer-only patch.

### Latest Tech Information

Research/registry checks completed on 2026-02-14:
- `electron-store` current version: `11.0.2`.
- Electron best-practice alignment remains: keep persistence in main process and expose typed APIs to renderer.

### Project Context Reference

No `project-context.md` file was found with pattern `**/project-context.md` in this repository.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.3)
- `_bmad-output/planning-artifacts/prd.md` (FR46, NFR12)
- `_bmad-output/planning-artifacts/architecture.md` (main-owned persistence and IPC boundaries)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (offline-first and consistent behavior)
- `_bmad-output/implementation-artifacts/6-2-global-shortcut-to-focus-search.md`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/ipc/register-handlers.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- https://www.electronjs.org/docs/latest/tutorial/ipc
- https://www.electronjs.org/docs/latest/api/app
- https://www.npmjs.com/package/electron-store

### Story Completion Status

- Story document created with comprehensive implementation context.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added shared preferences schemas in `src/shared/preferences/preferences.schemas.ts` with versioned payload (`version: 1`) and future-safe desktop fields.
- Added preferences IPC channels/schemas in `src/shared/ipc/ipc.contract.ts` and wired handlers in `src/main/ipc/register-handlers.ts`.
- Implemented main-process preferences persistence adapter/service:
  - `src/main/domain/persistence/stores/preferences.store.ts`
  - `src/main/domain/persistence/services/preferences.service.ts`
- Exposed preload bridge methods in `src/preload/api.ts`.
- Migrated decode preference persistence from renderer `localStorage` to IPC-backed preferences in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
- Added tests in `src/main/test/preferences.service.test.ts`, `src/main/test/register-handlers.preferences.test.ts`, and updated `src/renderer/test/explorer.test.tsx`.
- Full validation passed on 2026-02-14: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Preferences now persist under app `userData` as validated, versioned JSON managed from the main process.
- Renderer decode pipeline preference now hydrates from `preferences:get` and persists via debounced `preferences:update`.
- Added fallback-safe behavior when preference APIs are unavailable or return errors.
- Preference shape includes decode pipeline plus future-safe desktop settings (`globalShortcutAccelerator`, `density`) with no secret fields.

### File List

- `_bmad-output/implementation-artifacts/6-3-local-preferences-storage.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/shared/preferences/preferences.schemas.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/persistence/stores/preferences.store.ts`
- `src/main/domain/persistence/services/preferences.service.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/preferences.service.test.ts`
- `src/main/test/register-handlers.preferences.test.ts`
- `src/renderer/test/explorer.test.tsx`

## Change Log

- 2026-02-14: Implemented main-owned local preferences storage + typed IPC/preload bridge and migrated decode preference from renderer localStorage; moved story status to `review`.
