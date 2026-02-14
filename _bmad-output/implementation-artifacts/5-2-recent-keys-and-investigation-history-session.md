# Story 5.2: Recent Keys and Investigation History (Session)

Status: done

Generated: 2026-02-13
Story Key: `5-2-recent-keys-and-investigation-history-session`

## Story

As a cache user,
I want to view and reopen recently inspected keys for the current session,
so that I can bounce between findings quickly.

## Acceptance Criteria

1. **Given** I inspect keys during a session  
   **When** I open "Recents"  
   **Then** I can see and reopen recently inspected keys/values for the current session (FR41).

## Tasks / Subtasks

- [x] Add session-scoped recents domain model in main process (AC: 1)
  - [x] Create a new in-memory service for recent key history scoped to current app session (no SQLite persistence).
  - [x] Deduplicate by `(connectionProfileId, key)` and move reopened/reinspected keys to top.
  - [x] Enforce bounded history length (e.g., 50 per connection) to prevent unbounded memory growth.
  - [x] Capture minimal non-sensitive metadata only: key, type (if available), ttlSeconds (if available), inspectedAt.
- [x] Record inspections into recents from existing inspect workflow (AC: 1)
  - [x] Hook recording on successful Redis inspect completion path in main IPC/inspect handling.
  - [x] Ensure failed/cancelled inspections do not create recents entries.
  - [x] Keep behavior compatible with current inspector job/event model.
- [x] Expose typed IPC contract + preload bridge for recents (AC: 1)
  - [x] Add channels/schemas for listing session recents and reopening a recent key context.
  - [x] Use strict Zod request/response schemas and existing envelope conventions.
  - [x] Register handlers in `register-handlers.ts` with normalized error envelopes.
- [x] Integrate Recents UI in explorer (AC: 1)
  - [x] Add a Recents section in `RedisExplorerPanel.tsx` for active Redis connection context.
  - [x] Render recent items with key + lightweight metadata (type/TTL/relative time).
  - [x] Selecting a recent should restore inspect target and trigger existing inspect flow.
  - [x] Keep keyboard accessibility and non-blocking behavior aligned with existing panel interactions.
- [x] Add tests for main/IPC/renderer behavior (AC: 1)
  - [x] Main tests: recents service ordering, dedupe, bounds, and session-only lifecycle.
  - [x] IPC tests: validation failures and envelope shape compliance.
  - [x] Renderer tests: recents rendering and reopen action triggers inspect with expected payload.

## Dev Notes

### Developer Context

This story extends Story 5.1's investigation workflow by adding quick, session-only re-entry points to previously inspected keys. It must integrate with the current Redis inspector and explorer interactions without introducing new persistence layers for fetched values.

### Technical Requirements

- Session-only storage is required for this story's scope:
  - Implement recents as in-memory state in main process runtime.
  - Do not store recents in SQLite/electron-store for this story.
- Reopen behavior must reuse existing inspect path:
  - Existing inspector flow in renderer/main already uses `redisInspect:start` + progress/done events.
  - Recents selection should route through that same flow rather than duplicating fetch logic.
- Scope recents to current session and active connection context:
  - Listing in explorer should be for the active Redis connection profile.
  - Entries should remain non-secret and metadata-only.
- Respect existing envelope and validation standards:
  - Success: `{ ok: true, data }`
  - Failure: `{ ok: false, error: { code, message, details? } }`
  - IPC schemas must remain `.strict()`.

### Architecture Compliance

- Process boundaries:
  - Renderer: display recents and trigger reopen actions.
  - Preload: typed bridge only.
  - Main: owns recents state and inspect integration.
- Naming and contracts:
  - IPC channels follow `domain:action` style.
  - Payloads in IPC/UI use camelCase.
- Data safety posture:
  - Keep value content out of persistence and out of recents records.
  - Continue existing FR50/NFR13 behavior (no fetched cache value persistence by default).

### Library / Framework Requirements

Latest checks completed on 2026-02-13 (npm registry):
- `electron`: latest `40.4.0` (project `40.2.1`)
- `react`: latest `19.2.4` (project `19.2.0`)
- `zod`: latest `4.3.6` (project `4.1.5`)
- `drizzle-orm`: latest `0.45.1` (project `0.44.5`)
- `better-sqlite3`: latest `12.6.2` (project `12.4.1`)
- `vite`: latest `7.3.1` (project aligned)
- `vitest`: latest `4.0.18` (project aligned)
- `tailwindcss`: latest `4.1.18` (project aligned)

