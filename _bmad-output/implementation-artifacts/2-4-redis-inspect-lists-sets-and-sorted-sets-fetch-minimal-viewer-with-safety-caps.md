# Story 2.4: Redis Inspect Lists, Sets, and Sorted Sets (Fetch + Minimal Viewer with Safety Caps)

Status: review

Generated: 2026-02-10
Story Key: `2-4-redis-inspect-lists-sets-and-sorted-sets-fetch-minimal-viewer-with-safety-caps`

## Story

As a cache user,
I want to inspect Redis list, set, and sorted set values,
so that I can understand ordered and collection-based data.

## Acceptance Criteria

1. **Given** a selected Redis list key
   **When** I open the inspector
   **Then** the app fetches and displays ordered elements (FR21).
2. **Given** a selected Redis set key
   **When** I open the inspector
   **Then** the app fetches and displays members (FR22).
3. **Given** a selected Redis sorted set key
   **When** I open the inspector
   **Then** the app fetches and displays members and scores (FR23).
4. **Given** results are large
   **When** I inspect a collection
   **Then** app shows partial results safely and provides explicit export-later path (NFR6, NFR18).

## Tasks / Subtasks

- [x] Extend inspector type handlers for list/set/zset (AC: 1,2,3,4)
  - [x] List fetch with bounded ranges (`LRANGE` windows).
  - [x] Set fetch with `SSCAN` incremental streaming.
  - [x] Sorted set fetch with `ZSCAN` or `ZRANGE` windows with score capture.
- [x] Unify collection viewer model (AC: 1,2,3)
  - [x] Include stable shape: `items[]`, `cursor`, `hasMore`, `isPartial`, `capReached`.
  - [x] Preserve ordering guarantees for lists and deterministic ordering strategy for set/zset display.
- [x] Render collection inspector variants (AC: 1,2,3,4)
  - [x] Type-aware headers and count hints.
  - [x] Large-result messaging with next actions.
- [x] Add tests (AC: 1,2,3,4)
  - [x] Main tests for each type and large-result limits.
  - [x] Renderer tests for type-specific rendering and partial states.

## Dev Notes

### Developer Context

This extends the inspector model introduced in 2.3. Keep a single inspect pipeline with type strategy dispatch rather than separate disconnected subsystems.

### Technical Requirements

- Enforce safe fetch windows and never load entire large collections in one call.
- For sorted sets, avoid deprecated range patterns where modern alternatives are available.
- For sets, document non-deterministic server ordering and ensure UI is explicit.

### Architecture Compliance

- Main process owns protocol IO, chunking, and cap enforcement.
- Renderer only visualizes typed payloads and user actions.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`

### File Structure Requirements

- `src/main/domain/cache/inspector/redis-collections.service.ts` (new)
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/inspector/` collection viewers
- `src/main/test/` and `src/renderer/test/`

### Testing Requirements

- Verify list order is preserved.
- Verify set/zset partial fetches remain responsive and cancelable.
- Verify cap-reached flows provide explicit export path messaging.

### Previous Story Intelligence

Story 2.3 establishes inspector envelope, cap metadata, and viewer shell. Reuse that schema and add type-specific payload branches only.

### Git Intelligence Summary

Repo conventions emphasize process boundaries and typed shared contracts. Keep all new inspect types represented in shared Zod schemas first.

### Latest Tech Information

- Redis deprecated `ZRANGEBYSCORE` in favor of `ZRANGE ... BYSCORE`; prefer modern command forms in new implementations.
- `SCAN`-family commands are cursor-driven and may return variable counts; keep UI and tests tolerant.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 2.4)
- `_bmad-output/planning-artifacts/prd.md` (FR21, FR22, FR23, NFR6, NFR18)
- `_bmad-output/planning-artifacts/architecture.md` (caps, main-process IO)
- `_bmad-output/implementation-artifacts/2-3-redis-inspect-strings-and-hashes-fetch-minimal-viewer-with-safety-caps.md`
- https://redis.io/docs/latest/commands/lrange/
- https://redis.io/docs/latest/commands/sscan/
- https://redis.io/docs/latest/commands/zrangebyscore/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Extended inspector contract union to include list/set/zset collection result variants and stable `items/cursor/hasMore/isPartial/capReached` payload shape.
- Extended main inspector service with list (`LLEN` + `LRANGE` windows), set (`SSCAN`), and zset (`ZSCAN`) handlers with safe entry/byte caps.
- Updated renderer inspector table views for list/set/zset with ordering hints and export-later cap messaging.
- Ran `npm run lint`, `npm run typecheck`, and `npm test` (all passing).

### Completion Notes List

- Implemented collection inspector handlers for list, set, and sorted set using bounded window/scan patterns.
- Added deterministic display strategy: list preserves server order, set/zset normalize lexical ordering for stable rendering.
- Added explicit cap metadata (`COLLECTION_ENTRY_LIMIT`, `COLLECTION_PREVIEW_LIMIT`) and partial state indicators.
- Added main and renderer tests for collection types, score capture, and partial/cap rendering behavior.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/2-4-redis-inspect-lists-sets-and-sorted-sets-fetch-minimal-viewer-with-safety-caps.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-02-10: Created ready-for-dev story context for Epic 2 Story 2.4.
- 2026-02-10: Implemented list/set/zset inspector handlers, unified collection payload model, renderer collection views, and tests; story moved to review.
