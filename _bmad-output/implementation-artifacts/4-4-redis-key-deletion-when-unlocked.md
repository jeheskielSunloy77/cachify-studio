# Story 4.4: Redis Key Deletion (When Unlocked)

Status: done

Generated: 2026-02-12
Story Key: `4-4-redis-key-deletion-when-unlocked`

## Story

As a cache user,
I want to delete a Redis key in unlocked mode,
so that I can remove incorrect or stale cached data safely.

## Acceptance Criteria

1. **Given** unlocked mutations mode is enabled
   **When** I delete a key
   **Then** key is removed and UI confirms outcome (FR37, FR38).

## Tasks / Subtasks

- [x] Add typed IPC contract for Redis key deletion (AC: 1)
  - [x] Include key validation and explicit response metadata.
- [x] Implement main-process key delete with unlock guard (AC: 1)
  - [x] Deny delete when `safetyMode` is read-only.
  - [x] Execute delete command and return deterministic success/failure details.
- [x] Add deliberate UI interaction for delete action (AC: 1)
  - [x] Require explicit confirmation to reduce accidental deletion.
  - [x] Show clear outcome feedback and refresh key list/inspector state.
- [x] Add tests for delete safety and behavior (AC: 1)
  - [x] Main tests for gated delete command behavior.
  - [x] Renderer tests for confirmation and result messaging.

## Dev Notes

### Developer Context

Deletion is the highest-risk operation in Epic 4. This story must preserve the product’s trust posture: explicit intent, unlock guard, and unambiguous feedback.

### Technical Requirements

- Delete action must only execute in unlocked mode.
- Confirmation UX should identify target key clearly.
- Response should distinguish “deleted” vs “key not found” for accurate UI messaging.
- On success, inspector should reset or show missing state without stale data.

### Architecture Compliance

- Shared schema + contract first.
- Main process authorization + execution.
- Renderer responsible for intent confirmation and status display only.

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
- `src/main/domain/cache/clients/redis.client.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`

Likely tests to add/update:
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/register-handlers.persistence.test.ts`
- `src/main/test/register-handlers.secrets.test.ts`
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Verify delete is blocked when read-only.
- Verify delete success and key-not-found outcomes are handled correctly.
- Verify confirmation dialog/interaction is required before delete executes.
- Verify UI state refreshes and does not show deleted content after success.

### Previous Story Intelligence

Reuse mutation error and feedback conventions from Stories 4.2 and 4.3 for consistent operator experience under pressure.

### Latest Tech Information

- Current Electron renderer/main IPC flow supports explicit confirmation UX in renderer while keeping privileged deletion in main.
- Maintain envelope consistency so deletion outcomes integrate cleanly with existing status/error surfaces.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 4.4)
- `_bmad-output/planning-artifacts/prd.md` (FR37, FR38)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/4-3-redis-mutations-for-lists-sets-zsets-and-streams-when-unlocked.md`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added typed Redis key-delete IPC contract and preload bridge wiring.
- Implemented guarded delete handler and session execution (`executeRedisKeyDelete`) with deterministic deleted/not-found response handling.
- Added deliberate two-step delete confirmation interaction in explorer mutation panel.
- Added regression coverage for read-only blocking and confirmation-based delete execution.
- Validation run completed: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Redis key deletion now enforces unlocked-only policy through the central session guard path.
- UI requires explicit confirmation (`Delete key` then `Confirm delete`) before issuing delete request.
- Delete responses clearly distinguish removed keys vs already-missing keys and refresh inspector state.
- Main + renderer tests verify both safety gating and deliberate deletion behavior.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/ipc/register-handlers.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/connection-session.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/4-4-redis-key-deletion-when-unlocked.md`

## Change Log

- 2026-02-12: Created Story 4.4 and marked status ready-for-dev.
- 2026-02-12: Implemented guarded Redis key deletion with deliberate confirmation UX and regression tests; moved story to review.
- 2026-02-12: Senior review completed; fixed stale key list behavior after delete and marked story done.

## Senior Developer Review (AI)

Date: 2026-02-12  
Reviewer: Codex (GPT-5)

Outcome: Approved after fixes.

Findings fixed:
- Medium: Successful key deletion refreshed inspector but left deleted keys visible in discovery list state; updated renderer state handling to remove deleted keys immediately.
- Medium: Added renderer regression assertion to ensure deleted keys are removed from the discovery list after confirmation.

Validation:
- `npm test -- src/main/test/connection-session.service.test.ts src/renderer/test/explorer.test.tsx`
