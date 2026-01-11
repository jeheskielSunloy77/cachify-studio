# Story 2.3: Redis Inspect Strings and Hashes (Fetch + Minimal Viewer with Safety Caps)

Status: review

Generated: 2026-02-10
Story Key: `2-3-redis-inspect-strings-and-hashes-fetch-minimal-viewer-with-safety-caps`

## Story

As a cache user,
I want to inspect Redis string and hash values,
so that I can understand what a key contains.

## Acceptance Criteria

1. **Given** a selected Redis string key
   **When** I open the inspector
   **Then** app fetches and displays the string value (FR19).
2. **Given** a selected Redis hash key
   **When** I open the inspector
   **Then** app fetches and displays fields and values (FR20).
3. **Given** values exceed safe preview limits
   **When** I inspect the key
   **Then** app degrades gracefully with partial preview and clear caps state (NFR4, NFR6, NFR16).

## Tasks / Subtasks

- [x] Add inspector fetch contract for string/hash types (AC: 1,2,3)
  - [x] Define typed request/response for key inspect with explicit result union by Redis type.
  - [x] Add cancelable job path for large hash fetches.
- [x] Implement Redis string/hash inspectors in main (AC: 1,2)
  - [x] String: GET with byte-size checks.
  - [x] Hash: HLEN + HSCAN/HGETALL strategy with bounded chunking.
- [x] Implement safety caps and truncation metadata (AC: 3)
  - [x] Respect decoded preview cap of 1MB.
  - [x] Surface cap reason and remaining-safe actions.
- [x] Build minimal viewer in renderer (AC: 1,2,3)
  - [x] Show metadata banner (type, TTL if available, cap status).
  - [x] Provide clear partial-result indicator.
- [x] Add tests (AC: 1,2,3)
  - [x] Main tests for string/hash success, missing key, cap exceeded.
  - [x] Renderer tests for viewer states and large payload behavior.

## Dev Notes

### Developer Context

This is the first key inspector story. Keep implementation type-safe and extensible because stories 2.4 and 2.5 add collection/stream variants.

### Technical Requirements

- Avoid unbounded HGETALL on very large hashes without limits.
- Return explicit viewer metadata: `isPartial`, `capReached`, `capReason`, `fetchedCount`.
- Do not persist fetched values to local storage.

### Architecture Compliance

- Main process performs Redis fetch/decode prep; renderer only renders payload.
- Keep IPC payloads structured-clone-safe.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`

### File Structure Requirements

- `src/main/domain/cache/inspector/` (new)
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/inspector/` (new)
- `src/main/test/` and `src/renderer/test/`

### Testing Requirements

- Validate cap behavior on string payloads near and over 1MB.
- Validate hash partial pagination and cancellation.

### Previous Story Intelligence

Stories 2.1 and 2.2 already define stream/cancel patterns and metadata semantics. Inspector jobs should align with those patterns and reuse envelope/error conventions.

### Git Intelligence Summary

Current codebase already has strict connection/session envelopes and typed contracts. Extend existing contract module rather than creating ad-hoc inspector channels.

### Latest Tech Information

- Redis hash/list/set/zset scans can return variable-size batches; viewers must tolerate irregular pagination.
- Value rendering must remain responsive with explicit cap signals instead of attempting full fetch.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 2.3)
- `_bmad-output/planning-artifacts/prd.md` (FR19, FR20, NFR4, NFR6, NFR16)
- `_bmad-output/planning-artifacts/architecture.md` (workers/jobs/caps guidance)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (safe viewer behavior)
- `_bmad-output/implementation-artifacts/2-1-redis-key-discovery-prefix-browse-search-with-progressive-cancelable-results.md`
- `_bmad-output/implementation-artifacts/2-2-redis-key-metadata-in-results-type-ttl.md`
- https://redis.io/docs/latest/commands/hscan/
- https://redis.io/docs/latest/commands/get/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added shared inspector start/progress/done contracts with discriminated result unions for `string`, `hash`, and `none`.
- Added main inspector job runner with hash cursor scanning, 1MB preview cap enforcement, and cancel support via existing job registry.
- Added renderer inspector panel integrated into explorer results with type/TTL metadata, cap badges, and partial-result rendering.
- Ran `npm run lint`, `npm run typecheck`, and `npm test` (all passing).

### Completion Notes List

- Implemented cancelable Redis inspector jobs for string and hash keys with typed progress and completion events.
- Implemented string preview byte-cap handling (`STRING_PREVIEW_LIMIT`) and hash safe chunking with cap metadata (`HASH_PREVIEW_LIMIT`, `HASH_ENTRY_LIMIT`).
- Added explicit missing-key (`type: none`) behavior without crashing the inspect workflow.
- Added renderer viewer states for large string previews and hash field tables with partial/cap messaging.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/2-3-redis-inspect-strings-and-hashes-fetch-minimal-viewer-with-safety-caps.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-02-10: Created ready-for-dev story context for Epic 2 Story 2.3.
- 2026-02-10: Implemented Redis string/hash inspector jobs, 1MB safety caps, renderer viewer states, and tests; story moved to review.
