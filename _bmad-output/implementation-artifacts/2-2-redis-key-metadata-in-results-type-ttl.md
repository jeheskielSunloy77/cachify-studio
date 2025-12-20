# Story 2.2: Redis Key Metadata in Results (Type + TTL)

Status: ready-for-dev

Generated: 2026-02-10
Story Key: `2-2-redis-key-metadata-in-results-type-ttl`

## Story

As a cache user,
I want to see Redis key metadata including type and TTL when available,
so that I can choose the right keys to inspect.

## Acceptance Criteria

1. **Given** Redis key results are displayed
   **When** metadata is available
   **Then** each key can show its type and TTL (FR18).
2. **Given** TTL/type lookups are slow or fail
   **When** metadata is requested
   **Then** UI remains responsive and errors are actionable without restart (NFR5, NFR7).

## Tasks / Subtasks

- [ ] Extend key discovery pipeline with metadata fetch strategy (AC: 1,2)
  - [ ] Add bounded concurrency for TYPE/TTL lookups.
  - [ ] Allow partial metadata display while lookups continue.
- [ ] Implement resilient metadata semantics (AC: 1,2)
  - [ ] Show unknown TTL/type as explicit unavailable state.
  - [ ] Map protocol/network failures to actionable envelope errors.
- [ ] Update renderer results list (AC: 1)
  - [ ] Render key, type badge, and TTL label consistently.
  - [ ] Keep list responsive while metadata streams in.
- [ ] Add tests (AC: 1,2)
  - [ ] Main tests for mixed success/failure metadata batches.
  - [ ] Renderer tests for progressive metadata rendering and fallback states.

## Dev Notes

### Developer Context

This story builds directly on 2.1 job streaming. Do not introduce a separate fetch loop that blocks first-result latency.

### Technical Requirements

- Metadata fetch must be cancelable through the same jobId lifecycle as key discovery.
- TTL semantics must preserve Redis return meaning:
  - `-2`: key missing.
  - `-1`: key exists with no expire.
- Type/TTL retrieval must avoid head-of-line blocking.

### Architecture Compliance

- Keep mapping and retry logic in main process.
- Renderer is presentation only and consumes typed job events.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`

### File Structure Requirements

- `src/main/domain/cache/explorer/redis-key-metadata.service.ts` (new)
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/` list row components
- `src/main/test/` and `src/renderer/test/`

### Testing Requirements

- Verify TTL edge values (`-1`, `-2`) are represented correctly.
- Verify metadata timeout/failure does not drop already streamed keys.

### Previous Story Intelligence

Story 2.1 establishes the canonical scan/cancel job contract. Reuse that exact job envelope and event channels for metadata progression.

### Git Intelligence Summary

Existing code favors strict Zod validation and stable envelopes. Metadata extensions must update shared schemas first to prevent runtime drift.

### Latest Tech Information

- Redis TTL return conventions are stable and must be reflected exactly in UI semantics.
- Keep metadata retrieval in small bounded batches to preserve responsiveness under large keyspaces.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 2.2)
- `_bmad-output/planning-artifacts/prd.md` (FR18, NFR5, NFR7)
- `_bmad-output/planning-artifacts/architecture.md` (IPC envelopes, cancelable jobs)
- `_bmad-output/implementation-artifacts/2-1-redis-key-discovery-prefix-browse-search-with-progressive-cancelable-results.md`
- https://redis.io/docs/latest/commands/ttl/
- https://redis.io/docs/latest/commands/type/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Pending implementation.

### Completion Notes List

- Story context created with metadata-specific protocol guardrails.

### File List

- `_bmad-output/implementation-artifacts/2-2-redis-key-metadata-in-results-type-ttl.md`

## Change Log

- 2026-02-10: Created ready-for-dev story context for Epic 2 Story 2.2.
