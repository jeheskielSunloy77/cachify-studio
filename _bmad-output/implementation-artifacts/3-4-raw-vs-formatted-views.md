# Story 3.4: Raw vs Formatted Views

Status: done

Generated: 2026-02-11
Story Key: `3-4-raw-vs-formatted-views`

## Story

As a cache user,
I want to switch between raw and formatted views,
so that I can quickly validate the underlying bytes and the interpreted meaning.

## Acceptance Criteria

1. **Given** an inspected value where formatting is applicable
   **When** I switch between Raw and Formatted
   **Then** correct representation is shown without losing my place (FR31).
2. **Given** long values or expensive formatting
   **When** I toggle views
   **Then** UI remains responsive and does not block other interactions (NFR5).

## Tasks / Subtasks

- [x] Define dual-view inspector contract with explicit mode metadata (AC: 1,2)
  - [x] Include active mode and availability/fallback reasons per mode.
- [x] Implement mode toggling with stable cursor/selection preservation (AC: 1)
  - [x] Preserve scroll position and selected key context when switching modes.
- [x] Offload expensive formatting/decode work to non-blocking path (AC: 2)
  - [x] Use existing job/cancel model or worker-thread path for heavy format transforms.
- [x] Add renderer mode controls and empty/error states (AC: 1,2)
  - [x] Show why formatted mode is unavailable when decode fails.
- [x] Add tests (AC: 1,2)
  - [x] Renderer tests for mode toggling, place preservation, and fallback messaging.
  - [x] Main tests for heavy-format boundaries and cancellation.

## Dev Notes

### Developer Context

This story formalizes viewer ergonomics and trust: users can inspect meaning (formatted) without losing raw truth.

### Technical Requirements

- Raw view must always remain available unless source data is absent.
- Formatted view must show deterministic fallback when parsing fails.
- View switch should be near-instant for typical payloads and graceful for heavy payloads.

### Architecture Compliance

- Decode/format execution in main/worker layer, not renderer main thread.
- Keep response schema additions in shared contract and preload bridge.
- Reuse existing inspector panel in `RedisExplorerPanel.tsx` for minimal UI drift.

### Library / Framework Requirements

Latest registry checks run on 2026-02-11:
- `react`: latest `19.2.4`
- `vite`: latest `7.3.1`
- `electron`: latest `40.3.0` (project pinned `40.2.1`)

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/domain/cache/inspector/memcached-inspector.service.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/renderer/test/explorer.test.tsx`
- `src/main/test/redis-inspector.service.test.ts`

### Testing Requirements

- Verify mode toggling keeps key context and scroll anchor.
- Verify format failures fall back cleanly with actionable message.
- Verify long values do not freeze renderer thread during mode switch.

### Previous Story Intelligence

Story 3.3 introduces reveal-state reset behavior. Ensure mode switches do not leave revealed state active unintentionally.

### Git Intelligence Summary

Recent implementation patterns favor explicit result metadata and conservative fallback behavior; follow that for view-mode errors.

### Latest Tech Information

- React 19 concurrent rendering patterns improve UI responsiveness for state transitions, but expensive transforms still belong off-thread.
- Electron architecture guidance continues to favor compute offloading from renderer for responsiveness and stability.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 3.4)
- `_bmad-output/planning-artifacts/prd.md` (FR31, NFR5)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (Pretty/Raw model)
- `_bmad-output/implementation-artifacts/3-3-deliberate-safe-reveal-interaction.md`
- `_bmad-output/planning-artifacts/architecture.md` (worker-thread guidance)
- https://react.dev/reference/react/useTransition

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Extended inspect contract with `viewMode` request and typed view state (`requestedMode`, `activeMode`, availability, fallback reason).
- Implemented string view switching in `RedisExplorerPanel` with per-mode scroll restoration for raw/formatted transitions.
- Added formatted fallback messaging path for non-JSON and truncation cases with non-blocking inspect job workflow.
- Fixed a renderer inspect-event race by matching progress/done events with a ref-tracked active inspect job id.
- Validation: `npm run lint && npm run typecheck && npm test` passed.

### Completion Notes List

- Implemented raw/formatted dual-view behavior across contract, main inspector service, and renderer controls.
- Preserved key context and string preview scroll position when toggling between modes.
- Kept formatting work on the existing inspect job path (main process), preserving cancelability and renderer responsiveness.
- Added/updated main and renderer tests for mode metadata, toggle behavior, depth-cap handling, and unavailable formatted fallback states.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-4-raw-vs-formatted-views.md`

## Senior Developer Review (AI)

### Reviewer

Jay (Senior Developer Review Workflow)

### Outcome

Changes Requested -> Fixed -> Approved

### Findings

- HIGH `[fixed]` Raw-mode responses could still report `maxDepthApplied=20`, conflating formatted depth-cap metadata with raw rendering behavior.
- MEDIUM `[fixed]` Scroll restoration assertion had a race in renderer tests; behavior was correct but validation was flaky without async wait.
- LOW `[fixed]` Story remained in `review` and required status/sprint sync after revalidation.

## Change Log

- 2026-02-11: Implemented Story 3.4 raw/formatted mode switching with scroll preservation, typed view metadata, formatted fallback messaging, and regression-tested behavior; story moved to review.
- 2026-02-11: Senior review corrected raw-view depth metadata semantics, hardened scroll-restoration test timing, and moved story to done.
