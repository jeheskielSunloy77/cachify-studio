# Story 1.5: Connect, Disconnect, and Switch Sessions with Status and Errors

Status: done

Generated: 2026-02-10
Story Key: `1-5-connect-disconnect-and-switch-sessions-with-status-and-errors`

## Story

As a cache user,  
I want to connect, disconnect, and switch between connections without restarting,  
so that I can move across environments quickly and recover from failures.

## Acceptance Criteria

1. **Given** a valid profile  
   **When** I connect  
   **Then** the app connects to the selected Redis or Memcached target (FR3) (FR4).
2. **Given** an active connection  
   **When** I disconnect or switch profiles  
   **Then** the session transitions complete without restarting the app (FR8).
3. **Given** connection attempts succeed or fail  
   **When** status changes  
   **Then** the app shows connection status and the last connection error for the active connection (FR9).  
   **And** failures provide actionable errors and the app remains recoverable (NFR7).

## Tasks / Subtasks

- [x] Add connection session domain in main process (AC: 1,2,3)
  - [x] Implement `src/main/domain/cache/clients/redis.client.ts` and `src/main/domain/cache/clients/memcached.client.ts`
  - [x] Add connection/session manager service with active-session lifecycle and safe teardown
  - [x] Support connect/disconnect/switch as idempotent operations
- [x] Add typed IPC contract for session control (AC: 1,2,3)
  - [x] Add channels: `connections:connect`, `connections:disconnect`, `connections:switch`, `connections:status:get`
  - [x] Emit standardized status updates/events for renderer synchronization
  - [x] Return actionable error envelopes (`AUTH_FAILED`, `TLS_CERT_INVALID`, `CONNECTION_REFUSED`, `TIMEOUT`)
- [x] Build renderer status UX (AC: 2,3)
  - [x] Add active connection status banner/chip with last error summary
  - [x] Keep switch flow keyboard-first and non-blocking
  - [x] Show recovery actions inline (retry, open profile settings, view details)
- [x] Integrate prompt-per-session credentials from Story 1.4 (AC: 1,3)
  - [x] If credentials are absent and policy requires prompt, request at connect-time only
  - [x] Ensure credential prompts do not block other UI interactions
- [x] Add tests (AC: 1,2,3)
  - [x] Main tests for connect/disconnect/switch state transitions and error envelopes
  - [x] Main tests for recovery after failed connections without restart
  - [x] Renderer tests for status rendering and error-action UX

## Dev Notes

### Developer Context

This story introduces live network connectivity and session orchestration over the profile/auth foundation from stories 1.3 and 1.4. The implementation must keep the app stable under failed network conditions and preserve quick switching across environments.

### Technical Requirements

- All connection IO remains in main process; renderer receives typed state snapshots and events.
- Keep a single active session per app window unless explicit multi-session design is added later.
- Switching profiles must always execute deterministic order:
  1. transition state to `switching`
  2. disconnect current session (best-effort)
  3. connect target profile
  4. publish final status
- Persist only metadata needed for UX (`lastConnectionError`, timestamps, lastConnectedProfileId), never sensitive payloads.

### Architecture Compliance

- Use contract-first IPC with envelope responses.
- Long-running network operations should be cancelable or timeout-governed to avoid lockups.
- Keep naming consistency (`snake_case` DB, `camelCase` IPC/UI).

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `react`: `19.2.4`
- `vite`: `7.3.1`

Connection client guidance:
- Select Redis/Memcached client packages compatible with Electron 40 runtime.
- Normalize low-level client errors into stable IPC error codes/messages.

### File Structure Requirements

- `src/main/domain/cache/clients/*`
- `src/main/domain/cache/session/*` (new manager)
- `src/main/ipc/register-handlers.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/renderer/features/*` status and switching UI

### Testing Requirements

- Simulate network/auth failures and assert recoverable UI state.
- Assert disconnect on switch and no stale active-client references.
- Assert status/error UI remains synchronized with backend events.

### Previous Story Intelligence

- From Story 1.4: credential policy and secure secret retrieval are mandatory preconditions for connect.
- From Story 1.3: preserve existing profile list/search UX and service contracts.

### Git Intelligence Summary

Recent changes established persistence and profile UI architecture. Reuse existing service + IPC handler style, and place connection logic under main domain modules rather than renderer.

### Latest Tech Information

- Keep dependency upgrades out-of-scope unless required by selected client libraries.
- Ensure connection timeout defaults are explicit and surfaced in user-facing errors.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.5)
- `_bmad-output/planning-artifacts/architecture.md` (IPC/job/error envelope patterns)
- `_bmad-output/planning-artifacts/prd.md` (FR3, FR4, FR8, FR9, NFR7)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (status/error feedback patterns)
- `_bmad-output/implementation-artifacts/1-4-configure-authentication-and-secure-credential-handling.md`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Completion Notes List

- Added main-process Redis and Memcached socket clients and a connection session manager with deterministic state transitions.
- Added typed connection IPC contract/channels and status event broadcasting for renderer synchronization.
- Added renderer connection status banner, connect/switch controls, disconnect/retry/settings/details recovery actions, and runtime credential prompt dialog.
- Integrated Story 1.4 prompt-per-session policy into connect-time credential flow via `CREDENTIAL_PROMPT_REQUIRED`.
- Added and passed new main/renderer tests for transitions, error handling, recovery, and runtime prompt UX.
- Completed review+fix loop and validated with `npm run lint`, `npm run typecheck`, and `npm test`.

### File List

- `_bmad-output/implementation-artifacts/1-5-connect-disconnect-and-switch-sessions-with-status-and-errors.md`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/domain/cache/clients/redis.client.ts`
- `src/main/domain/cache/clients/memcached.client.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/ipc/register-handlers.ts`
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

1. HIGH: `connections:connect` did not enforce single-session lifecycle when a different profile was already connected.
2. MEDIUM: IPC status updates were emitted twice (service subscriber + handler publish), causing duplicate renderer updates.
3. MEDIUM: Session tests reused singleton state across cases due module cache, reducing reliability of transition coverage.

### Autofixes Applied

- `connect` now delegates to `switch` when target profile differs from active profile.
- Removed duplicate status publisher subscription in IPC registration.
- Added module reset in session tests and regression coverage for connect-as-switch behavior.

## Change Log

- 2026-02-10: Implemented Story 1.5 connection session lifecycle, connection IPC/status events, renderer status/recovery UX, and prompt-time credential flow with full validation.
- 2026-02-10: Senior review autofix - enforced single-session connect semantics and removed duplicate status event emission.
