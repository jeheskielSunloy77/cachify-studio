# Story 1.1: Initialize Desktop Foundation and Secure Process Boundaries

Status: ready-for-dev

Generated: 2026-02-09
Story Key: `1-1-initialize-desktop-foundation-and-secure-process-boundaries`

## Story

As a developer,  
I want the Electron app scaffolded with strict main/preload/renderer boundaries,  
so that connection workflows can be implemented safely and consistently.

## Acceptance Criteria

1. Given a fresh repo, when the app is initialized using the selected starter template, then main, preload, and renderer processes are separated and build successfully; and `contextIsolation` is enabled and the renderer does not have direct Node access.
2. Given the renderer needs privileged operations, when it accesses persistence, network, or secrets, then it can only do so via preload-exposed typed APIs (no ad-hoc IPC channels).
3. The project follows the architecture’s organization rules from day 1 (typed IPC contract, IPC envelope, main-only IO boundaries).

## Tasks / Subtasks

- [ ] Scaffold app using Electron Forge `vite-typescript` template (per architecture doc)
  - [ ] Confirm `contextIsolation: true` and `nodeIntegration: false` (renderer has no Node access)
  - [ ] Confirm renderer builds and loads (dev + packaged build smoke)
- [ ] Add React to the Vite renderer
  - [ ] Add `@vitejs/plugin-react`, `react`, `react-dom`, TypeScript typings
- [ ] Create a typed IPC contract module (single source of truth)
  - [ ] Add `src/shared/ipc/ipc.contract.ts` with Zod schemas for every endpoint (start with a minimal “app:ping”)
  - [ ] Define and enforce the IPC response envelope: `{ ok: true, data } | { ok: false, error: { code, message, details? } }`
- [ ] Implement preload bridge as a minimal typed API surface
  - [ ] Expose typed API via `contextBridge.exposeInMainWorld`
  - [ ] Ensure IPC payloads are structured-clone safe (plain objects only)
- [ ] Add minimal main IPC wiring
  - [ ] Register handlers for the contract endpoints
  - [ ] No direct DB/file access from renderer (even if “easy” for now)
- [ ] Add “boundary checks” that prevent regressions
  - [ ] A quick runtime check/log that confirms renderer cannot access Node APIs
  - [ ] Document where future endpoints must be added (contract-first)

## Dev Notes

### Non-Negotiables (Guardrails)

- Renderer is UI only; it **never** touches filesystem, network, DB, keychain, or Electron main APIs directly.
- Preload is the **only** bridge; keep it small and typed.
- Main owns persistence, networking, jobs, and secrets.
- No ad-hoc IPC channels. All IPC must be defined in one contract module and validated.
- IPC must always return the envelope; do not throw raw errors across IPC.

### Architecture Compliance (from `_bmad-output/planning-artifacts/architecture.md`)

- Selected starter: **Electron Forge `vite-typescript` + React** (renderer). Use `@latest` bootstrap and let lockfile pin. Treat Forge+Vite integration as potentially breaking across minor releases; keep build validation tight.
- IPC rules:
  - Channels named `domain:action` (example: `app:ping`, later `connections:list`, `keys:search:start`)
  - Payloads: structured-clone safe
  - Envelope: `{ ok: true, data }` / `{ ok: false, error: { code, message, details? } }`
- Organization rules (start now; don’t “refactor later”):
  - Main business logic in `src/main/domain/*`
  - Electron shell wiring in `src/main/app/*`
  - IPC handlers implementing the contract in `src/main/ipc/*`
  - Workers in `src/main/workers/*` (later stories)

### File/Folder Layout Target (starter-friendly)

Use this as the early scaffold target (it’s OK if the Forge template starts slightly differently, but converge quickly):

```
src/
  main/
    app/
    domain/
    ipc/
  preload/
    preload.ts
    api.ts
  renderer/
    main.tsx
    app/
    features/
    ui/
    shared/
    stores/
  shared/
    ipc/
      ipc.contract.ts
    types/
```

### Library / Framework Requirements (current as of 2026-02-09)

Use the repo’s actual `package.json`/lockfile as truth, but these are the “latest stable” signals at story creation time:

- Electron: `40.2.1`
- Electron Forge CLI / Vite plugin: `7.11.1`
- Vite: `7.3.1`
- React / React DOM: `19.2.4`
- TypeScript: `5.9.3`
- Zod: `4.3.6`
- Zustand: `5.0.11`
- Tailwind CSS: `4.1.18` (used in Story 1.2, but don’t block 1.1 on it)
- Base UI: `@base-ui/react@1.1.0` (used in Story 1.2, but don’t block 1.1 on it)

Important: keep preload/main/renderer build working across `npm run start` and `npm run make` early; don’t introduce fragile, half-wired tooling.

### Testing Requirements (minimum for this story)

- Smoke check: app runs in dev mode and opens a window without console security warnings.
- Smoke check: `make` / packaged build runs (at least on the dev machine).
- Add one small “contract sanity” unit test if the repo already has a test runner; otherwise document how to manually verify (don’t invent an entire testing stack in Story 1.1).

### UX / Safety Alignment (why this matters now)

Even at scaffold stage, keep these constraints in mind because they affect structure:

- Keyboard-first UX and predictable focus management (future stories).
- Safety/trust posture must be always visible (future stories) → avoid architecture choices that bury state in the main process without a typed API for renderer access.
- Performance requirement: long-running work must be cancelable and not freeze UI → job model + workers later, but the IPC envelope + contract module starts now.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.1)
- `_bmad-output/planning-artifacts/architecture.md` (Selected Starter; IPC patterns; project organization; envelope rules)
- `_bmad-output/planning-artifacts/prd.md` (NFR8–NFR10 security + privacy; offline-first posture)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (keyboard-first + accessibility expectations)

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Codex CLI)

### Debug Log References

- `npm view` was used on 2026-02-09 to capture “latest stable” package versions.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.

### File List

- `_bmad-output/implementation-artifacts/1-1-initialize-desktop-foundation-and-secure-process-boundaries.md`
