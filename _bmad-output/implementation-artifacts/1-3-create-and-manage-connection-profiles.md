# Story 1.3: Create and Manage Connection Profiles

Status: done

Generated: 2026-02-10
Story Key: `1-3-create-and-manage-connection-profiles`

## Story

As a cache user,  
I want to create, edit, delete, tag, favorite, and search connection profiles,  
so that I can quickly organize and access target environments.

## Acceptance Criteria

1. **Given** the profiles UI  
   **When** I create, edit, or delete a profile  
   **Then** changes persist locally and validation errors are shown clearly (FR1).
2. **Given** multiple profiles  
   **When** I tag, favorite, or search profiles  
   **Then** results filter correctly and update immediately (FR2).
3. **Given** the app restarts  
   **When** I reopen the app  
   **Then** profile metadata is restored from local persistence (FR47).

## Tasks / Subtasks

- [x] Implement persistence foundation for profile metadata (AC: 1,3)
  - [x] Add SQLite + migrations baseline in main process (per architecture)
  - [x] Add Drizzle schema for `connection_profiles` and `connection_profile_tags` (snake_case)
  - [x] Implement repository functions: list, create, update, delete, toggleFavorite, setTags, search
  - [x] Ensure **no secrets** are stored in SQLite (passwords/tokens/certs are out of scope for 1.3)
- [x] Add typed IPC endpoints for profiles (AC: 1,2,3)
  - [x] Extend `src/shared/ipc/ipc.contract.ts` with `profiles:*` channels + Zod validation + envelope
  - [x] Extend preload API (`src/preload/api.ts`) and `src/renderer/global.d.ts`
  - [x] Register main handlers in `src/main/ipc/*` and route to domain services/repos
- [x] Build Profiles UI in renderer (AC: 1,2,3)
  - [x] Add a “Profiles” surface (page or dialog) with list + search + favorite toggle
  - [x] Create profile form (create/edit) with inline validation (Zod) and clear error display
  - [x] Add tags UX: edit tags, filter/search by tags (simple chips + text input)
  - [x] Add delete confirmation with safe defaults (keyboard-first)
  - [x] Ensure results update immediately after mutations (optimistic UI allowed, but must reconcile with main response)
- [x] Add validation and regression coverage (AC: 1,2,3)
  - [x] Main-process unit tests for repo/service validation and edge cases (invalid host/port, duplicate names if enforced)
  - [x] Renderer tests for create/edit/delete flows and search/filter behavior
  - [x] Smoke: `npm run lint`, `npm run typecheck`, `npm test`, `npm run make`

## Dev Notes

### Developer Context (Why this story exists)

Epic 1 is “connections-first”: users orient by connection before key exploration. This story builds the “connection profiles” system so later stories can safely layer on auth, TLS, connect/disconnect, status/errors, and prod guardrails without reworking storage/UI.  

Scope focus for 1.3:
- Profile **metadata** CRUD + organization (tags/favorites/search)
- Durable local persistence of metadata across restarts

Explicitly out of scope for 1.3 (later stories):
- Saving credentials (OS keychain / `safeStorage`) and auth configuration (Story 1.4)
- Connect/disconnect and session switching (Story 1.5)
- TLS configuration per profile (Story 1.6)
- Prod read-only defaults + mutation unlock flows (Stories 1.7–1.8)

### Technical Requirements (Must Follow)

- Renderer must remain UI-only (no DB/filesystem/network). All persistence goes through typed IPC and the standard envelope.
- Persist only non-secret metadata in SQLite (profile name, kind, host, port, tags, favorite, timestamps, env label if added).
- Prefer stable identifiers: use a UUID `id` for profiles (don’t use name as a primary key).
- Validation rules must exist in two places:
  - Renderer: fast UX feedback (Zod schema)
  - Main: authoritative validation before persistence (Zod schema reused or mirrored)
- Every IPC endpoint must be contract-first:
  - Added to `src/shared/ipc/ipc.contract.ts` with Zod schemas
  - Must return `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`

### Architecture Compliance (Non-negotiables)

From `_bmad-output/planning-artifacts/architecture.md`:
- Local persistence approach (hybrid):
  - Structured app data: SQLite under Electron `userData` (e.g., `cachify.sqlite`)
  - Preferences/UI state: `electron-store` (not required for 1.3 unless needed)
