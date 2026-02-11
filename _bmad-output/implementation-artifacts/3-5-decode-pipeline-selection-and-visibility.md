# Story 3.5: Decode Pipeline Selection and Visibility

Status: ready-for-dev

Generated: 2026-02-11
Story Key: `3-5-decode-pipeline-selection-and-visibility`

## Story

As a cache user,
I want to apply a decode pipeline and see which decode is active,
so that I can understand how the app is interpreting the value.

## Acceptance Criteria

1. **Given** an inspected value
   **When** I choose a decode pipeline (e.g., raw text, JSON pretty)
   **Then** viewer updates and indicates active decoding choice (FR32).
2. **Given** decoding fails or is unsupported
   **When** pipeline runs
   **Then** app shows guided failure state and safe fallback actions (NFR7).

## Tasks / Subtasks

- [ ] Define decode pipeline catalog and active-stage contract (AC: 1,2)
  - [ ] Include supported pipeline ids, labels, and capability flags.
  - [ ] Return active pipeline and stage outcome metadata in inspector response.
- [ ] Implement decode pipeline execution and error classification (AC: 1,2)
  - [ ] Add deterministic stage sequencing and bounded execution.
  - [ ] Map failures to actionable typed errors.
- [ ] Add pipeline selector UI and active-state visibility (AC: 1)
  - [ ] Show selected pipeline in inspector header/context line.
  - [ ] Persist last used pipeline only as preference (not value content).
- [ ] Implement guided fallback UX for unsupported/failed decode (AC: 2)
  - [ ] Offer fallback actions: Raw view, alternate pipeline, export partial/raw.
- [ ] Add tests (AC: 1,2)
  - [ ] Main tests for pipeline stage outcomes and error mapping.
  - [ ] Renderer tests for selector behavior and failure guidance.

## Dev Notes

### Developer Context

This story makes interpretation explicit and inspectable so developers can trust what they are seeing.

### Technical Requirements

- Pipeline execution must be bounded by same cap model from Story 3.1.
- Active pipeline must be visible in UI at all times during inspection.
- Decode failure messages must include safe next actions and avoid exposing secrets.

### Architecture Compliance

- Keep pipeline implementation in main inspector domain (optionally worker-backed for heavy transforms).
- Extend typed IPC schemas and preload API for pipeline selection.
- Avoid renderer-owned decoding logic that can drift from backend behavior.

### Library / Framework Requirements

Latest registry checks run on 2026-02-11:
- `zod`: latest `4.3.6` (project uses `^4.1.5`)
- `react`: latest `19.2.4`
- `electron`: latest `40.3.0` (project pinned `40.2.1`)

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/domain/cache/inspector/memcached-inspector.service.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/main/test/memcached-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Verify pipeline selection updates output and active indicator consistently.
- Verify unsupported decode produces guided, actionable fallback state.
- Verify failure mapping keeps UI recoverable without restart.

### Previous Story Intelligence

Story 3.4 established raw/formatted view boundaries. Keep pipeline state orthogonal so users can recover to raw truth immediately.

### Git Intelligence Summary

Recent commits emphasize explicit error envelopes and cancellation support. Apply the same to decode stage failures and long-running transforms.

### Latest Tech Information

- Modern React + Vite stack handles responsive mode changes well when heavy decode work is off-thread.
- Zod v4 compatibility in this codebase should be validated carefully before schema helper additions.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 3.5)
- `_bmad-output/planning-artifacts/prd.md` (FR32, NFR7)
- `_bmad-output/planning-artifacts/architecture.md` (worker threads, IPC contracts)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (decode-first interpretation)
- `_bmad-output/implementation-artifacts/3-4-raw-vs-formatted-views.md`
- https://zod.dev/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Story context authored for implementation handoff.

### Completion Notes List

- Story context completed with implementation guardrails.

### File List

- `_bmad-output/implementation-artifacts/3-5-decode-pipeline-selection-and-visibility.md`
