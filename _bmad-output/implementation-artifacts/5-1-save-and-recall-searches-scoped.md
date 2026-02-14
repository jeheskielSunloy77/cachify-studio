# Story 5.1: Save and Recall Searches (Scoped)

Status: done

Generated: 2026-02-12
Story Key: `5-1-save-and-recall-searches-scoped`

## Story

As a cache user,
I want to save searches (query plus optional scope) and recall them later,
so that repetitive investigations are fast.

## Acceptance Criteria

1. **Given** an explorer search  
   **When** I save it with optional scope (connection and/or prefix)  
   **Then** it is stored locally and appears in a saved searches list (FR39, FR48).

2. **Given** a saved search  
   **When** I select it  
   **Then** the app re-runs the search with the saved scope and shows results (FR40).

## Tasks / Subtasks

- [x] Add persistence model for saved searches (AC: 1)
  - [x] Create SQLite table and migration for saved searches with snake_case columns.
  - [x] Add Drizzle schema and export in schema index.
  - [x] Implement repository operations: list, create, delete, and access by id.
- [x] Add typed IPC contract and preload bridge for saved searches (AC: 1, 2)
  - [x] Define request/response Zod schemas and channel names in shared IPC contract.
  - [x] Add main handlers in `register-handlers.ts` with strict envelope responses.
  - [x] Expose preload API methods under a dedicated `savedSearches` namespace.
- [x] Add domain service validation and normalization (AC: 1)
  - [x] Validate query and optional scope input.
  - [x] Normalize trimmed scope and stable naming.
- [x] Integrate saved searches UI in Explorer (AC: 1, 2)
  - [x] Add save action using current search query + optional scope.
  - [x] Render saved searches list with clear labels for scope.
  - [x] Selecting an item must restore query/prefix scope and trigger search.
- [x] Add automated tests (AC: 1, 2)
  - [x] Main-process tests for repository/service/IPC success and validation failures.
  - [x] Renderer tests for save, list rendering, and recall triggering search with expected payload.

## Dev Notes

### Developer Context

This is the first story in Epic 5. It introduces reusable investigation workflows through local saved searches. The implementation must reuse existing persistence + IPC patterns and avoid ad-hoc local renderer storage for durable search definitions.

### Technical Requirements

- Persist saved searches in local SQLite (main process only) to satisfy FR48.
- Support optional scope fields for connection and prefix:
  - `connectionProfileId` should be nullable.
  - `prefix` should be nullable/optional.
- Preserve current Redis explorer constraints:
  - Existing search execution path is `redisKeys:startSearch` with `{ query, prefix }`.
  - Recall should map saved search scope back into this payload.
- Use strict validation with Zod in shared IPC contract.
- Return stable envelopes for all handlers:
  - Success: `{ ok: true, data }`
  - Failure: `{ ok: false, error: { code, message, details? } }`
- Keep renderer resilient:
  - Show actionable error text when save/list/recall fails.
  - Do not block existing search path when saved search APIs are unavailable.

### Architecture Compliance

- Process boundaries are mandatory:
  - Renderer: UI and interaction only.
  - Preload: typed bridge only.
  - Main: DB IO, validation, and mutation logic.
- Naming conventions:
  - SQLite schema uses snake_case.
  - IPC and renderer payloads use camelCase.
  - Explicit mapping stays in main persistence layer.
- Persistence behavior:
  - Use existing SQLite lifecycle (`initializePersistence`, migration flow) and error envelope conventions.
  - Do not introduce filesystem persistence in renderer for this feature.

### Library / Framework Requirements

Latest registry checks run on 2026-02-12:
- `electron`: latest `40.4.0` (project currently `40.2.1`)
- `react`: latest `19.2.4` (project currently `19.2.0`)
- `zod`: latest `4.3.6` (project currently `4.1.5`)
- `drizzle-orm`: latest `0.45.1` (project currently `0.44.5`)
- `better-sqlite3`: latest `12.6.2` (project currently `12.4.1`)
- `vite`: latest `7.3.1` (project currently aligned)
- `vitest`: latest `4.0.18` (project currently aligned)

No dependency upgrade is required for this story. Implement using current pinned project versions to avoid unrelated churn.

### File Structure Requirements

