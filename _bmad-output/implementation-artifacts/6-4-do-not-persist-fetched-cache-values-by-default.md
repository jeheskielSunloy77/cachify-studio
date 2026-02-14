# Story 6.4: Do Not Persist Fetched Cache Values by Default

Status: review

Generated: 2026-02-14
Story Key: `6-4-do-not-persist-fetched-cache-values-by-default`

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a cache user,
I want the app to avoid persisting fetched cache values by default,
so that sensitive cache content is not retained on disk unintentionally.

## Acceptance Criteria

1. **Given** I inspect cache values in the UI
   **When** I close and reopen the app
   **Then** previously fetched values are not stored/restored automatically (FR50) (NFR13).

2. **Given** I want to retain evidence
   **When** I use export features
   **Then** only explicit export artifacts are saved locally (FR49).

## Tasks / Subtasks

- [x] Audit data-flow boundaries for fetched value payloads (AC: 1)
  - [x] Verify inspector/search runtime data remains in-memory only.
  - [x] Confirm persisted schemas/repositories do not store fetched value bodies.
  - [x] Document and enforce allowed persisted fields (metadata only).
- [x] Add guardrails in persistence services and IPC paths (AC: 1)
  - [x] Reject attempts to persist raw value payloads through repositories/services.
  - [x] Keep export artifact index limited to metadata/path references only.
  - [x] Add explicit comments/assertions where ambiguity could reintroduce value persistence.
- [x] Ensure restart semantics clear runtime inspection cache (AC: 1)
  - [x] Confirm startup does not hydrate prior fetched values into explorer/inspector state.
  - [x] Keep recents/session history limited to key/type/ttl metadata only.
  - [x] Validate no file writes occur for fetched values outside explicit export actions.
- [x] Preserve explicit export workflow as opt-in persistence (AC: 2)
  - [x] Keep markdown bundle creation as the explicit path to persist inspection content.
  - [x] Ensure export index records only artifact metadata.
  - [x] Maintain redaction-by-default behavior for shareable outputs.
- [x] Add tests to prevent future regressions (AC: 1, 2)
  - [x] Persistence tests assert schemas/tables contain no raw fetched-value columns.
  - [x] Service tests assert restart/load paths do not rehydrate value bodies.
  - [x] Export tests confirm explicit export is the only content-persistence route.

## Dev Notes

### Developer Context

This is the fourth story in Epic 6 and a core privacy/safety guardrail. Existing architecture and PRD already define that fetched cache values should not be persisted by default. This story formalizes enforcement and regression tests so this rule cannot drift as features evolve.

Primary objective: make non-persistence of fetched values an explicit, tested invariant while preserving explicit export behavior as the sanctioned persistence path.

### Technical Requirements

- Persisted data stores (SQLite + preference storage) must exclude fetched value bodies by default.
- Runtime inspection data may exist in memory for active UI sessions only.
- Recents/session helpers can retain metadata (key/type/ttl/timestamp) but not payload content.
- Export flows are explicit user actions and remain the only path to save value-derived content to disk.
- IPC handlers/services must not silently cache or persist fetched values to local storage.

### Architecture Compliance

- Continue strict process boundary model:
  - main process owns persistence and export filesystem writes.
  - renderer owns transient display state only.
- Preserve existing typed contract and envelopes for all relevant endpoints.
- Keep SQLite schemas in snake_case and IPC/UI payloads in camelCase (existing convention).

### Library / Framework Requirements

Latest checks completed on 2026-02-14:
- `better-sqlite3`: latest `12.6.2` (project `12.4.1`)
- `drizzle-orm`: latest `0.45.1` (project `0.44.5`)
- `electron`: latest `40.4.1` (project `40.2.1`)

No dependency changes are required for this story.

### File Structure Requirements

Primary files to review/update:
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
  - ensure fetched value handling remains runtime-only unless explicit export requested.
- `src/main/domain/cache/session/recent-keys-session.service.ts`
  - keep recents payload metadata-only.
- `src/main/domain/exports/markdown-bundle.service.ts`
  - preserve explicit export creation semantics.
- `src/main/domain/persistence/schema/*.ts`
  - confirm no fetched-value columns are introduced.
