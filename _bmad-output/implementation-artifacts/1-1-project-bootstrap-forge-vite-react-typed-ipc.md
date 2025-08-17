# Story 1.1: Project Bootstrap (Forge + Vite + React + Typed IPC)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a working Electron Forge app scaffolded with the chosen stack and a minimal typed IPC bridge,
so that I can begin implementing features with the correct security boundaries from day one.

## Acceptance Criteria

1. **Given** a new repo workspace  
   **When** I run the dev command  
   **Then** the app launches with a renderer window and no console errors

2. **Given** the app is running  
   **When** the renderer calls a sample IPC method via preload using typed request/response  
   **Then** the UI displays the successful response payload  
   **And** the response shape is a stable envelope: `{ ok: true, data } | { ok: false, error: { code, message, details? } }`

3. **Given** the app is running  
   **When** I inspect the code structure  
   **Then** `main`, `preload`, and `renderer` are separated  
   **And** the renderer cannot access Node APIs directly (preload is the only bridge)

4. **Given** the preload IPC bridge is misconfigured or unavailable  
   **When** the renderer attempts the sample IPC call  
   **Then** the renderer receives a clear error response (not a hang)  
   **And** the app remains usable (no crash / frozen UI)

## Tasks / Subtasks

- [x] Scaffold Electron Forge app using `vite-typescript` template
  - [x] Verify `npm run start` (or Forge-equivalent) launches without errors
- [x] Add React to the Vite renderer build
  - [x] Install `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`
  - [x] Render a minimal React app in the main window
- [x] Establish typed IPC contract + validation (single contract module)
  - [x] Define `ipc.contract.ts` with channel names + request/response Zod schemas
  - [x] Implement main handler with `ipcMain.handle()` returning stable envelopes
  - [x] Implement preload `contextBridge` API exposing only the typed endpoints
  - [x] Implement renderer client wrapper that calls `ipcRenderer.invoke()` via preload
- [x] Implement sample IPC endpoint used by the renderer UI
  - [x] “Ping”/“getAppInfo” style endpoint with a deterministic response payload
  - [x] UI button triggers call and renders success + error states
- [x] Guardrail: ensure security boundaries are enforced
  - [x] Confirm renderer cannot access Node APIs (no `nodeIntegration`; use preload only)
  - [x] Confirm failure modes return `{ ok: false, error }` and do not crash/hang

## Dev Notes

- **Scope guardrail:** This story is only about creating a working baseline app + typed IPC demo. Do **not** start building connection profiles, secrets storage, explorer UI, or domain logic beyond what’s needed for a clean scaffold.
- **Security boundary is a requirement:** renderer is UI-only. No direct Node access from renderer; preload is the only bridge.
- **IPC contract rules (must follow):**
  - Renderer calls into main via `ipcRenderer.invoke()` mediated by preload.
  - Define endpoints in a single contract module (channel names + request/response Zod schemas).
  - Validate inputs/outputs with Zod in main handlers.
  - Return a stable envelope `{ ok: true, data } | { ok: false, error: { code, message, details? } }` (do not rely on thrown `Error` serialization).
- **Failure behavior:** if preload API is missing/misconfigured, renderer must show an error state and stay responsive (no hangs).
- **Keep dependencies minimal:** install only what’s needed for Forge+Vite+TS+React and IPC contract validation; avoid adding state management, routing, styling systems, or UI kits in this story (stub is fine).

### Project Structure Notes

- Align the scaffold to the intended long-term structure from architecture (main/preload/renderer separation), even if the Forge starter uses slightly different default paths.
- Target structure (high level):
  - `src/main/*` for Electron main process entry + IPC handlers
  - `src/preload/*` for `contextBridge` API
  - `src/renderer/*` for React UI
- Add a minimal “IPC demo” UI surface in the renderer (button + response rendering) and keep it isolated so it can be removed later without impacting feature code.

## Technical Requirements