No dependency upgrade is required for this story. Implement against current pinned versions.

### File Structure Requirements

Primary files to create/update:
- `src/main/domain/cache/session/recent-keys-session.service.ts` (new)
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`

Likely test files to create/update:
- `src/main/test/recent-keys-session.service.test.ts` (new)
- `src/main/test/register-handlers.recents.test.ts` (new or merged)
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Main domain tests:
  - add record, dedupe move-to-top, max-size trimming, per-connection filtering.
  - verify process/session reset semantics for in-memory state.
- IPC tests:
  - list/open payload validation errors return `VALIDATION_ERROR` envelopes.
  - unavailable/invalid connection states return stable actionable errors.
- Renderer tests:
  - recents section visibility when Redis connected.
  - selecting a recents item invokes existing inspect path.
  - resilient error handling when recents APIs return failure envelopes.

### Previous Story Intelligence

From Story 5.1 patterns to preserve:
- Reuse existing persistence and IPC conventions; do not introduce ad-hoc response shapes.
- Reuse explorer and inspect pathways rather than parallel implementations.
- Keep validation strict and make failures recoverable in UI.

### Git Intelligence Summary

Recent implementation patterns in repository:
- Mutation and inspect capabilities were added through typed IPC contract updates in lock-step with preload and renderer changes.
- Explorer UI behavior is covered by `src/renderer/test/explorer.test.tsx` and should be extended in-place.
- Main-process behavior is validated with focused service and handler tests in `src/main/test`.

Apply the same pattern for recents: domain service -> ipc contract/handlers -> preload bridge -> renderer UI + tests.

### Latest Tech Information

- Current stack versions are sufficiently current for Story 5.2 scope.
- Story is feature-level; avoid framework/version churn in this change.
- Keep using strict Zod contracts and current typed preload API conventions.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.2)
- `_bmad-output/planning-artifacts/prd.md` (FR41, FR50, NFR13)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/5-1-save-and-recall-searches-scoped.md`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/domain/cache/explorer/redis-key-discovery.service.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/renderer/test/explorer.test.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow-driven story context creation completed for Story 5.2.
- Full context analysis completed across epics, PRD, architecture, UX, previous story, and repository patterns.
- Sprint status transition prepared for Story 5.2.
- Implemented session-scoped recent key history service with dedupe, move-to-top reopen semantics, bounded per-connection history, and reset support.
- Wired inspect completion recording into `redisInspect:start` done path and added recents list/reopen IPC handlers with strict validation envelopes.
- Validation gates passed: `npm run lint`, `npm run typecheck`, and `npm test`.

### Completion Notes List

- Added in-memory recents domain model with minimal metadata only (`key`, `type`, `ttlSeconds`, `inspectedAt`) scoped by active connection.
- Added `recentKeys:list` and `recentKeys:reopen` typed IPC/preload APIs and integrated Recents UI with reopen-to-inspect behavior.
- Added tests for service ordering/bounds/dedupe, recents IPC validation/envelopes, and renderer recents reopen flow.
- Story status set to `review` after full lint/typecheck/test pass.

### File List

- `_bmad-output/implementation-artifacts/5-2-recent-keys-and-investigation-history-session.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/shared/explorer/recent-keys.schemas.ts`
- `src/main/domain/cache/session/recent-keys-session.service.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/recent-keys-session.service.test.ts`
- `src/main/test/register-handlers.recents.test.ts`
- `src/renderer/test/explorer.test.tsx`

## Change Log

- 2026-02-13: Created Story 5.2 with comprehensive implementation context and marked status ready-for-dev.
- 2026-02-13: Implemented session-scoped recents service + inspect integration + IPC/preload/renderer workflows and expanded automated tests; status moved to review.
- 2026-02-13: Senior Developer Review (AI) completed; auto-fixed recents reopen/load async resilience in Explorer UI; status moved to done.

## Senior Developer Review (AI)

Date: 2026-02-13
Reviewer: Jay
Outcome: Approved with changes applied

- Fixed `MEDIUM`: recents reopen flow could leave pending state active when IPC promises reject in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
- Fixed `MEDIUM`: recents list bootstrap path lacked rejection handling/fallback messaging in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
- Fixed `LOW`: standardized UI error normalization for recents runtime failures in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
