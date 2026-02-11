# Story 3.1: Safe Value Preview Limits and "Cap Reached" States

Status: ready-for-dev

Generated: 2026-02-11
Story Key: `3-1-safe-value-preview-limits-and-cap-reached-states`

## Story

As a cache user,
I want value previews to be safe and fast even for large payloads,
so that the app stays responsive under pressure.

## Acceptance Criteria

1. **Given** an inspected value
   **When** decoded output is within limits
   **Then** it renders quickly and UI remains responsive (NFR4, NFR5).
2. **Given** an inspected value exceeds default preview limit
   **When** I open it in the inspector
   **Then** app shows a clear "too large to preview safely" state with partial preview when feasible (NFR16).
3. **Given** structured rendering would exceed depth limits
   **When** I view formatted output
   **Then** app truncates/collapses beyond limit with clear indicators (NFR17).

## Tasks / Subtasks

- [ ] Add explicit preview-cap contract metadata for all inspector result types (AC: 1,2,3)
  - [ ] Include `capReached`, `capReason`, `previewBytes`, and `maxDepthApplied` in typed payloads.
  - [ ] Preserve structured-clone-safe envelope shape.
- [ ] Implement size/depth cap enforcement in main inspector services (AC: 1,2,3)
  - [ ] Apply 1 MB decoded preview limit before renderer display.
  - [ ] Apply structured depth cap of 20 levels for formatted rendering.
- [ ] Add renderer cap-reached UI states in inspector (AC: 2,3)
  - [ ] Show clear "too large" and "depth collapsed" states with context.
  - [ ] Keep partial preview readable and non-blocking.
- [ ] Ensure cancelability and responsiveness for heavy decode paths (AC: 1)
  - [ ] Reuse existing progressive/cancelable operation patterns.
- [ ] Add tests (AC: 1,2,3)
  - [ ] Main tests for cap decisions and metadata output.
  - [ ] Renderer tests for cap banners, partial preview, and collapse indicators.

## Dev Notes

### Developer Context

Epic 2 delivered multi-type inspection. This story adds hard reliability guardrails so inspector rendering remains responsive under large payload pressure.

### Technical Requirements

- Enforce caps in main process before data reaches renderer.
- Keep behavior deterministic across Redis and Memcached inspector outputs.
- Use explicit cap metadata in every limited response so UI never infers limits implicitly.

### Architecture Compliance

- Main owns decode/cap logic: `src/main/domain/cache/inspector/*`.
- Renderer remains presentation-only through preload APIs.
- Keep typed contracts in `src/shared/ipc/ipc.contract.ts` with envelope format.

### Library / Framework Requirements

Latest registry checks run on 2026-02-11:
- `electron`: latest `40.3.0` (project pinned `40.2.1`)
- `react`: latest `19.2.4` (project uses `^19.2.0`)
- `vite`: latest `7.3.1` (project uses `^7.3.1`)
- `vitest`: latest `4.0.18` (project uses `^4.0.18`)

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/domain/cache/inspector/memcached-inspector.service.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/main/test/memcached-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Verify exact 1 MB boundary behavior (just below, equal, just above).
- Verify nested structures collapse at depth limit with stable indicator text.
- Verify heavy decode path remains cancelable and UI does not freeze.

### Previous Story Intelligence

From Story 2.7 and Epic 2 review: keep cancellation-aware metadata enrichment and strict validation of input parameters to avoid expensive invalid requests.

### Git Intelligence Summary

Recent commits use vertical slices (contract -> main -> preload -> renderer -> tests). Follow the same pattern and avoid introducing untyped IPC shortcuts.

### Latest Tech Information

- Electron security guidance continues to require strict process boundaries and preload-only renderer privileges.
- React rendering behavior in v19 supports responsive progressive UI updates; keep expensive transforms out of renderer thread.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 3.1)
- `_bmad-output/planning-artifacts/prd.md` (NFR4, NFR5, NFR16, NFR17)
- `_bmad-output/planning-artifacts/architecture.md` (worker/main boundaries, typed IPC)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (calm failure states, inspector behavior)
- `_bmad-output/implementation-artifacts/2-7-memcached-server-statistics.md`
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

- `_bmad-output/implementation-artifacts/3-1-safe-value-preview-limits-and-cap-reached-states.md`
