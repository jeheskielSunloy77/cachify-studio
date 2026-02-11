# Story 3.5: Decode Pipeline Selection and Visibility

Status: done

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

- [x] Define decode pipeline catalog and active-stage contract (AC: 1,2)
  - [x] Include supported pipeline ids, labels, and capability flags.
  - [x] Return active pipeline and stage outcome metadata in inspector response.
- [x] Implement decode pipeline execution and error classification (AC: 1,2)
  - [x] Add deterministic stage sequencing and bounded execution.
  - [x] Map failures to actionable typed errors.
- [x] Add pipeline selector UI and active-state visibility (AC: 1)
  - [x] Show selected pipeline in inspector header/context line.
  - [x] Persist last used pipeline only as preference (not value content).
- [x] Implement guided fallback UX for unsupported/failed decode (AC: 2)
  - [x] Offer fallback actions: Raw view, alternate pipeline, export partial/raw.
- [x] Add tests (AC: 1,2)
  - [x] Main tests for pipeline stage outcomes and error mapping.
  - [x] Renderer tests for selector behavior and failure guidance.

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

- Added decode pipeline request/response metadata to shared IPC contract (`raw-text`, `json-pretty`, stage status, typed fallback codes/actions).
- Implemented decode pipeline selection/fallback logic in Redis inspector service with bounded formatted execution and deterministic fallback to raw.
- Added renderer decode visibility badge and pipeline fallback guidance actions in inspector.
- Added decode preference persistence in renderer using localStorage (`cachify.decodePipelinePreference`).
- Validation: `npm run lint && npm run typecheck && npm test` passed.

### Completion Notes List

- Implemented typed decode pipeline catalog and stage metadata for inspector outputs.
- Added deterministic decode fallback mapping (`VALUE_NOT_FORMATTABLE_AS_JSON`, `PREVIEW_TRUNCATED_BEFORE_DECODE`, `TYPE_HAS_NO_PIPELINE`) with safe suggested actions.
- Exposed active decode choice in inspector header and applied persisted pipeline preference to new inspect actions.
- Added tests for decode success/fallback behavior (main) and decode selection/fallback guidance (renderer).

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-5-decode-pipeline-selection-and-visibility.md`

## Senior Developer Review (AI)

### Reviewer

Jay (Senior Developer Review Workflow)

### Outcome

Changes Requested -> Fixed -> Approved

### Findings

- HIGH `[fixed]` Renderer fallback mapping used `PREVIEW_TRUNCATED_BEFORE_FORMATTING` while main emits `PREVIEW_TRUNCATED_BEFORE_DECODE`, causing incorrect guidance text for truncated decode failures.
- MEDIUM `[fixed]` No regression test covered truncated-before-decode fallback guidance path, leaving failure-state UX unguarded.
- LOW `[fixed]` Story remained in `review` and required status/sprint sync after decode fallback corrections.

## Change Log

- 2026-02-11: Implemented Story 3.5 decode pipeline selection/visibility, typed fallback mapping, persisted decode preference, and guided fallback actions; story moved to review.
- 2026-02-11: Senior review aligned truncated decode failure-code mapping with renderer guidance, added coverage for that fallback path, and moved story to done.
