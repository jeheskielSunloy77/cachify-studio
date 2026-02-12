# Story 4.5: Memcached Set by Key (When Unlocked)

Status: done

Generated: 2026-02-12
Story Key: `4-5-memcached-set-by-key-when-unlocked`

## Story

As a cache user,
I want to set a Memcached value by key in unlocked mode,
so that I can test or correct cached values intentionally.

## Acceptance Criteria

1. **Given** unlocked mutations mode is enabled on a Memcached connection
   **When** I set a value by key
   **Then** operation succeeds or fails with clear feedback (FR26, FR38).

## Tasks / Subtasks

- [x] Add typed IPC contract for Memcached set operation (AC: 1)
  - [x] Include key, value payload, and optional write parameters (e.g., flags/ttl if in scope).
  - [x] Define stable success/failure envelope.
- [x] Implement Memcached set in main domain with unlock guard (AC: 1)
  - [x] Deny writes when read-only.
  - [x] Execute write through memcached client path and map protocol/network errors.
- [x] Extend renderer Memcached panel for guarded write action (AC: 1)
  - [x] Show clear blocked message when not unlocked.
  - [x] Show success/failure feedback and optional post-write re-fetch path.
- [x] Add tests for Memcached write guard and outcomes (AC: 1)
  - [x] Main tests for command path and error mapping.
  - [x] Renderer tests for unlocked/read-only behavior and user feedback.

## Dev Notes

### Developer Context

This story closes Epic 4 by extending unlocked-only mutation capability to Memcached, matching the same guardrail UX and IPC patterns used for Redis mutation stories.

### Technical Requirements

- Validate Memcached key constraints before write.
- Enforce unlocked-only mutation policy in main process.
- Return actionable typed errors for invalid key, timeout, protocol failure, or not connected.
- Keep write feedback explicit and avoid optimistic-success UI.

### Architecture Compliance

- Define shared schemas/contracts in `src/shared/ipc/ipc.contract.ts`.
- Implement main handlers in `src/main/ipc/register-handlers.ts`.
- Implement or extend memcached client command support in `src/main/domain/cache/clients/memcached.client.ts`.
- Keep renderer integration in `src/renderer/features/explorer/RedisExplorerPanel.tsx` Memcached section.

### Library / Framework Requirements

Latest registry checks run on 2026-02-12:
- `electron`: latest `40.4.0`
- `react`: latest `19.2.4`
- `zod`: latest `4.3.6`

No dependency changes are required for this story.

### File Structure Requirements

Primary files to inspect/update:
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/ipc/register-handlers.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/domain/cache/clients/memcached.client.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`

Likely tests to add/update:
- `src/main/test/memcached.client.test.ts`
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/register-handlers.persistence.test.ts`
- `src/main/test/register-handlers.secrets.test.ts`
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Verify Memcached set is blocked in read-only mode.
- Verify Memcached set succeeds when unlocked and reports clear success state.
- Verify invalid key/protocol/network failures map to actionable errors.
- Verify UI feedback is consistent with other mutation operations.

### Previous Story Intelligence

Maintain parity with Redis mutation safety patterns from Stories 4.2-4.4 so operators see one coherent unlock/write/relock model across cache types.

### Latest Tech Information

- Current memcached integration in this repo uses custom text-protocol client logic; extend it carefully with strict parser/response checks.
- Keep request/response envelopes consistent to avoid renderer-side branching complexity.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 4.5)
- `_bmad-output/planning-artifacts/prd.md` (FR26, FR38)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/4-4-redis-key-deletion-when-unlocked.md`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added typed Memcached set IPC contract, schema validation, and preload API wiring.
- Extended memcached client with `set` command support, payload writer, and protocol/argument validation.
- Implemented guarded main-process set execution and handler integration using central mutation policy checks.
- Added renderer Memcached write controls with read-only blocked feedback, success feedback, and post-write refetch behavior.
- Added main/renderer regression tests for blocked and unlocked Memcached set paths.
- Validation run completed: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Memcached key writes now run through typed contract/handler flow and are blocked unless the session is unlocked.
- Client-side Memcached protocol handling now supports `set` with deterministic parsing for `STORED` and `NOT_STORED`.
- Renderer surfaces clear blocked messaging in read-only mode and success/error feedback when unlocked.
- Test coverage now includes client protocol behavior plus UI/handler safety enforcement for Memcached writes.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/ipc/register-handlers.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/domain/cache/clients/memcached.client.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/memcached.client.test.ts`
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/register-handlers.mutations.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/4-5-memcached-set-by-key-when-unlocked.md`

## Change Log

- 2026-02-12: Created Story 4.5 and marked status ready-for-dev.
- 2026-02-12: Implemented unlocked-only Memcached set support across client/domain/IPC/renderer layers with regression tests; moved story to review.
- 2026-02-12: Senior review completed; validated memcached set mutation guardrails/outcomes and marked story done.

## Senior Developer Review (AI)

Date: 2026-02-12  
Reviewer: Codex (GPT-5)

Outcome: Approved.

Findings:
- No high/medium defects found in memcached set write path, error mapping, or renderer feedback behavior.

Validation:
- `npm test -- src/main/test/memcached.client.test.ts src/main/test/connection-session.service.test.ts src/main/test/register-handlers.mutations.test.ts src/renderer/test/explorer.test.tsx`
