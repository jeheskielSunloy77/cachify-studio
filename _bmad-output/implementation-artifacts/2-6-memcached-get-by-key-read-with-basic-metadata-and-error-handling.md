# Story 2.6: Memcached Get by Key (Read) with Basic Metadata and Error Handling

Status: ready-for-dev

Generated: 2026-02-10
Story Key: `2-6-memcached-get-by-key-read-with-basic-metadata-and-error-handling`

## Story

As a cache user,
I want to fetch a Memcached value by key,
so that I can verify what is currently cached.

## Acceptance Criteria

1. **Given** an active Memcached connection
   **When** I enter a key and request a fetch
   **Then** app retrieves the value by key (FR25).
2. **Given** Memcached exposes metadata for a fetched value
   **When** fetch succeeds
   **Then** app displays basic metadata when available (FR28).
3. **Given** fetch fails (missing key, network error)
   **When** request completes
   **Then** app shows actionable error and remains recoverable (NFR7).

## Tasks / Subtasks

- [ ] Add Memcached key fetch IPC contract (AC: 1,2,3)
  - [ ] Define request/response payload with key, value preview, and metadata fields.
- [ ] Implement `get` operation in main Memcached client flow (AC: 1,2)
  - [ ] Parse text-protocol response safely.
  - [ ] Capture metadata (`flags`, `bytes`) when available.
- [ ] Implement recoverable error mapping (AC: 3)
  - [ ] Normalize missing key and connection failures into actionable envelope codes.
- [ ] Add renderer fetch UX (AC: 1,2,3)
  - [ ] Key input, fetch action, success panel, and inline recovery guidance.
- [ ] Add tests (AC: 1,2,3)
  - [ ] Main tests for hit/miss/error protocol handling.
  - [ ] Renderer tests for success/error states and retry flow.

## Dev Notes

### Developer Context

This is the first Memcached data-inspection story and should align UI/contract semantics with Redis inspector patterns where possible.

### Technical Requirements

- Keep protocol parsing robust for partial socket chunks and multi-line responses.
- Enforce safe preview caps before rendering value.
- Preserve explicit distinction between `NOT_FOUND` and transport failures.

### Architecture Compliance

- Continue using main-owned socket client in `src/main/domain/cache/clients/memcached.client.ts`.
- Renderer must consume preload-exposed typed APIs only.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`
- `memjs`: `1.3.2` (reference only; optional if replacing custom client, not required)

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/clients/memcached.client.ts`
- `src/main/domain/cache/inspector/memcached-inspector.service.ts` (new)
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/` or `src/renderer/features/inspector/`
- `src/main/test/` and `src/renderer/test/`

### Testing Requirements

- Verify hit/miss and network timeout behavior.
- Verify metadata rendering is optional but stable when absent.

### Previous Story Intelligence

Stories 2.1-2.5 establish progressive UX and inspector safety caps. Apply the same cap and error affordance style for Memcached fetches.

### Git Intelligence Summary

Current memcached client already uses text protocol and explicit error strings. Extend without introducing incompatible error-shape drift.

### Latest Tech Information

- Memcached protocol docs identify `stats` and `get` text commands as canonical for broad compatibility.
- Binary protocol is deprecated in modern memcached docs; keep to text/meta protocol paths.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 2.6)
- `_bmad-output/planning-artifacts/prd.md` (FR25, FR28, NFR7)
- `_bmad-output/planning-artifacts/architecture.md` (main process boundaries)
- `src/main/domain/cache/clients/memcached.client.ts`
- https://docs.memcached.org/protocols/basic/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Pending implementation.

### Completion Notes List

- Story context created with Memcached fetch/error handling guidance.

### File List

- `_bmad-output/implementation-artifacts/2-6-memcached-get-by-key-read-with-basic-metadata-and-error-handling.md`

## Change Log

- 2026-02-10: Created ready-for-dev story context for Epic 2 Story 2.6.