- **Electron security defaults (required):**
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true` (unless Forge template constraints force otherwise; if deviating, document why)
  - No `enableRemoteModule`
  - Use preload + `contextBridge` only; do not expose `ipcRenderer` directly to window
- **Typed IPC (required):**
  - One contract file for channel names + request/response schemas (Zod).
  - Main must validate request input with Zod before doing any work.
  - Main must validate response output shape with Zod before returning.
  - Errors must be normalized to `{ ok: false, error: { code, message, details? } }` (no uncaught throws across IPC).
- **Structured clone safe payloads:** only plain JSON-like values over IPC (no class instances, Buffers, Errors, Dates without serialization).
- **Jobs model (not required yet):** do not build job manager in this story, but ensure the IPC contract pattern won’t block adopting the “jobs” pattern later.
- **No persistence yet:** do not add SQLite/Drizzle/electron-store in this story (bootstrap only).

## Architecture Compliance

- **Process boundaries (non-negotiable):**
  - Renderer = UI only; never does network, secrets, or filesystem.
  - Preload = the only bridge; minimal typed surface.
  - Main = IPC handlers, future persistence/networking/jobs; in this story, only the demo handler.
- **IPC patterns (must match architecture):**
  - Use `ipcRenderer.invoke()` + `ipcMain.handle()` for request/response.
  - Use stable envelopes for errors and success; never return raw `Error`.
  - Keep arguments/results structured-clone safe.
- **Future-proofing:** keep the contract + handler patterns compatible with later “jobs” pattern (start/cancel/progress/done), but do not implement jobs yet.
- **UX/Design constraints:** do not implement the full design system here; keep UI minimal and accessible (button + output), so later Tailwind/tokens/shadcn adoption remains clean.

## Library / Framework Requirements

- **Bootstrap tooling:** use Electron Forge + `@electron-forge/plugin-vite` (Forge `vite-typescript` starter).
- **Renderer stack:** React + TypeScript via Vite plugin react.
- **Validation:** Zod for IPC request/response schema validation.
- **“Latest” guidance (as of 2026-02-08):**
  - `create-electron-app` `7.11.1`, `@electron-forge/cli` `7.11.1`, `@electron-forge/plugin-vite` `7.11.1`
  - `vite` `7.3.1`
  - `react`/`react-dom` `19.2.4`
  - `zod` `4.3.6`
  - **Do not hardcode these in the story implementation.** Use `@latest` for scaffolding and let `package-lock.json` pin resolved versions; validate dev/package flows after install.
- **Avoid:** adding state libraries, routers, UI kits, CSS frameworks, or DB libraries in this story.

## Latest Tech Information

- Verified `npm` registry versions on **2026-02-08** (during story creation):
  - Forge: `create-electron-app@7.11.1`, `@electron-forge/cli@7.11.1`, `@electron-forge/plugin-vite@7.11.1`
  - Vite: `vite@7.3.1`
  - React: `react@19.2.4`, `react-dom@19.2.4`
  - Zod: `zod@4.3.6`
- Implementation guidance:
  - Use the Forge `@latest` scaffolder; rely on the lockfile to pin exact versions.
  - After installs, run: dev (`start`) + package/make (Forge) once to confirm no Forge/Vite integration drift.

## File Structure Requirements

- Keep a clear separation between processes. Even if the starter’s defaults differ, converge toward:
  - `src/main/` (main entry + IPC handlers + shared error mapping)
  - `src/preload/` (typed `contextBridge` API surface)
  - `src/renderer/` (React UI + minimal IPC client wrapper)
- **Contract location:** one canonical contract module under `src/main/ipc/ipc.contract.ts` (or equivalent) used by:
  - main handlers (authoritative validation)
  - preload API (typed exposure)
  - renderer client wrapper (typed usage)
- **Error mapping:** keep a dedicated error utility (e.g., `src/main/ipc/errors.ts`) to normalize errors to the stable envelope.

## Testing Requirements

- **Minimum verification (this story):**
  - Manual smoke test: app launches, IPC call success, IPC call failure path (simulate missing preload export or wrong channel) shows error and UI stays responsive.
  - No flake: repeat dev launch twice; ensure no port collisions or stale processes.
- **Optional (if the starter includes test tooling already):**
  - Add one small unit test for the error-normalization helper (pure function) to lock the envelope format.
  - Do not introduce an entire new test framework if none exists yet; defer to later architecture/testing story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.1`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Selected Starter`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#API & Communication Patterns (Electron IPC)`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Themeable, token-driven custom system using TailwindCSS + headless UI primitives` (for “defer styling system” rationale)]
- [Source: `_bmad-output/planning-artifacts/prd.md#macOS` (platform expectations note)]
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-02-08.md`]

## Project Context Reference

- **Core planning artifacts (authoritative for this story):**
  - `_bmad-output/planning-artifacts/epics.md` (Epic 1 / Story 1.1)
  - `_bmad-output/planning-artifacts/architecture.md` (stack, boundaries, IPC)
- **UX constraints (for deferrals + future alignment):**
  - `_bmad-output/planning-artifacts/ux-design-specification.md` (token-driven Tailwind + primitives; density modes)
- **Product requirements background:**
  - `_bmad-output/planning-artifacts/prd.md`
- **Readiness snapshot:**
  - `_bmad-output/planning-artifacts/implementation-readiness-report-2026-02-08.md`
- **Note:** no `project-context.md` file was discovered via `**/project-context.md` at story creation time.

## Story Completion Status

- Status: **done**
- Completion note: Implemented Forge + Vite + React bootstrap with typed IPC contract, envelope validation, preload-only bridge, and smoke/package validation; applied senior code-review fixes and revalidated.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Codex CLI)

### Debug Log References
- `npm run start` (dev launch smoke test; passed)
- `npm run lint` (passed)
- `npm test` (5 tests passed)
- `npm run package` (passed)

### Completion Notes List

- Scaffolded Electron Forge `vite-typescript` app and merged generated project into repo root.
- Added React renderer entrypoint and minimal IPC demo UI (`Get App Info` button + envelope output).
- Implemented typed IPC contract (`Zod` schemas) and envelope validation in main + preload + renderer client.
- Enforced renderer security boundary (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload-only bridge).
- Added unit tests for error normalization and renderer fallback when preload bridge is unavailable.
- Applied code-review fixes:
  - structured-clone-safe IPC error detail serialization
  - renderer IPC timeout fallback for hung/misconfigured bridge
  - `finally`-guarded renderer loading state reset
- Validated with `npm run lint`, `npm test`, `npm run start`, and `npm run package`.

### File List

- `.eslintrc.json`
- `.gitignore`
- `forge.config.ts`
- `forge.env.d.ts`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.main.config.ts`
- `vite.preload.config.ts`
- `vite.renderer.config.mts`
- `src/main/index.ts`
- `src/main/ipc/ipc.contract.ts`
- `src/main/ipc/errors.ts`
- `src/main/ipc/errors.test.ts`
- `src/main/ipc/handlers.ts`
- `src/preload/index.ts`
- `src/renderer/App.tsx`
- `src/renderer/global.d.ts`
- `src/renderer/ipc/client.ts`
- `src/renderer/ipc/client.test.ts`
- `src/renderer/main.tsx`
- `src/renderer/styles.css`
- `_bmad-output/implementation-artifacts/1-1-project-bootstrap-forge-vite-react-typed-ipc.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Senior Developer Review (AI)

- Date: 2026-02-08
- Reviewer: Jay (AI-assisted)
- Outcome: Changes requested and fixed in same review cycle

Resolved findings:
- HIGH: `src/main/ipc/errors.ts` returned non-structured-clone-safe `details` for unknown errors.
  - Fix: Added defensive serialization for objects/arrays/functions/symbols/bigint/circular references.
  - Validation: `src/main/ipc/errors.test.ts` includes non-clone-safe payload coverage.
- HIGH: renderer IPC request could hang indefinitely if preload bridge invocation never resolves.
  - Fix: Added timeout envelope fallback (`IPC_TIMEOUT`) in `src/renderer/ipc/client.ts`.
  - Validation: `src/renderer/ipc/client.test.ts` includes hanging-call timeout scenario.
- MEDIUM: Dev Agent Record File List omitted `src/main/ipc/handlers.ts`.
  - Fix: Added missing file to File List.
- LOW: loading state reset in `src/renderer/App.tsx` relied on happy path only.
  - Fix: Wrapped request handling in `try/finally`.

## Change Log

- 2026-02-08: Completed Story 1.1 implementation, added typed IPC demo and tests, and moved story to review.
- 2026-02-08: Completed senior code review, fixed all HIGH/MEDIUM findings, and moved story to done.
