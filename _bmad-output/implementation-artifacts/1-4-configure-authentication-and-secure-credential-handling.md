# Story 1.4: Configure Authentication and Secure Credential Handling

Status: done

Generated: 2026-02-10
Story Key: `1-4-configure-authentication-and-secure-credential-handling`

## Story

As a cache user,  
I want to configure Redis/Memcached authentication and credential persistence policy,  
so that I can connect securely without exposing secrets.

## Acceptance Criteria

1. **Given** a profile with authentication enabled  
   **When** I choose to save credentials  
   **Then** secrets are stored only via safeStorage and never in plaintext on disk (NFR8, NFR9).
2. **Given** safeStorage reports a basic_text backend  
   **When** I attempt to save credentials  
   **Then** saving is disabled and prompt-per-session is enforced with clear guidance (NFR9).
3. **Given** Redis auth settings  
   **When** I configure authentication  
   **Then** password-based auth is supported (FR5).
4. **Given** a profile with sensitive credentials  
   **When** I choose "prompt every time" for that profile  
   **Then** credentials are not persisted and I am prompted each session before connecting (FR7).

## Tasks / Subtasks

- [x] Add auth and secret policy model to shared contracts (AC: 1,2,3,4)
  - [x] Extend `src/shared/profiles/profile.schemas.ts` with Redis/Memcached auth mode and credential policy (`save` vs `promptEverySession`)
  - [x] Keep non-secret profile metadata in SQLite only; secrets stay outside persistence schemas
  - [x] Extend IPC contract with secure save/load/delete credential channels and typed envelope responses
- [x] Implement main-process secure storage adapter (AC: 1,2,4)
  - [x] Add `src/main/domain/security/safe-storage.ts` and `src/main/domain/security/secrets.ts`
  - [x] Guard Linux keyring fallback: if `safeStorage.getSelectedStorageBackend() === "basic_text"`, reject save and return actionable error code/message
  - [x] Encrypt/decrypt secrets via safeStorage only; never write secrets to SQLite/electron-store/logs
- [x] Implement auth settings UI in profile forms (AC: 2,3,4)
  - [x] Add Redis auth config fields (password, optional ACL username)
  - [x] Add Memcached auth mode selector (none or SASL)
  - [x] Add credential policy toggle with `basic_text` restriction banner and forced prompt mode
- [x] Add retrieval behavior for prompt-per-session policy (AC: 4)
  - [x] Ensure connection attempt path requests credentials at runtime when policy is prompt-per-session
  - [x] Keep prompts scoped to active profile only; do not cache beyond session needs
- [x] Add test coverage (AC: 1,2,3,4)
  - [x] Main tests for save/load/delete secret behavior and `basic_text` guard
  - [x] Main tests verifying no secret fields are persisted in profile DB rows
  - [x] Renderer tests for auth form states, policy toggles, and error messaging

## Dev Notes

### Developer Context

Story 1.3 established connection profile persistence and profile UI without secrets. Story 1.4 adds authentication configuration and credential storage policy while preserving strict boundary rules:
- Renderer never handles plaintext persistence or encryption
- Main process owns secret lifecycle
- Secrets are recoverable only through secure runtime calls

### Technical Requirements (Must Follow)

- Keep structured profile metadata in SQLite (`src/main/domain/persistence/*`) and secrets only in safeStorage adapters.
- Credentials must never be persisted in:
  - `connection_profiles` rows
  - `electron-store`
  - logs, error payloads, or test snapshots
- Use envelope errors for auth/secret failures (e.g., `CREDENTIAL_SAVE_DISABLED`, `CREDENTIAL_NOT_FOUND`, `SECURE_BACKEND_UNAVAILABLE`).
- Redis auth support in this story:
  - password auth (required)
  - ACL username/password (supported path, even if optional in UI)
- Memcached auth support in this story:
  - no auth
  - optional SASL auth

### Architecture Compliance

From `src/main` boundary and architecture rules:
- Main process owns IO/network/secrets/persistence.
- Preload exposes minimal typed API surface only.
- Renderer remains UI-only and accesses secrets through preload contract.
- SQLite schema uses `snake_case`; IPC and UI payloads use `camelCase`.

### Library / Framework Requirements

Latest stable checks run on 2026-02-10:
- `electron`: `40.2.1` (project pinned)
- `@electron-forge/cli`: `7.11.1`
- `react`: `19.2.4` latest (`^19.2.0` in project)
- `zod`: `4.3.6` latest (`^4.1.5` in project)

Implementation guidance:
- Stay on repository-pinned Electron/Forge versions unless upgrade is explicitly planned.
- Use Electron safeStorage APIs and current Node runtime provided by Electron 40.

### File Structure Requirements

- `src/shared/profiles/profile.schemas.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/domain/security/safe-storage.ts` (new)
- `src/main/domain/security/secrets.ts` (new)
- `src/main/ipc/register-handlers.ts` or split handler modules
- `src/renderer/features/profiles/*` for auth policy form UX