- `src/main/domain/persistence/repositories/exports-index.repository.ts`
  - ensure index stores file metadata/path only.
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
  - verify restart does not recover prior fetched value content from local storage.

Likely test files to create/update:
- `src/main/test/redis-inspector.service.test.ts`
- `src/main/test/recent-keys-session.service.test.ts`
- `src/main/test/markdown-bundle.service.test.ts`
- `src/main/test/persistence.connection.test.ts` (or schema/repository tests)
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Persistence boundary tests:
  - Assert persisted schemas/repositories do not include fetched-value body storage.
  - Assert export index persists metadata/path, not raw value payload.
- Runtime/restart tests:
  - After simulated app restart, previously inspected values are not auto-restored.
  - Recents restore only metadata fields allowed by policy.
- Export path tests:
  - Explicit export action writes artifact and index entry.
  - No implicit writes occur during routine inspect/search flows.
- Regression checks:
  - Existing saved-search/profile persistence remains functional.

### Previous Story Intelligence

From Story 6.3 and prior epics:
- Preference/persistence work must remain main-owned and typed.
- Existing export flow is already explicit and should remain the sanctioned persistence route.
- Safety/privacy defaults should be explicit in code and test suites, not implied.

### Git Intelligence Summary

Recent code patterns reinforce:
- Persistent data changes are centralized in schema/repository/service layers.
- Export and inspector behaviors are covered with targeted tests.
- Privacy/safety logic is treated as regression-sensitive and should be asserted directly.

Implication for this story:
- Implement defensive checks and tests around non-persistence invariants rather than relying on current incidental behavior.

### Latest Tech Information

Research checks completed on 2026-02-14:
- Current persistence stack remains `better-sqlite3` + `drizzle-orm`.
- No platform/runtime changes require altering the non-persistence policy.

### Project Context Reference

No `project-context.md` file was found with pattern `**/project-context.md` in this repository.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.4)
- `_bmad-output/planning-artifacts/prd.md` (FR49, FR50, NFR13)
- `_bmad-output/planning-artifacts/architecture.md` (offline-first storage boundaries)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (safe sharing and privacy posture)
- `_bmad-output/implementation-artifacts/6-3-local-preferences-storage.md`
- `src/main/domain/cache/session/recent-keys-session.service.ts`
- `src/main/domain/exports/markdown-bundle.service.ts`
- `src/main/domain/persistence/schema/exports-index.ts`
- `src/main/domain/persistence/schema/saved-searches.ts`
- https://www.electronjs.org/docs/latest/tutorial/security

### Story Completion Status

- Story document created with comprehensive implementation context.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added explicit metadata-only guardrail in `src/main/domain/persistence/repositories/exports-index.repository.ts`:
  - strict runtime validation for export index payloads,
  - hard rejection of value-like keys (`value`, `payload`, `body`, etc.).
- Added explicit runtime note in `src/main/domain/cache/session/recent-keys-session.service.ts` that recents remain metadata-only.
- Added regression coverage in:
  - `src/main/test/exports-index.repository.test.ts` (no raw-value columns + value-payload rejection),
  - `src/main/test/recent-keys-session.service.test.ts` (metadata-only recents),
  - `src/main/test/register-handlers.exports.test.ts` (index writes metadata-only payloads).
- Full validation passed on 2026-02-14: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Enforced non-persistence invariants so fetched cache values are not silently written into persisted index/storage paths.
- Verified export persistence remains opt-in and metadata-indexed, with value content only in explicit export artifacts.
- Added schema-level regression checks ensuring `export_artifacts` remains metadata-only (`file_path`, `redis_key`, redaction metadata, preview mode).
- Confirmed recents/session history stores metadata fields only and ignores accidental payload fields.

### File List

- `_bmad-output/implementation-artifacts/6-4-do-not-persist-fetched-cache-values-by-default.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/main/domain/persistence/repositories/exports-index.repository.ts`
- `src/main/domain/cache/session/recent-keys-session.service.ts`
- `src/main/test/exports-index.repository.test.ts`
- `src/main/test/recent-keys-session.service.test.ts`
- `src/main/test/register-handlers.exports.test.ts`

## Change Log

- 2026-02-14: Added explicit non-persistence guardrails and regression tests to enforce metadata-only storage by default; moved story status to `review`.
