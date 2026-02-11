# Story 2.5: Redis Inspect Streams (Fetch + Minimal Viewer with Safety Caps)

Status: done

Generated: 2026-02-10
Story Key: `2-5-redis-inspect-streams-fetch-minimal-viewer-with-safety-caps`

## Story

As a cache user,
I want to inspect Redis stream data,
so that I can review recent entries and their fields.

## Acceptance Criteria

1. **Given** a selected Redis stream key
   **When** I open the inspector
   **Then** app fetches and displays entries and fields (FR24).
2. **Given** stream entry counts can be high
   **When** I inspect a stream
   **Then** app limits default fetch safely, remains responsive, and makes truncation obvious (NFR5, NFR6).

## Tasks / Subtasks

- [x] Add stream inspector handler (AC: 1,2)
  - [x] Fetch recent entries with bounded count using `XRANGE`/`XREVRANGE` strategy.
  - [x] Return entry IDs and field/value maps with explicit truncation metadata.
- [x] Add stream viewer renderer (AC: 1,2)
  - [x] Render entry id, timestamp-friendly hint, and fields.
  - [x] Show truncated/partial state with follow-up actions.
- [x] Add cancel/refresh interactions (AC: 2)
  - [x] Integrate with existing job controls for long fetch paths.
- [x] Add tests (AC: 1,2)
  - [x] Main tests for stream parsing and truncation behavior.
  - [x] Renderer tests for stream table rendering and cap messaging.

## Dev Notes

### Developer Context

Streams are structurally different from key-value and collection types. Keep stream response shape explicit and avoid overloading hash/list viewers.

### Technical Requirements

- Default fetch should be bounded (count-based) to protect UI responsiveness.
- Include explicit `truncated` signal when total entries exceed fetched subset.
- Treat field/value pairs as ordered per entry for stable display.

### Architecture Compliance

- Maintain typed inspect response unions in shared contract.
- Keep decode/redaction compatibility hooks for Epic 3.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`

### File Structure Requirements

- `src/main/domain/cache/inspector/redis-streams.service.ts` (new)
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/inspector/stream-viewer.tsx` (new)
- `src/main/test/` and `src/renderer/test/`

### Testing Requirements

- Verify stream entries with many fields still render without blocking.
- Verify truncation metadata is always present when fetch cap applies.

### Previous Story Intelligence

Stories 2.3 and 2.4 establish inspector framework, cap metadata, and type dispatch. Keep stream integration additive within that framework.

### Git Intelligence Summary

The current codebase has conservative, explicit state transitions and error envelopes. Preserve that style for stream fetch failures and cancellation.

### Latest Tech Information

- Redis `XRANGE`/`XREVRANGE` support count-limited fetches; use them to avoid unbounded stream reads.
- Stream inspection should bias toward recent entries for incident workflows.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 2.5)
- `_bmad-output/planning-artifacts/prd.md` (FR24, NFR5, NFR6)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (responsive inspector behavior)
- `_bmad-output/implementation-artifacts/2-3-redis-inspect-strings-and-hashes-fetch-minimal-viewer-with-safety-caps.md`
- `_bmad-output/implementation-artifacts/2-4-redis-inspect-lists-sets-and-sorted-sets-fetch-minimal-viewer-with-safety-caps.md`
- https://redis.io/docs/latest/commands/xrange/

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Extended inspect contract with stream request option (`streamCount`) and stream result schema (`entries[]`, `truncated`, `capReason`).
- Implemented stream inspector branch in main using `XLEN` + bounded `XREVRANGE` fetch with entry/byte caps.
- Implemented renderer stream table view and truncation guidance in inspector panel.
- Ran `npm run lint`, `npm run typecheck`, and `npm test` successfully.

### Completion Notes List

- Added stream inspection with recent-entry bias and explicit truncation metadata for high-volume streams.
- Preserved ordered field/value display per stream entry and structured-clone-safe payloads.
- Reused existing job start/cancel controls for stream inspection flow.
- Added main and renderer tests for stream parsing, truncation, and table rendering states.

### File List

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/redis-inspector.service.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `_bmad-output/implementation-artifacts/2-5-redis-inspect-streams-fetch-minimal-viewer-with-safety-caps.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

- 2026-02-11: Adversarial Epic 2 code review completed; high/medium findings were auto-fixed.
- Fixes applied: Memcached key validation hardening and cancellation-aware Redis metadata lookups.
- Validation: `npm run lint && npm run typecheck && npm test` passed.

## Change Log

- 2026-02-11: Senior Developer review completed; story advanced to done after auto-fixes and full validation.

- 2026-02-10: Created ready-for-dev story context for Epic 2 Story 2.5.
- 2026-02-10: Implemented stream inspector fetch/render flow with truncation metadata and tests; story moved to review.
