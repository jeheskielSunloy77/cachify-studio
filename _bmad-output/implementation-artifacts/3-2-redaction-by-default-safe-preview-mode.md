# Story 3.2: Redaction-by-Default Safe Preview Mode

Status: done

Generated: 2026-02-11
Story Key: `3-2-redaction-by-default-safe-preview-mode`

## Story

As a cache user,
I want values to be redacted by default with clear affordances,
so that I do not accidentally expose secrets during debugging or screen share.

## Acceptance Criteria

1. **Given** a value that appears sensitive
   **When** it is displayed in the inspector
   **Then** sensitive-looking segments are redacted by default (FR29, NFR11).
2. **Given** redaction is applied
   **When** I view the value
   **Then** UI clearly indicates redaction is active and what policy is applied (NFR11).

## Tasks / Subtasks

- [x] Define shared redaction policy contract and result metadata (AC: 1,2)
  - [x] Include policy id/version and redacted segment counts.
  - [x] Ensure policy metadata is present in inspector responses.
- [x] Implement redaction-by-default pipeline in main inspector services (AC: 1)
  - [x] Apply redaction before renderer output for both formatted and raw-safe previews.
  - [x] Reuse deterministic masking rules for common secret patterns.
- [x] Add renderer redaction indicators and policy badges (AC: 2)
  - [x] Show redaction status at inspector header.
  - [x] Expose short policy summary and tooltip details.
- [x] Add tests (AC: 1,2)
  - [x] Main tests for masking behavior and policy metadata.
  - [x] Renderer tests for visible redaction indicators.

## Dev Notes

### Developer Context

This story establishes privacy defaults that all later reveal/copy flows must inherit.

### Technical Requirements

- Redaction must run in main/worker layer, not as renderer-only cosmetic transform.
- Masking rules must be explicit and testable (JWT/token/key-like patterns, high-entropy segments).
- Preserve original value handling for explicit reveal workflow in Story 3.3.

### Architecture Compliance

- Add or extend redaction module under `src/main/domain/security/`.
- Integrate with inspector service outputs via typed schema changes in `src/shared/ipc/ipc.contract.ts`.
- Keep renderer limited to display logic and state signaling.

### Library / Framework Requirements

Latest registry checks run on 2026-02-11:
- `zod`: latest `4.3.6` (project uses `^4.1.5`)
- `electron`: latest `40.3.0` (project pinned `40.2.1`)
- `react`: latest `19.2.4`

### File Structure Requirements

- `src/main/domain/security/redaction.ts` (new)
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/domain/cache/inspector/memcached-inspector.service.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/main/test/memcached-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Verify sensitive patterns are masked in both Pretty and Raw-safe modes.
- Verify non-sensitive values are not over-masked.
- Verify redaction policy indicator is always visible when masking applied.

### Previous Story Intelligence

Story 3.1 introduces cap metadata conventions; reuse that explicit metadata style for redaction state and avoid hidden renderer heuristics.

### Git Intelligence Summary

Recent code emphasizes actionable error states and safe defaults. Keep redaction defaults conservative and clearly visible.

### Latest Tech Information

- Electron security guidance favors minimizing sensitive value exposure outside privileged process boundaries.
- React docs emphasize explicit state-driven rendering; represent redaction as first-class state, not implicit formatting side effect.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 3.2)
- `_bmad-output/planning-artifacts/prd.md` (FR29, NFR11)
- `_bmad-output/planning-artifacts/architecture.md` (security boundaries)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (safe-by-default viewing)
- `_bmad-output/implementation-artifacts/3-1-safe-value-preview-limits-and-cap-reached-states.md`
- https://www.electronjs.org/docs/latest/tutorial/security
- https://react.dev/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Added new redaction module `src/main/domain/security/redaction.ts` with deterministic JWT/bearer/sensitive-key/high-entropy masking rules.
- Extended shared IPC schemas with required `redaction` metadata (policy id/version/summary, redacted segment counts, applied flag).
- Wired redaction through Redis + Memcached inspector payload assembly before renderer output.
- Added renderer redaction status badges/policy display and contextual redaction summaries in inspector/memcached views.
- Validation: `npm run lint && npm run typecheck && npm test` passed.

### Completion Notes List

- Implemented redaction-by-default preview pipeline in main process and ensured policy metadata travels in typed inspector responses.
- Added policy-aware UI indicators (`Redaction active/default`, policy badge with tooltip summary).
- Added/updated tests for Redis and Memcached masking behavior plus renderer redaction visibility.

### File List

- `src/main/domain/security/redaction.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/domain/cache/inspector/memcached-inspector.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/main/test/memcached-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-2-redaction-by-default-safe-preview-mode.md`

## Senior Developer Review (AI)

### Reviewer

Jay (Senior Developer Review Workflow)

### Outcome

Changes Requested -> Fixed -> Approved

### Findings

- MEDIUM `[fixed]` Story validation gate was not reliable while the shared renderer regression suite was unstable; redaction acceptance could not be signed off with confidence.
- LOW `[fixed]` Story remained in `review` after fixes and required status/sprint sync to reflect completed quality gate.

## Change Log

- 2026-02-11: Implemented Story 3.2 redaction-by-default pipeline, policy metadata contract, and redaction UI indicators; full lint/typecheck/test passed; story moved to review.
- 2026-02-11: Senior review revalidated redaction behavior after shared test-stability fixes and moved story to done.
