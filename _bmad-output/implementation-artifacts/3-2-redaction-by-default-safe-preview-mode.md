# Story 3.2: Redaction-by-Default Safe Preview Mode

Status: ready-for-dev

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

- [ ] Define shared redaction policy contract and result metadata (AC: 1,2)
  - [ ] Include policy id/version and redacted segment counts.
  - [ ] Ensure policy metadata is present in inspector responses.
- [ ] Implement redaction-by-default pipeline in main inspector services (AC: 1)
  - [ ] Apply redaction before renderer output for both formatted and raw-safe previews.
  - [ ] Reuse deterministic masking rules for common secret patterns.
- [ ] Add renderer redaction indicators and policy badges (AC: 2)
  - [ ] Show redaction status at inspector header.
  - [ ] Expose short policy summary and tooltip details.
- [ ] Add tests (AC: 1,2)
  - [ ] Main tests for masking behavior and policy metadata.
  - [ ] Renderer tests for visible redaction indicators.

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

- Story context authored for implementation handoff.

### Completion Notes List

- Story context completed with implementation guardrails.

### File List

- `_bmad-output/implementation-artifacts/3-2-redaction-by-default-safe-preview-mode.md`
