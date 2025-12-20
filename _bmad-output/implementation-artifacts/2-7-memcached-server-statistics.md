# Story 2.7: Memcached Server Statistics

Status: ready-for-dev

Generated: 2026-02-10
Story Key: `2-7-memcached-server-statistics`

## Story

As a cache user,
I want to view Memcached server statistics,
so that I can assess cache health quickly.

## Acceptance Criteria

1. **Given** an active Memcached connection
   **When** I open the stats view
   **Then** app displays server statistics and refreshes on demand (FR27).
2. **Given** server is unreachable or times out
   **When** stats are requested
   **Then** app reports failure with next actions and keeps UI responsive (NFR5, NFR7).

## Tasks / Subtasks

- [ ] Add Memcached stats contract and handler (AC: 1,2)
  - [ ] Define `memcached:stats:get` channel and typed payload/result.
  - [ ] Parse `stats` response into normalized map/list suitable for rendering.
- [ ] Implement on-demand refresh UX (AC: 1)
  - [ ] Add refresh action with loading state and last-updated timestamp.
- [ ] Add error + recovery UI (AC: 2)
  - [ ] Show timeout/unreachable guidance and retry action.
- [ ] Add tests (AC: 1,2)
  - [ ] Main tests for stats parsing and timeout handling.
  - [ ] Renderer tests for refresh and error/retry behavior.

## Dev Notes

### Developer Context

This closes Epic 2 and should provide a lightweight operational view without introducing dashboard complexity reserved for later epics.

### Technical Requirements

- Stats retrieval must not block other inspector/search interactions.
- Keep parser tolerant of extended/new stat keys.
- Provide explicit units when available (bytes, counters, uptime).

### Architecture Compliance

- Main process performs stats query via Memcached client.
- Renderer consumes typed API and renders compact table/list.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/clients/memcached.client.ts`
- `src/main/domain/cache/inspector/memcached-stats.service.ts` (new)
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/` or `src/renderer/features/stats/` (new)
- `src/main/test/` and `src/renderer/test/`

### Testing Requirements

- Verify parsing with realistic multi-line `STAT` responses.
- Verify refresh can be repeated without memory leak/event duplication.

### Previous Story Intelligence

Story 2.6 establishes Memcached key-read error handling and protocol parsing conventions. Reuse those helpers and envelope patterns for stats.

### Git Intelligence Summary

Follow prior commit pattern: add shared schema + handler + preload + renderer + tests in one coherent slice; avoid hidden channel strings.

### Latest Tech Information

- Memcached `stats` text command remains the standard operational stats interface.
- Keep implementation compatible with text protocol to align with current client and broad server support.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 2.7)
- `_bmad-output/planning-artifacts/prd.md` (FR27, NFR5, NFR7)
- `_bmad-output/planning-artifacts/architecture.md` (typed IPC + main-owned IO)
- `_bmad-output/implementation-artifacts/2-6-memcached-get-by-key-read-with-basic-metadata-and-error-handling.md`
- https://docs.memcached.org/protocols/basic/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Pending implementation.

### Completion Notes List

- Story context created for Epic 2 closure with stats guidance.

### File List

- `_bmad-output/implementation-artifacts/2-7-memcached-server-statistics.md`

## Change Log

- 2026-02-10: Created ready-for-dev story context for Epic 2 Story 2.7.