Primary files to create/update:
- `src/main/domain/persistence/schema/saved-searches.ts` (new)
- `src/main/domain/persistence/schema/index.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/repositories/saved-searches.repository.ts` (new)
- `src/main/domain/persistence/services/saved-searches.service.ts` (new)
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`

Likely test files to create/update:
- `src/main/test/saved-searches.repository.test.ts` (new)
- `src/main/test/saved-searches.service.test.ts` (new)
- `src/main/test/register-handlers.persistence.test.ts`
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Repository tests:
  - Create/list/delete saved searches.
  - Ensure ordering and stable field mapping.
- Service tests:
  - Validation for empty/invalid query or malformed scope.
  - Normalization for optional scope values.
- IPC tests:
  - Handler validation errors return `VALIDATION_ERROR` envelopes.
  - Persistence unavailability returns current persistence failure envelope patterns.
- Renderer tests:
  - Save action calls API with current query/prefix scope.
  - Saved list renders and selecting item restores scope + starts search.
  - Error handling remains recoverable and visible.

### Anti-Reinvention Guardrails

- Reuse existing persistence access patterns from `connection-profiles` repository/service; do not build a parallel persistence style.
- Reuse existing IPC envelope helper behavior in `register-handlers.ts`; do not introduce custom response shapes.
- Reuse existing explorer search start path; recall should populate and call the same flow rather than duplicating search logic.

### Latest Tech Information

- Current stack versions in this repo are recent enough for Story 5.1 scope; this story is feature-level and does not require framework upgrade.
- Keep `better-sqlite3` handling aligned with existing ABI/persistence diagnostics in `src/main/domain/persistence/db/connection.ts`.
- Keep Zod `.strict()` schema discipline in IPC contracts to prevent permissive payload drift.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.1)
- `_bmad-output/planning-artifacts/prd.md` (FR39, FR40, FR48)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/4-5-memcached-set-by-key-when-unlocked.md`
- `src/main/domain/persistence/repositories/connection-profiles.repository.ts`
- `src/main/domain/persistence/services/connection-profiles.service.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow-driven story context creation completed for Story 5.1.
- Sprint status updated for target story and epic progression.
- Full artifact/context analysis completed across epics, PRD, architecture, UX, and current codebase patterns.
- Implemented saved-search persistence, domain service normalization, IPC contracts/handlers, preload bridge, and Explorer saved-search UI actions.
- Added repository/service/IPC/renderer coverage for saved-search create/list/recall/delete paths and validation handling.
- Validation gates passed: `npm run lint`, `npm run typecheck`, and `npm test`.

### Completion Notes List

- Added `saved_searches` SQLite migration/schema and repository CRUD (list/create/delete/get by id) with snake_case mapping.
- Added strict saved-search IPC contract channels (`list/create/get/delete`), main handlers, and preload `savedSearches` namespace.
- Added Explorer saved-search workflow: save current scoped query, render scoped list labels, recall by id into existing Redis search flow.
- Added/updated tests: repository/service/IPC handler coverage plus renderer save+recall behavior.
- Story status set to `review` after full lint/typecheck/test pass.

### File List

- `_bmad-output/implementation-artifacts/5-1-save-and-recall-searches-scoped.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/shared/explorer/saved-searches.schemas.ts`
- `src/main/domain/persistence/schema/saved-searches.ts`
- `src/main/domain/persistence/schema/index.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/repositories/saved-searches.repository.ts`
- `src/main/domain/persistence/services/saved-searches.service.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/saved-searches.repository.test.ts`
- `src/main/test/saved-searches.service.test.ts`
- `src/main/test/register-handlers.saved-searches.test.ts`
- `src/main/test/register-handlers.persistence.test.ts`
- `src/main/test/register-handlers.mutations.test.ts`
- `src/main/test/register-handlers.secrets.test.ts`
- `src/renderer/test/explorer.test.tsx`

## Change Log

- 2026-02-12: Created Story 5.1 with comprehensive implementation context and marked status ready-for-dev.
- 2026-02-13: Implemented saved-search persistence/service/IPC/preload/Explorer integration and added full test coverage; status moved to review.
- 2026-02-13: Senior Developer Review (AI) completed; auto-fixed async error-handling/pending-state reliability in shared Explorer flows; status moved to done.

## Senior Developer Review (AI)

Date: 2026-02-13
Reviewer: Jay
Outcome: Approved with changes applied

- Fixed `MEDIUM`: saved-search create/delete/recall actions could leave pending UI state stuck on rejected promises in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
- Fixed `MEDIUM`: saved-search initial load path could trigger unhandled promise rejection and missing fallback messaging in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
- Fixed `LOW`: strengthened renderer-side operational error messaging for async saved-search failures in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
