# Story 1.7: Environment Labels and Default Safety Posture (Read-Only by Default for Prod)

Status: done

Generated: 2026-02-10
Story Key: `1-7-environment-labels-and-default-safety-posture-read-only-by-default-for-prod`

## Story

As a cache user,  
I want environment labels and production-safe defaults,  
so that I avoid accidental risky operations.

## Acceptance Criteria

1. **Given** profile settings  
   **When** I assign an environment label  
   **Then** the active environment is always visible in the app (FR10) (FR11).
2. **Given** a profile labeled as production  
   **When** I connect  
   **Then** the app enforces read-only mode by default for that connection (FR12).

## Tasks / Subtasks

- [x] Add environment model to profile metadata (AC: 1,2)
  - [x] Extend schema to support `local | staging | prod` (or configured equivalent)
  - [x] Persist environment label in profile metadata and expose through IPC
- [x] Implement safety posture derivation on connect (AC: 2)
  - [x] Set connection mode to `readOnly` by default for production profiles
  - [x] Ensure mode initializes deterministically during connect/switch lifecycle
- [x] Build always-visible environment and safety indicators (AC: 1,2)
  - [x] Add persistent trust chip/banner in app chrome
  - [x] Add environment + mode indicators in inspector/connection areas
  - [x] Ensure not color-only: include text and icon/label semantics
- [x] Add tests (AC: 1,2)
  - [x] Main tests for posture derivation from profile env label
  - [x] Renderer tests for persistent environment visibility and accessible labeling
  - [x] Regression test for default read-only posture on prod reconnect/switch

## Dev Notes

### Developer Context

Story 1.7 introduces trust-state UX and default safety posture that prepares for Story 1.8 unlock/relock mechanics. This must be globally visible and predictable, not hidden in secondary screens.

### Technical Requirements

- Environment state must be present in active connection/session payloads.
- Renderer must always show current environment and safety posture in top-level UI.
- Production default posture is read-only and must survive reconnects/switches/restarts.
- Keep posture checks in main domain layer, not renderer-only conditions.

### Architecture Compliance

- Business policy lives in main process domain services.
- Renderer consumes policy state through typed IPC.
- Preserve existing envelope and naming conventions.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `react`: `19.2.4` latest
- `tailwindcss`: `4.1.18`

Implementation guidance:
- Use existing shadcn/base-ui primitives already in repository.
- Keep trust-state styling token-driven and accessible.

### File Structure Requirements

- `src/shared/profiles/profile.schemas.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/cache/session/*`
- `src/main/ipc/register-handlers.ts`
- `src/renderer/app/*` and `src/renderer/features/*` for persistent trust UI

### Testing Requirements

- Verify environment indicators remain visible across route/view changes.
- Verify prod defaults to read-only in every connect path.
- Verify accessibility: visible text labels and keyboard focus behavior.

### Previous Story Intelligence

- Story 1.6 established secure transport settings; environment display must coexist with connection/TLS status.
- Story 1.5 already tracks connection status and errors; reuse that display architecture for trust posture.

### Git Intelligence Summary

Recent code patterns favor feature modules in renderer and domain services in main; apply this split for safety posture logic and UI trust chips.

### Latest Tech Information

- Maintain reduced-motion-safe signaling (flashing/saturated warnings should be avoided in favor of persistent state indicators).
- Trust/safety indicators are critical UX controls, not decorative status tags.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.7)
- `_bmad-output/planning-artifacts/architecture.md` (trust chip and policy rules)
- `_bmad-output/planning-artifacts/prd.md` (FR10, FR11, FR12)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (always-visible trust/safety cues)
- `_bmad-output/implementation-artifacts/1-6-configure-redis-tls-per-profile-when-supported.md`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Completion Notes List

- Added `environment` profile metadata (`local | staging | prod`) and persisted it through schema/repository/service/database migration.
- Extended connection session payload with `environmentLabel` and `safetyMode`, with deterministic prod => `readOnly` posture on connect/switch.
- Added always-visible trust indicators in app chrome plus connection-area environment/safety labels (text-first semantics).
- Added profile environment selection in form UX and ensured indicators remain visible while switching views/states.
- Added and passed main/renderer tests for posture derivation, prod read-only regression, and persistent environment visibility.
- Completed review/fix pass and validated with `npm run lint`, `npm run typecheck`, and `npm test`.

### File List

- `_bmad-output/implementation-artifacts/1-7-environment-labels-and-default-safety-posture-read-only-by-default-for-prod.md`
- `src/shared/profiles/profile.schemas.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/domain/persistence/schema/connection-profiles.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/repositories/connection-profiles.repository.ts`
- `src/main/domain/persistence/services/connection-profiles.service.ts`
- `src/main/domain/cache/session/connection-session.service.ts`
- `src/main/ipc/register-handlers.ts`
- `src/renderer/features/profiles/ProfilesPage.tsx`
- `src/renderer/app/App.tsx`
- `src/main/test/connection-session.service.test.ts`
- `src/main/test/connection-profiles.repository.test.ts`
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

1. HIGH: Connect-to-different-profile path could bypass deterministic switch lifecycle, risking incorrect environment/safety derivation timing.
2. MEDIUM: Duplicate status event emission could cause noisy trust indicator updates in renderer.
3. MEDIUM: Error-state retry flow could not target failed profile reliably, reducing recoverability guarantees.

### Autofixes Applied

- Enforced connect-to-different-profile delegation to `switch`.
- Removed duplicate IPC status event subscription publish path.
- Preserved `pendingProfileId` on failure and used it for Retry targeting in UI.

## Change Log

- 2026-02-10: Implemented Story 1.7 environment labels, prod-default read-only safety posture, persistent trust indicators, and full validation.
- 2026-02-10: Senior review autofix - stabilized connect/switch lifecycle and trust indicator event flow.
