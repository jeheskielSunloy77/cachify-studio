# Story 4.3: Redis Mutations for Lists, Sets, ZSets, and Streams (When Unlocked)

Status: done

Generated: 2026-02-12
Story Key: `4-3-redis-mutations-for-lists-sets-zsets-and-streams-when-unlocked`

## Story

As a cache user,
I want to mutate Redis collection and stream types in unlocked mode,
so that I can apply targeted edits across common data structures.

## Acceptance Criteria

1. **Given** unlocked mutations mode is enabled
   **When** I push a list element, add a set member, add a zset member with score, or add a stream entry
   **Then** operation succeeds or fails with clear feedback (FR34, FR36, FR38).

## Tasks / Subtasks

- [x] Add typed IPC contracts for list/set/zset/stream mutation operations (AC: 1)
  - [x] Define request payloads with type-appropriate fields and validation.
  - [x] Define stable success/failure envelopes.
- [x] Implement main-process write execution with central unlock guard (AC: 1)
  - [x] Reuse Story 4.1 gating path before running any write command.
  - [x] Map Redis command errors into actionable error codes/messages.
- [x] Add renderer mutation controls for supported types (AC: 1)
  - [x] Show type-specific forms (list push, set add, zset add+score, stream add fields).
  - [x] Provide clear operation feedback and post-mutation refresh strategy.
- [x] Ensure safe handling of malformed inputs and large payloads (AC: 1)
  - [x] Validate inputs before IPC call and again in shared schemas.
- [x] Add regression tests for each type-specific mutation path (AC: 1)
  - [x] Main tests for command construction, gating, and error mapping.
  - [x] Renderer tests for control behavior and feedback messaging.

## Dev Notes

### Developer Context

This story expands mutation coverage to Redis collection and stream types after string/hash support. Keep operation semantics explicit and avoid hidden multi-command side effects.

### Technical Requirements

- List write: append or prepend semantics must be explicit in API/UX.
- Set write: member add should report whether new member was added vs already existed.
- ZSet write: validate score input and preserve numeric precision contract.
- Stream write: accept field/value pairs and validate non-empty field names.
- All operations must be denied when `safetyMode !== 'unlocked'`.

### Architecture Compliance

- Contract-first implementation in `src/shared/ipc/ipc.contract.ts`.
- Main handler orchestration in `src/main/ipc/register-handlers.ts`.
- Redis command execution in main domain/client layer only.
- Renderer remains orchestration and messaging layer.

### Library / Framework Requirements

Latest registry checks run on 2026-02-12:
- `electron`: latest `40.4.0` (project pinned `40.2.1`)
- `react`: latest `19.2.4` (project `^19.2.0`)
- `zod`: latest `4.3.6` (project `^4.1.5`)

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

- Verify each type-specific mutation is blocked when read-only.
- Verify each type-specific mutation succeeds and surfaces feedback when unlocked.
- Verify invalid inputs are rejected with clear validation errors.
- Verify inspector/list state refresh reflects mutation outcomes.

### Previous Story Intelligence

Build on Story 4.2 mutation contract style and error-envelope consistency to avoid per-type divergence in renderer behavior.

### Latest Tech Information

- Existing repository pattern already supports high-volume read operations via jobs; these writes should remain direct request/response but must keep envelopes consistent.
- Keep structured validation close to shared IPC schemas to prevent renderer/main mismatch.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 4.3)
- `_bmad-output/planning-artifacts/prd.md` (FR34, FR36, FR38)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/4-2-redis-mutations-for-strings-and-hashes-when-unlocked.md`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added typed IPC channels/schemas for list push, set add, zset add, and stream add operations.
- Implemented guarded main-process handlers plus session execution methods (`executeRedisListPush`, `executeRedisSetAdd`, `executeRedisZSetAdd`, `executeRedisStreamAdd`).
- Extended explorer mutation UI with type-specific controls, score parsing, and stream entry parsing/validation before dispatch.
- Added regression coverage for type-specific mutation paths and invalid payload handling.
- Validation run completed: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Redis collection/stream mutation operations are now available end-to-end behind the central unlock guard.
- Contracts and handlers enforce deterministic payload validation and envelope responses for all four operation types.
- Renderer provides explicit type-specific controls and clear inline feedback for success/failure outcomes.
- Tests cover command-path behavior and malformed input rejection without regressing inspect flows.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/ipc/register-handlers.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/register-handlers.mutations.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/4-3-redis-mutations-for-lists-sets-zsets-and-streams-when-unlocked.md`

## Change Log

- 2026-02-12: Created Story 4.3 and marked status ready-for-dev.
- 2026-02-12: Implemented unlocked-only list/set/zset/stream mutations (contracts, handlers, renderer controls, and tests) and moved story to review.
- 2026-02-12: Senior review completed; added broader read-only mutation guard regression coverage and marked story done.

## Senior Developer Review (AI)

Date: 2026-02-12  
Reviewer: Codex (GPT-5)

Outcome: Approved after fixes.

Findings fixed:
- Medium: Read-only gating tests did not explicitly cover list/set/zset/stream mutation methods; expanded regression assertions to cover all collection mutation operations under read-only mode.

Validation:
- `npm test -- src/main/test/connection-session.service.test.ts src/renderer/test/explorer.test.tsx`
