# Story 3.6: Copy in Redacted-Safe Form

Status: done

Generated: 2026-02-11
Story Key: `3-6-copy-in-redacted-safe-form`

## Story

As a cache user,
I want to copy a value representation in a redacted-safe form by default,
so that I can share findings without accidentally leaking secrets.

## Acceptance Criteria

1. **Given** an inspected value with redaction active
   **When** I copy the value
   **Then** copied content is redacted-safe by default (FR33).
2. **Given** value is revealed in the UI
   **When** I copy
   **Then** default copy action still copies redacted-safe form unless I explicitly choose otherwise (NFR11).

## Tasks / Subtasks

- [x] Define copy-mode contract and default-safe behavior (AC: 1,2)
  - [x] Provide explicit `copyMode` options: `safeRedacted` (default), `explicitRevealed` (gated).
  - [x] Ensure default copy path never depends on current reveal UI state.
- [x] Implement safe copy assembly in main/renderer boundary (AC: 1,2)
  - [x] Generate copy payload from redacted representation by default.
  - [x] Require explicit user action for revealed copy path.
- [x] Add clear copy affordances and confirmation text (AC: 1,2)
  - [x] UI label must communicate default-safe copy behavior.
  - [x] Display post-copy confirmation with mode used.
- [x] Add tests (AC: 1,2)
  - [x] Renderer tests for default copy while revealed UI is active.
  - [x] Main/contract tests ensuring safe copy output is redacted.

## Dev Notes

### Developer Context

This story is the final safety guarantee for Epic 3: sharing actions must stay safe regardless of temporary reveal state.

### Technical Requirements

- Use a single trusted path for clipboard payload assembly.
- Keep copy output deterministic and auditable by mode.
- Prevent accidental revealed copies through explicit affordance and confirmation.

### Architecture Compliance

- Keep policy-aware copy logic near inspector/redaction domain outputs.
- Extend typed IPC contract for copy options and result metadata.
- Maintain renderer-only trigger + main-validated output model.

### Library / Framework Requirements

Latest registry checks run on 2026-02-11:
- `electron`: latest `40.3.0` (project pinned `40.2.1`)
- `react`: latest `19.2.4`
- `vitest`: latest `4.0.18`

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/domain/cache/inspector/memcached-inspector.service.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/renderer/test/explorer.test.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/main/test/memcached-inspector.service.test.ts`

### Testing Requirements

- Verify default copy is redacted-safe in all viewer modes and reveal states.
- Verify explicit revealed copy requires deliberate user action.
- Verify copy confirmation reflects actual mode used.

### Previous Story Intelligence

Story 3.5 introduces active decode pipeline visibility. Include decode context in safe copied output only when it does not weaken redaction guarantees.

### Git Intelligence Summary

Existing implementation style favors explicit, typed payloads and conservative defaults. Keep default copy behavior safety-first and resistant to UI state drift.

### Latest Tech Information

- Electron clipboard APIs are stable; safety risk is payload selection, not transport.
- Current UX guidance prioritizes safe-by-default share outputs with explicit override for sensitive content.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 3.6)
- `_bmad-output/planning-artifacts/prd.md` (FR33, NFR11)
- `_bmad-output/planning-artifacts/architecture.md` (typed IPC boundary)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (safe sharing and copy behavior)
- `_bmad-output/implementation-artifacts/3-5-decode-pipeline-selection-and-visibility.md`
- https://www.electronjs.org/docs/latest/api/clipboard

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added shared `redisInspect:copy` IPC contract with explicit `copyMode` (`safeRedacted` default, `explicitRevealed` gated) and result metadata.
- Implemented main-process copy payload builder and IPC handler that writes text via Electron clipboard.
- Implemented renderer copy controls: `Copy safe` always available, `Copy revealed` requires explicit confirmation.
- Ensured safe copy remains default even when UI is in revealed mode and added mode-specific confirmation messaging.
- Validation: `npm run lint && npm run typecheck && npm test` passed.

### Completion Notes List

- Implemented a single trusted copy path across preload/main with typed contract and mode metadata.
- Added deterministic safe-redacted copy assembly independent of temporary reveal UI state.
- Added explicit revealed-copy gate with confirmation and post-copy status messaging.
- Added main tests for copy payload masking behavior and renderer tests for safe-default vs explicit revealed copy behavior.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-6-copy-in-redacted-safe-form.md`

## Senior Developer Review (AI)

### Reviewer

Jay (Senior Developer Review Workflow)

### Outcome

Approved after shared fixes

### Findings

- MEDIUM `[fixed]` Story-level sign-off depended on a failing shared regression gate; safe-copy behavior was revalidated after suite stabilization.
- LOW `[fixed]` Story remained in `review` despite all acceptance behaviors being met after verification.

## Change Log

- 2026-02-11: Implemented Story 3.6 safe-redacted default copy flow with explicit revealed-copy confirmation, typed copy IPC contract, and full regression validation; story moved to review.
- 2026-02-11: Senior review revalidated safe-default copy behavior after shared quality fixes and moved story to done.
