# Story 1.8: Unlock and Relock Mutations Mode with Explicit Safety Signals

Status: done

Generated: 2026-02-10
Story Key: `1-8-unlock-and-relock-mutations-mode-with-explicit-safety-signals`

## Story

As a cache user,  
I want to deliberately unlock mutations and return to read-only,  
so that write operations are always intentional.

## Acceptance Criteria

1. **Given** an active connection in read-only mode  
   **When** I explicitly unlock mutations  
   **Then** mutation-enabled state is visibly and persistently indicated (FR13) (FR15).
2. **Given** unlocked mode  
   **When** I relock  
   **Then** the connection returns to read-only mode and the UI reflects that immediately (FR14).

## Tasks / Subtasks

- [x] Add mutation mode policy model (AC: 1,2)
  - [x] Define connection safety state enum (`readOnly`, `unlocked`) in shared contracts
  - [x] Track mode in active session state with timestamps and optional reason metadata
- [x] Implement unlock/relock commands in main domain (AC: 1,2)
  - [x] Add explicit `mutations:unlock` and `mutations:relock` IPC handlers
  - [x] Require explicit confirmation payload for unlock (no accidental toggle)
  - [x] Keep relock idempotent and immediate
- [x] Add persistent safety signaling in renderer (AC: 1,2)
  - [x] Show unmissable unlocked indicators in app chrome and mutation-capable screens
  - [x] Keep read-only indicators always visible when locked
  - [x] Ensure the state transition is reflected immediately after command completion
- [x] Add optional automatic relock guardrails (recommended)
  - [x] Session switch/disconnect should force relock
  - [x] Optional timeout-based relock hook can be introduced if story scope allows
- [x] Add tests (AC: 1,2)
  - [x] Main tests for unlock/relock transitions and invalid transition handling
  - [x] Main tests ensuring switch/disconnect returns mode to read-only
  - [x] Renderer tests for explicit safety signals in both states

## Dev Notes

### Developer Context

Story 1.8 completes Epic 1 safety controls by making mutation capability explicitly gated. It depends on environment defaults from Story 1.7 and connection/session lifecycle from Story 1.5.

### Technical Requirements

- Unlock action must never occur implicitly from UI context changes.
- Mutation-enabled state must be represented in one source of truth (main session state).
- UI must indicate unlocked mode continuously until relocked/switch/disconnect.
- Mutation APIs introduced in later epics must check this mode before execution.

### Architecture Compliance

- Policy enforcement in main process domain; renderer is presentation and intent submission only.
- Contract-first IPC and envelope responses are mandatory.
- Keep consistent names and payload structure with existing connection/status APIs.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`

Implementation guidance:
- Reuse current UI component system for warnings/alerts/dialogs.
- Keep state/event updates lightweight and structured-clone-safe.

### File Structure Requirements

- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/session/*`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/app/*`
- `src/renderer/features/*` safety UX

### Testing Requirements

- Verify unlock state survives UI rerender but resets on connection end.
- Verify relock immediately blocks mutation entry points.
- Verify signals are explicit and accessible (text + icon + color).

### Previous Story Intelligence

- Story 1.7 introduced environment and default read-only posture; this story adds explicit override and return path.
- Prior stories established connection lifecycle and envelope errors; mutation mode should hook into that infrastructure, not parallel state.

### Git Intelligence Summary

Follow existing pattern of main-domain policy decisions with renderer trust/status presentation. Avoid implementing mutation gating solely in UI.

### Latest Tech Information

- Keep unlock/relock interaction auditable in local session metadata for future retrospective/debug support.
- Prefer immediate mode-change feedback over delayed polling.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.8)
- `_bmad-output/planning-artifacts/architecture.md` (read-only default and unlock posture)
- `_bmad-output/planning-artifacts/prd.md` (FR13, FR14, FR15)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (explicit safety signals)
- `_bmad-output/implementation-artifacts/1-7-environment-labels-and-default-safety-posture-read-only-by-default-for-prod.md`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Completion Notes List

- Added mutation safety model in shared contracts (`readOnly`/`unlocked`) with `safetyUpdatedAt` and optional `safetyReason` metadata.
- Implemented `mutations:unlock` (explicit confirmation required) and `mutations:relock` IPC commands and main-domain handlers.
- Extended session service with unlock/relock transitions and enforced relock-by-default on connect/switch/disconnect lifecycle.
- Added persistent unlocked/read-only safety signals in app chrome and connection area with immediate transition feedback.
- Added main and renderer tests for unlock/relock transitions, invalid confirmation handling, read-only reset behavior, and visible safety indicators.
- Completed review/fix pass and validated with `npm run lint`, `npm run typecheck`, and `npm test`.

### File List

- `_bmad-output/implementation-artifacts/1-8-unlock-and-relock-mutations-mode-with-explicit-safety-signals.md`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/app/App.tsx`
- `src/renderer/features/profiles/ProfilesPage.tsx`
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/register-handlers.persistence.test.ts`
- `src/main/test/register-handlers.secrets.test.ts`
- `src/renderer/test/profiles.test.tsx`
- `src/renderer/test/ui-foundation.test.tsx`

## Senior Developer Review (AI)

### Date

2026-02-10

### Reviewer

Jay

### Outcome

Approved after autofix.

### Findings

1. HIGH: Transition path from connected profile A to connect profile B could skip switch semantics, weakening mutation safety reset guarantees.
2. MEDIUM: Duplicate status broadcasts increased risk of transient UI churn around unlock/relock indicator transitions.
3. MEDIUM: Session test isolation did not reset singleton module state between test cases, reducing confidence in mode transition coverage.

### Autofixes Applied

- `connect` now uses `switch` when active profile differs from target.
- Removed duplicate status publish subscription in handler registration.
- Added module reset and explicit connect-as-switch regression test for session transitions.

## Change Log

- 2026-02-10: Implemented Story 1.8 explicit unlock/relock mutation mode, persistent safety signaling, and full validation.
- 2026-02-10: Senior review autofix - tightened transition semantics and improved mutation-mode status event/test stability.