- SQLite access + ORM:
  - Driver: `better-sqlite3` (native module)
  - ORM: Drizzle (`drizzle-orm`)
- Main process is the single reader/writer for persistence.
- SQLite uses `snake_case`; IPC/UI uses `camelCase`; mapping occurs in the main persistence layer only.

Important repo reality check:
- The current repo does not yet include SQLite/Drizzle deps or folder structure from the architecture tree; this story should introduce the persistence layer and place it under `src/main/domain/persistence/*` (and related IPC handlers) without breaking the existing Forge/Vite build.

### Library / Framework Requirements (Use repo baseline)

Current baseline (see `package.json`):
- Electron: `40.2.1`
- Electron Forge: `@electron-forge/*@^7.11.1` + `@electron-forge/plugin-vite@^7.11.1`
- React: `^19.2.0`
- Vite: `^7.3.1`
- Tailwind CSS: `^4.1.18`
- Zod: `^4.1.5`
- Vitest: `^4.0.18`

Story-specific deps to add (per architecture):
- `better-sqlite3` (native)
- `drizzle-orm` (+ Drizzle migration tooling as chosen)
- Possibly `electron-store` if you decide to persist small prefs in 1.3 (optional)

Packaging note: because `better-sqlite3` is native, ensure Forge packaging supports it (asar/unpack or auto-unpack-natives plugin) and validate `npm run make` on your dev machine.

### File Structure Requirements (Where code must go)

Align with architecture tree while staying consistent with current repo:
- IPC contract: `src/shared/ipc/ipc.contract.ts`
- Preload bridge: `src/preload/api.ts`, `src/preload/preload.ts`
- Main IPC handlers: extend `src/main/ipc/register-handlers.ts` (or split to `src/main/ipc/handlers/*` if introducing structure)
- Main persistence domain (new):
  - `src/main/domain/persistence/db/*` (SQLite open + migrations bootstrap)
  - `src/main/domain/persistence/schema/*` (Drizzle schema)
  - `src/main/domain/persistence/repositories/*` (profiles repo)
  - `src/main/domain/persistence/services/*` (profiles service, validation, mapping)
- Renderer UI (new):
  - `src/renderer/app/*` (route/surface wiring)
  - `src/renderer/features/profiles/*` (UI components: list, form dialog, filters)
  - Reuse existing `src/renderer/components/ui/*` primitives (Base UI-backed)

### Testing Requirements

Minimum expected coverage:
- Main: repo/service unit tests for CRUD + tag/favorite + basic validation and error envelopes.
- Renderer: interaction tests for profiles list + create/edit/delete + search/filter.
- Keep tests fast and deterministic; prefer in-memory SQLite for unit tests if feasible, or temp files under a temp directory.

### Previous Story Intelligence (Do not regress)

From Story 1.1 and 1.2 artifacts:
- Keep strict main/preload/renderer boundaries and the contract-first IPC discipline.
- UI primitives are already Base UI-backed under `src/renderer/components/ui/*`; reuse them (don’t introduce new headless UI stacks).
- The repo already has `@electron-forge/plugin-auto-unpack-natives` as a dependency but it is not yet wired into `forge.config.ts`; you will likely need to configure native-module handling when adding `better-sqlite3`.

### Git Intelligence Summary

Recent work established:
- Secure Electron process boundaries + typed IPC envelope baseline (`src/shared/ipc/ipc.contract.ts`, `src/preload/api.ts`, `src/main/ipc/register-handlers.ts`).
- Tailwind + shadcn copy-in styling and Base UI primitives (`src/renderer/components/ui/*`, `src/renderer/styles.css`).

This story should extend those patterns rather than introducing alternate conventions.

### Latest Technical Information (Important notes)

- Latest version signals (checked 2026-02-10):
  - `better-sqlite3`: `12.4.1`
  - `drizzle-orm`: `0.44.5`
  - `@electron-forge/plugin-vite` / Forge v7: `7.11.0`
- `better-sqlite3` is a native addon:
  - Validate Electron compatibility for the chosen `better-sqlite3` version.
  - Expect rebuild/unpack work when packaging (`npm run make`), especially with `asar: true`.
