# Story 1.6: Configure Redis TLS per Profile (When Supported)

Status: done

Generated: 2026-02-10
Story Key: `1-6-configure-redis-tls-per-profile-when-supported`

## Story

As a cache user,  
I want to configure TLS for Redis connections when supported by the target,  
so that remote connections can be secured.

## Acceptance Criteria

1. **Given** a Redis profile  
   **When** I enable or disable TLS settings  
   **Then** the connection uses TLS according to the profile configuration (FR6).
2. **Given** an insecure or misconfigured TLS setup  
   **When** I attempt to connect  
   **Then** the app surfaces the risk or error clearly and does not silently fall back to insecure behavior (NFR10).

## Tasks / Subtasks

- [x] Extend profile schema for Redis TLS options (AC: 1,2)
  - [x] Add TLS enabled toggle, servername override (if needed), and CA bundle path/reference metadata
  - [x] Validate incompatible combinations at main-process boundary
- [x] Implement TLS connect behavior in Redis client path (AC: 1,2)
  - [x] Map profile TLS settings to Node TLS socket options explicitly
  - [x] Reject cert/hostname failures with actionable error codes
  - [x] Ensure no fallback from TLS attempt to plaintext retry
- [x] Add UX for TLS config and diagnostics (AC: 1,2)
  - [x] Profile form exposes TLS controls only for Redis profiles
  - [x] Show validation and connect-time diagnostics for cert/path/hostname issues
  - [x] Provide concise remediation actions in error UI
- [x] Add test coverage (AC: 1,2)
  - [x] Main tests for TLS option mapping and failure behavior
  - [x] Main tests verifying no insecure fallback path
  - [x] Renderer tests for TLS form behavior and diagnostics rendering

## Dev Notes

### Developer Context

Story 1.6 tightens transport security for Redis connections introduced in Story 1.5. The goal is explicit, per-profile TLS behavior with clear failure signals and zero silent downgrade risk.

### Technical Requirements

- TLS config is Redis-specific in this story; Memcached TLS is not in scope unless already supported in existing client path.
- Treat TLS failures as first-class, user-actionable errors.
- Preserve credential handling from Story 1.4 and session transitions from Story 1.5.
- Avoid storing CA private material inline in SQLite if possible; store paths/references and secure read flow.

### Architecture Compliance

- Main owns network stack and certificate file IO.
- Renderer owns only config forms and error display.
- IPC error envelope must include stable error codes for TLS failures.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1`
- `zod`: `4.3.6` latest
- `drizzle-orm`: `0.45.1` latest (`^0.44.5` in project)

Implementation guidance:
- Keep project versions pinned unless a deliberate dependency update is included in scope.
- Document selected Redis client TLS option mapping in code comments/tests.

### File Structure Requirements

- `src/shared/profiles/profile.schemas.ts`
- `src/main/domain/cache/clients/redis.client.ts`
- `src/main/domain/cache/session/*`
- `src/main/ipc/register-handlers.ts`
- `src/renderer/features/profiles/*`

### Testing Requirements

- Include test vectors for self-signed cert, wrong hostname, missing CA path, and disabled TLS mode.
- Verify user-visible error details are specific enough for remediation.

### Previous Story Intelligence

- Story 1.5 established connect/disconnect/switch session control; TLS settings must plug into that flow without breaking switching semantics.
- Story 1.4 established secret policy boundaries; TLS implementation must keep those boundaries intact.

### Git Intelligence Summary

Pattern consistency is strongest when extending existing domain modules and IPC contract rather than adding alternate networking entry points.

### Latest Tech Information

- Keep TLS posture explicit and inspectable in UI.
- No silent fallback is mandatory to satisfy NFR10 and architecture security intent.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.6)
- `_bmad-output/planning-artifacts/architecture.md` (TLS/security posture requirements)
- `_bmad-output/planning-artifacts/prd.md` (FR6, NFR10)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (guided error design)
- `_bmad-output/implementation-artifacts/1-5-connect-disconnect-and-switch-sessions-with-status-and-errors.md`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Completion Notes List

- Added Redis TLS profile schema support (`enabled`, `servername`, `caPath`) and persistence metadata columns/migration.
- Added main-process boundary validation for incompatible memcached + Redis TLS configuration.
- Extended Redis client connect path to use Node TLS socket options with explicit CA path/servername mapping and no plaintext retry fallback.
- Added session-level TLS error normalization to `TLS_CERT_INVALID` with actionable remediation text.
- Added renderer Redis-only TLS controls and connect-time TLS diagnostics in status UI.
- Added main and renderer TLS-focused tests (mapping, no fallback, form visibility, remediation rendering) and passed full validation after review fixes.

### File List

- `_bmad-output/implementation-artifacts/1-6-configure-redis-tls-per-profile-when-supported.md`
- `src/shared/profiles/profile.schemas.ts`
- `src/main/domain/persistence/schema/connection-profiles.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/repositories/connection-profiles.repository.ts`
- `src/main/domain/persistence/services/connection-profiles.service.ts`
- `src/main/domain/cache/clients/redis.client.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/renderer/features/profiles/ProfilesPage.tsx`
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/connection-profiles.repository.test.ts`
- `src/main/test/connection-profiles.service.test.ts`
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

1. HIGH: Update-path validation could bypass Redis-only TLS constraints in merged profile state.
2. MEDIUM: Failed connect states did not preserve retry target, weakening TLS remediation/retry workflow.
3. MEDIUM: Missing regression coverage for merged-state TLS validation at service boundary.

### Autofixes Applied

- Added merged profile validation in `profilesService.update`.
- Preserved failed target profile ID and wired Retry action to pending-or-active target.
- Added service-level test coverage for invalid merged memcached/TLS update.

## Change Log

- 2026-02-10: Implemented Story 1.6 Redis TLS profile configuration, TLS connect behavior/no-fallback guarantees, renderer diagnostics, and full validation.
- 2026-02-10: Senior review autofix - hardened Redis TLS validation across update paths and retry recovery flow.