### Testing Requirements

- Main process:
  - secure storage adapter unit tests
  - contract/handler tests for error envelope behavior
  - persistence regression tests proving secrets are excluded from DB
- Renderer:
  - auth mode + credential policy interaction tests
  - `basic_text` forced prompt-mode tests

### Previous Story Intelligence

From `1-3-create-and-manage-connection-profiles.md`:
- Reuse existing profiles service/repository and IPC contract style.
- Do not break existing CRUD/search/tag/favorite flows.
- Keep all boundary guarantees already tested in story 1.3.

### Git Intelligence Summary

Recent commits show established patterns in:
- `src/main/domain/persistence/*`
- `src/main/ipc/register-handlers.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/renderer/features/profiles/ProfilesPage.tsx`

Follow these conventions instead of introducing alternate architecture.

### Latest Tech Information

- `safeStorage` backend capability is platform-dependent; Linux keyring fallback to `basic_text` must disable persisted secret saving.
- Keep secret payloads structured-clone-safe when crossing IPC; send only required fields.
- Prefer explicit secret key namespace convention (e.g., profile-id + auth-type) to avoid collisions.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.4)
- `_bmad-output/planning-artifacts/architecture.md` (safeStorage policy, process boundaries)
- `_bmad-output/planning-artifacts/prd.md` (FR5, FR7, NFR8, NFR9)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (form validation and guided error UX)
- `_bmad-output/implementation-artifacts/1-3-create-and-manage-connection-profiles.md`
- `package.json`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Artifact analysis: epics, architecture, prd, ux spec
- Repo analysis: package versions, current persistence + IPC patterns
- Git history: last 5 commits and touched files
- Validation: `npm run lint`, `npm run typecheck`, `npm test`

### Implementation Plan

- Extended shared profile and IPC contracts for auth metadata and secure secret channels.
- Added main-process safeStorage capability adapter and encrypted secret persistence service.
- Updated persistence schema/migrations/repository/service to store only non-secret auth metadata.
- Updated preload bridge and profiles renderer form for auth/policy UX and secure secret operations.
- Added main and renderer tests for secret lifecycle, `basic_text` guard, persistence boundaries, and policy UI behavior.
- Performed post-implementation review and fixed typing/envelope/test coverage gaps before final validation.

### Completion Notes List

- Added `credentialPolicy`, Redis auth metadata, and Memcached auth metadata to profile contracts while keeping passwords out of SQLite.
- Implemented `profileSecrets:*` IPC surface with typed envelopes and secure backend capability reporting.
- Implemented `safeStorage`-backed encrypted credential persistence with `basic_text` hard-disable behavior and actionable guidance.
- Updated profile form UX for Redis/Memcached auth, secure-save vs prompt policy, forced prompt mode on insecure backend, and validation messaging.
- Enforced prompt-per-session behavior by deleting persisted secret material when policy is prompt mode or auth is disabled.
- Completed and passed full validation suite after review/fix loop.

### File List

- `_bmad-output/implementation-artifacts/1-4-configure-authentication-and-secure-credential-handling.md`
- `src/shared/profiles/profile.schemas.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/preload/api.ts`
- `src/main/domain/security/safe-storage.ts`
- `src/main/domain/security/secrets.ts`
- `src/main/ipc/register-handlers.ts`
- `src/main/domain/persistence/schema/connection-profiles.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/repositories/connection-profiles.repository.ts`
- `src/main/domain/persistence/services/connection-profiles.service.ts`
- `src/main/test/secrets.test.ts`
- `src/main/test/register-handlers.secrets.test.ts`
- `src/main/test/register-handlers.persistence.test.ts`
- `src/main/test/connection-profiles.repository.test.ts`
- `src/main/test/connection-profiles.service.test.ts`
- `src/renderer/features/profiles/ProfilesPage.tsx`
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

1. HIGH: Partial update validation allowed invalid merged auth/TLS state (`memcached` profile + `redisTls.enabled=true`) when `kind` was not present in patch.
2. MEDIUM: Missing stored credentials were mapped to generic `AUTH_FAILED` instead of actionable prompt-required flow.
3. MEDIUM: Retry path after failed connect was not recoverable from UI because failed state did not preserve retry target profile.

### Autofixes Applied

- Added merged-state validation in `profilesService.update` before repository writes.
- Mapped `CREDENTIAL_NOT_FOUND` to `CREDENTIAL_PROMPT_REQUIRED` in session secret resolution.
- Preserved failed target in `pendingProfileId` and updated retry targeting in renderer.
- Added regression test for merged update validation.

## Change Log

- 2026-02-10: Implemented Story 1.4 auth metadata + secure credential handling, added UI policy/auth flows, and completed full test/lint/typecheck validation.
- 2026-02-10: Senior review autofix - hardened merged profile validation and improved credential prompt/retry recovery behavior.