- If you hit native-module packaging issues, wire `@electron-forge/plugin-auto-unpack-natives` (already present in `package.json`) or adjust `packagerConfig` to unpack native `.node` binaries from asar.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.3)
- `_bmad-output/planning-artifacts/architecture.md` (Persistence approach; boundaries; naming conventions; IPC patterns)
- `_bmad-output/planning-artifacts/prd.md` (FR1/FR2/FR47; offline-first constraints)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (connections-first mental model; keyboard-first UX; error/feedback patterns)
- `_bmad-output/implementation-artifacts/1-1-initialize-desktop-foundation-and-secure-process-boundaries.md` (IPC + boundaries)
- `_bmad-output/implementation-artifacts/1-2-ui-foundation-tailwind-tokens-base-ui-shadcn-copy-in.md` (UI primitives + tokens)

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Codex CLI)

### Debug Log References

- Source analysis: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/architecture.md`, `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/ux-design-specification.md`
- Repo analysis: `package.json`, `forge.config.ts`, `src/shared/ipc/ipc.contract.ts`, `src/preload/api.ts`, `src/main/ipc/register-handlers.ts`, `src/renderer/components/ui/*`
- Git review: `git log --oneline -n 20`, `git show --name-only -n 5`
- Tests: `npm test`, `npm run lint`, `npm run typecheck`, `npm run make`

### Implementation Plan

- Add SQLite/Drizzle persistence layer with migrations under `src/main/domain/persistence`
- Extend IPC contract + preload bridge and wire main handlers to services
- Build Profiles UI with search, tags, favorites, and dialogs with Zod validation
- Add main and renderer tests plus packaging configuration for native module

### Completion Notes List

- Story context generated for `epic 1 story 3` (`1-3-create-and-manage-connection-profiles`) and marked `ready-for-dev`.
- Validation framework file `_bmad/core/tasks/validate-workflow.xml` referenced by BMAD create-story is not present in this repo; checklist concepts were applied manually to ensure the story includes guardrails, structure, and anti-drift guidance.
- Implemented SQLite/Drizzle persistence with migrations and profiles repository/service.
- Added profiles IPC contract, preload API wiring, and main handlers.
- Built Profiles UI with create/edit/delete, tags, favorites, and search/filter updates.
- Added main and renderer tests; ran `npm test`, `npm run lint`, `npm run typecheck`, `npm run make`.
- Hardened IPC handlers so runtime failures return envelope errors instead of uncaught exceptions.
- Updated repository behavior for not-found deletes and `updatedAt` refresh on tags/favorite mutations.
- Expanded regression coverage with service-level tests and renderer edit/delete flow tests.

### Change Log

- Implemented connection profile persistence, IPC, UI, and tests (Date: 2026-02-10)
- Addressed code-review findings for error envelopes, mutation timestamps, and missing test coverage (Date: 2026-02-10)

### File List

- `forge.config.ts`
- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/shared/profiles/profile.schemas.ts`
- `src/preload/api.ts`
- `src/main/ipc/register-handlers.ts`
- `src/main/domain/persistence/db/connection.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/db/sqlite.ts`
- `src/main/domain/persistence/db/test-utils.ts`
- `src/main/domain/persistence/repositories/connection-profiles.repository.ts`
- `src/main/domain/persistence/schema/connection-profiles.ts`
- `src/main/domain/persistence/schema/index.ts`
- `src/main/domain/persistence/services/connection-profiles.service.ts`
- `src/main/test/connection-profiles.repository.test.ts`
- `src/main/test/connection-profiles.service.test.ts`
- `src/renderer/app/App.tsx`
- `src/renderer/components/ui/dialog.tsx`
- `src/renderer/features/profiles/ProfilesPage.tsx`
- `src/renderer/test/profiles.test.tsx`
- `src/renderer/test/ui-foundation.test.tsx`
- `src/renderer/components/ui/badge.tsx`
- `src/renderer/components/ui/checkbox.tsx`
- `src/renderer/components/ui/input.tsx`
- `src/renderer/components/ui/label.tsx`
- `src/renderer/components/ui/select.tsx`
- `AGENTS.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-3-create-and-manage-connection-profiles.md`
