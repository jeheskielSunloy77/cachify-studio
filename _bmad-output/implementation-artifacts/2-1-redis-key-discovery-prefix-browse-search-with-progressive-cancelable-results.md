# Story 2.1: Redis Key Discovery (Prefix Browse + Search) with Progressive, Cancelable Results

Status: ready-for-dev

Generated: 2026-02-10
Story Key: `2-1-redis-key-discovery-prefix-browse-search-with-progressive-cancelable-results`

## Story

As a cache user,
I want to browse Redis keys via prefix/tree navigation and search by substring/pattern,
so that I can find the right key fast without freezing the app.

## Acceptance Criteria

1. **Given** an active Redis connection
   **When** I browse keys by prefix/tree navigation
   **Then** I can drill into prefixes and see matching keys (FR16).
2. **Given** an active Redis connection
   **When** I run a substring/pattern search
   **Then** results begin streaming quickly and I can cancel the search (FR17, NFR3, NFR5).
3. **Given** a large keyspace or long-running scan
   **When** results are incomplete due to limits/caps
   **Then** the UI shows explicit in-progress/limit states with safe next actions (NFR3, NFR6).

## Tasks / Subtasks

- [ ] Implement Redis key discovery job in main process (AC: 1,2,3)
  - [ ] Add contract channels for `redisKeys:search:start`, `jobs:cancel`, and progress/done events in `src/shared/ipc/ipc.contract.ts`
  - [ ] Add main-process job orchestration and cancellation wiring in `src/main/ipc/register-handlers.ts`
  - [ ] Implement incremental SCAN-based discovery with MATCH + COUNT hints and cursor continuation.
- [ ] Implement prefix tree derivation and streaming merge behavior (AC: 1,2)
  - [ ] Normalize key namespace segments for stable prefix grouping.
  - [ ] Stream partial key batches while preserving deterministic ordering in UI.
- [ ] Add renderer search + cancel UX (AC: 2,3)
  - [ ] Add search input, in-progress indicator, cancel control, and cap-reached messaging.
  - [ ] Keep interactions keyboard-first and maintain visible trust/safety state.
- [ ] Add limits and guardrails (AC: 3)
  - [ ] Cap max scanned keys/time budget per job.
  - [ ] Return explicit continuation guidance instead of blocking.
- [ ] Add tests (AC: 1,2,3)
  - [ ] Main tests for scan iteration, cancellation, and cap behavior.
  - [ ] Renderer tests for progressive results and cancellation states.

## Dev Notes

### Developer Context

This starts Epic 2 and establishes the explorer job model for all later data-inspection stories. Use main-process IO only and preload/API bridge for renderer access.

### Technical Requirements

- Use SCAN-family iteration, never KEYS, for production-safe discovery.
- Treat SCAN cursor as opaque state and continue until cursor `0` or cancellation.
- Support duplicate key handling in client aggregation.
- Streaming must be incremental and cancelable.

### Architecture Compliance

- Renderer must not open sockets or run Redis protocol directly.
- Main process owns network and long-running work.
- IPC envelopes must remain `{ ok: true, data }` or `{ ok: false, error }`.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`
- `ioredis`: `5.9.2` (reference only; current codebase uses native socket Redis client)

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/explorer/` (new)
- `src/main/jobs/` (new or equivalent under `src/main/domain/cache/explorer`)
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/` (new)
- `src/renderer/test/` and `src/main/test/`

### Testing Requirements

- Verify first results appear before full scan completion.
- Verify cancellation stops additional progress events.
- Verify cap-reached state includes actionable next steps.

### Git Intelligence Summary

Recent commits show stable envelope-driven IPC and main-owned session logic. Reuse this pattern; do not bypass with renderer-side networking.

### Latest Tech Information

- Redis SCAN remains the recommended incremental key iteration mechanism and may return duplicates; client must de-duplicate and rely on cursor completion semantics.
- COUNT is a hint, not a strict batch size; design UI for variable batch sizes.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 2.1)
- `_bmad-output/planning-artifacts/architecture.md` (IPC/job model, process boundaries)
- `_bmad-output/planning-artifacts/prd.md` (FR16, FR17, NFR3, NFR5, NFR6)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (progressive/cancelable UX)
- https://redis.io/docs/latest/commands/scan/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Pending implementation.

### Completion Notes List

- Story context created with exhaustive artifact and protocol analysis.

### File List

- `_bmad-output/implementation-artifacts/2-1-redis-key-discovery-prefix-browse-search-with-progressive-cancelable-results.md`

## Change Log

- 2026-02-10: Created ready-for-dev story context for Epic 2 Story 2.1.
