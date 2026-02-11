# Story 3.3: Deliberate Safe Reveal Interaction

Status: ready-for-dev

Generated: 2026-02-11
Story Key: `3-3-deliberate-safe-reveal-interaction`

## Story

As a cache user,
I want a deliberate safe reveal interaction to view redacted content,
so that revealing secrets is an intentional action.

## Acceptance Criteria

1. **Given** redacted content in the inspector
   **When** I perform the safe reveal interaction
   **Then** content is revealed deliberately and UI clearly indicates it is revealed (FR30).
2. **Given** revealed content
   **When** I navigate away or re-lock safety state
   **Then** app re-hides revealed content to return to safe defaults (NFR11).

## Tasks / Subtasks

- [ ] Define reveal state and explicit user-intent interaction contract (AC: 1,2)
  - [ ] Add typed command/state for reveal start, reveal end, and auto-reset triggers.
- [ ] Implement reveal lifecycle in renderer with strict reset rules (AC: 1,2)
  - [ ] Support deliberate interaction pattern (explicit toggle with confirmation or press-and-hold per UX decision).
  - [ ] Auto-reset on key change, view switch, navigation, disconnect, and lock-state changes.
- [ ] Ensure default state remains redacted for copy/export entry points (AC: 2)
  - [ ] Reveal state must not implicitly change copy defaults.
- [ ] Add accessibility and keyboard support (AC: 1)
  - [ ] Clear focus behavior and visible revealed-state indicator.
- [ ] Add tests (AC: 1,2)
  - [ ] Renderer tests for reveal transitions and auto-rehide triggers.
  - [ ] Main/contract tests for reveal-safe data flow constraints.

## Dev Notes

### Developer Context

This story must preserve trust: reveal is temporary, explicit, and reversible with no ambiguity.

### Technical Requirements

- Keep redacted and revealed representations separate in state.
- Avoid persistent revealed cache in local storage.
- Respect session and connection safety state changes as hard rehide boundaries.

### Architecture Compliance

- Renderer handles reveal UI state; main remains source for redacted/reveal-capable payload.
- Preload API remains typed and minimal; avoid ad-hoc event channels.
- Align with existing connection-session safety state from `connection-session.service.ts`.

### Library / Framework Requirements

Latest registry checks run on 2026-02-11:
- `react`: latest `19.2.4`
- `electron`: latest `40.3.0` (project pinned `40.2.1`)
- `vitest`: latest `4.0.18`

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/renderer/test/explorer.test.tsx`
- `src/main/test/connection-session.service.test.ts`

### Testing Requirements

- Verify reveal requires explicit interaction and clear indicator.
- Verify reveal auto-resets on navigation and safety relock.
- Verify keyboard flow parity with pointer flow.

### Previous Story Intelligence

Story 3.2 established redaction defaults and policy metadata. Preserve that baseline and ensure reveal never mutates policy defaults globally.

### Git Intelligence Summary

Recent commit history shows strict handling for safety and cancellation. Apply same discipline to reveal state transitions and resets.

### Latest Tech Information

- React recommends state co-location and predictable cleanup; reveal lifecycle should clean up on unmount/navigation.
- Electron process isolation pattern remains unchanged; sensitive reveal transitions should remain auditable and explicit in renderer state.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 3.3)
- `_bmad-output/planning-artifacts/prd.md` (FR30, NFR11)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (deliberate reveal + anxiety reduction)
- `_bmad-output/implementation-artifacts/3-2-redaction-by-default-safe-preview-mode.md`
- `src/main/domain/cache/session/connection-session.service.ts`
- https://react.dev/learn

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Story context authored for implementation handoff.

### Completion Notes List

- Story context completed with implementation guardrails.

### File List

- `_bmad-output/implementation-artifacts/3-3-deliberate-safe-reveal-interaction.md`
