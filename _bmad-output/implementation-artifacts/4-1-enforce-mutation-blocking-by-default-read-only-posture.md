# Story 4.1: Enforce Mutation Blocking by Default (Read-Only Posture)

Status: done

Generated: 2026-02-12
Story Key: `4-1-enforce-mutation-blocking-by-default-read-only-posture`

## Story

As a cache user,
I want mutation operations to be blocked unless I have explicitly unlocked mutations,
so that I cannot accidentally modify data.

## Acceptance Criteria

1. **Given** the active connection is not in unlocked mutations mode
   **When** I attempt any mutation operation in the UI
   **Then** action is blocked with a clear explanation (FR35).
2. **Given** a production-labeled profile
   **When** I connect
   **Then** mutations remain blocked by default until I explicitly unlock (FR12, FR35).

## Tasks / Subtasks

- [x] Establish a central mutation-allowed guard in main session domain (AC: 1,2)
  - [x] Add a single policy function sourced from `ConnectionStatus.safetyMode`.
  - [x] Return a typed failure envelope when mode is `readOnly`.
- [x] Apply guardrails to all write-entry points exposed in this story scope (AC: 1)
  - [x] Ensure every mutation-capable IPC handler (current and newly introduced in Epic 4) checks guard before execution.
  - [x] Keep read-only operations unaffected.
- [x] Enforce and surface default read-only posture for production sessions (AC: 2)
  - [x] Verify connect/switch/disconnect transitions always settle to `readOnly` unless explicit unlock is active.
  - [x] Ensure safety reason text is user-facing and actionable.
- [x] Provide clear UI blocking feedback and mode visibility (AC: 1,2)
  - [x] Keep “unlock mutations” explicit and deliberate.
  - [x] Show blocked-state messaging near mutation controls and in operation feedback.
- [x] Add regression tests for policy and UX guardrails (AC: 1,2)
  - [x] Main tests for blocking behavior and status transitions.
  - [x] Renderer tests for blocked interactions and messaging.

## Dev Notes

### Developer Context

Stories 1.7 and 1.8 established safety mode semantics (`readOnly` vs `unlocked`) and explicit unlock/relock flows. Story 4.1 must make this policy enforcement non-optional for all mutation paths so future mutation stories (4.2-4.5) cannot bypass guardrails.

### Technical Requirements

- Treat `readOnly` as deny-by-default for all mutating actions.
- Use one shared policy check in main process to avoid duplicated or drifting behavior.
- Standardize blocked responses with stable error code/message (for consistent renderer handling).
- Preserve existing typed IPC envelopes (`{ ok: true, data } | { ok: false, error }`).
- Do not infer “unlocked” from UI state; only trust main-process session status.

### Architecture Compliance

- Keep policy enforcement in `src/main/domain/cache/session` (source of truth).
- Keep renderer as consumer of status/events only; no renderer-side authority for mutation permission.
- Keep IPC handlers in `src/main/ipc/register-handlers.ts` thin and schema-validated.
- Maintain strict process boundaries from architecture doc: renderer -> preload -> main.

### Library / Framework Requirements

Latest registry checks run on 2026-02-12:
- `electron`: latest `40.4.0` (project pinned `40.2.1`)
- `react`: latest `19.2.4` (project `^19.2.0`)
- `zod`: latest `4.3.6` (project `^4.1.5`)
- `@electron-forge/plugin-vite`: latest `7.11.1` (project `^7.11.1`)

No dependency upgrade is required for this story; apply within existing pinned/toolchain constraints unless a separate dependency-update task is approved.

### File Structure Requirements

Primary files to inspect/update:
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/ipc/register-handlers.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/renderer/features/profiles/ProfilesPage.tsx`
- `src/renderer/app/App.tsx`

Likely tests to add/update:
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/register-handlers.persistence.test.ts`
- `src/main/test/register-handlers.secrets.test.ts`
- `src/renderer/test/profiles.test.tsx`
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Verify default posture is `readOnly` after connect/switch/disconnect for all environments, including prod.
- Verify mutation attempts in `readOnly` return deterministic blocked errors.
- Verify explicit unlock changes behavior only while session remains unlocked.
- Verify relock/disconnect/switch reset behavior immediately re-enforces blocking.
- Verify renderer presents clear blocked-state messaging and does not imply mutation succeeded.

### Latest Tech Information

- Electron 40.x security model continues to require strict main-process authority for privileged actions; keep mutation authorization checks in main, not renderer.
- Current Forge Vite plugin line is 7.11.1, matching this repo; no build-system migration is needed for policy work.
- React 19.2.x and Zod 4.3.x lines remain compatible with current app patterns used for typed UI state and IPC schema validation.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1)
- `_bmad-output/planning-artifacts/prd.md` (FR12, FR35)
- `_bmad-output/planning-artifacts/architecture.md` (process boundaries, typed IPC, safety posture)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (safe-by-default and clear blocking feedback)
- `_bmad-output/implementation-artifacts/1-7-environment-labels-and-default-safety-posture-read-only-by-default-for-prod.md`
- `_bmad-output/implementation-artifacts/1-8-unlock-and-relock-mutations-mode-with-explicit-safety-signals.md`
- https://www.npmjs.com/package/electron
- https://www.npmjs.com/package/react
- https://www.npmjs.com/package/zod
- https://www.npmjs.com/package/@electron-forge/plugin-vite

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added central mutation authorization in `connection-session.service.ts` (`ensureMutationAllowed` + `checkMutationAllowed`) and standardized blocked envelopes.
- Applied guard checks to all Redis and Memcached mutation execution paths introduced in Epic 4.
- Updated safety posture reason text on connect/switch/disconnect/relock transitions so UI guidance explicitly points to unlock intent.
- Added renderer blocked-state messaging near mutation controls and validated via `src/renderer/test/explorer.test.tsx`.
- Validation run completed: `npm run lint && npm run typecheck && npm test`.

### Completion Notes List

- Main-process mutation policy is now centralized and deny-by-default when `safetyMode` is `readOnly`.
- Read-only posture remains explicit and user-facing through updated safety reason text across connection transitions.
- Renderer now surfaces clear blocked-state context alongside mutation controls, preserving deliberate unlock semantics.
- Regression tests cover both session-level policy enforcement and UI blocked behavior.

### File List

- `src/main/domain/cache/session/connection-session.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/connection-session.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-1-enforce-mutation-blocking-by-default-read-only-posture.md`

## Change Log

- 2026-02-12: Created Story 4.1 with comprehensive mutation-blocking context and marked status ready-for-dev.
- 2026-02-12: Implemented central read-only mutation guardrails, expanded blocked-state UX/test coverage, and moved story to review.
- 2026-02-12: Senior review completed; expanded read-only regression coverage across all Redis mutation entry points and marked story done.

## Senior Developer Review (AI)

Date: 2026-02-12  
Reviewer: Codex (GPT-5)

Outcome: Approved after fixes.

Findings fixed:
- Medium: Read-only regression coverage only asserted string mutation blocking; expanded coverage to hash/list/set/zset/stream/delete mutation paths so guardrails are verified across the full Epic 4 surface.

Validation:
- `npm test -- src/main/test/connection-session.service.test.ts src/renderer/test/explorer.test.tsx`
