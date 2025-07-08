---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/ux-design-directions.html
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-08T17:00:58+07:00'
project_name: 'cachify-studio'
user_name: 'Jay'
date: '2026-02-08T17:00:58+07:00'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (52 total, grouped):**
- Connection profiles & sessions (create/edit/delete, tags/favorites/search, connect/disconnect, status/errors, prompt vs save creds)
- Environment identification & safety modes (env labels, always-visible env state, prod read-only by default, unlock mutations on/off, mode visibility)
- Redis exploration & inspection (keys via prefix/tree + search; type/TTL metadata; inspect strings, hashes, lists, sets, zsets, streams)
- Memcached (get/set when unlocked; stats; limited metadata)
- Value presentation (redaction-by-default + deliberate reveal; raw vs formatted; decode pipeline; safe copy)
- Mutations (gated by unlock; type-aware operations; key delete; feedback)
- Search UX (saved searches; history/recent)
- Sharing/export (redacted snippet + minimal Markdown bundle with context)
- Desktop integration (tray; global shortcut)
- Local persistence (prefs/profiles/saved searches/exports; no fetched values by default)
- Update awareness (check online; prompt to install)

**Non-Functional Requirements (18 total):**
- Performance targets (launch, connect, search, inspect)
- Reliability (no UI lockups; cancellation; safety limits; recoverable networking)
- Security/privacy (OS keychain; TLS surfaced; redaction-by-default)
- Offline/local-data boundaries (state local; values not persisted by default)
- Accessibility/usability (keyboard-first; focus/contrast)
- Safety limits (1MB decoded preview cap; depth cap; export escape hatches)

**Scale & Complexity:**
- Primary domain: desktop app (offline-first) + direct cache connectivity (Redis/Memcached)
- Complexity level: medium
- Estimated architectural components: ~10–14 (connection adapters, policy/safety, persistence, search/scan engine, inspector/decoding, export, dashboard analytics, playbooks, update service, etc.)

### Technical Constraints & Dependencies

- No backend required; everything runs locally.
- Secrets must use OS credential store/keychain (no plaintext on disk).
- Do not persist fetched cache values by default; exports are explicit artifacts.
- Production connections enforce read-only by default; unlock is explicit (time-boxed recommended).
- Cross-platform packaging and update distribution via GitHub Releases; signing/notarization expected per platform.
- Must remain responsive under large keyspaces/values via progressive loading, cancellation, and caps.

### Cross-Cutting Concerns Identified

- Security & privacy: credential storage, TLS posture visibility, redaction/reveal/copy defaults.
- Safety & policy: env labeling, read-only enforcement, mutation gating, dangerous ops strategy.
- Performance: search/scan semantics, virtualization, streaming results, decode limits.
- Offline boundaries: what persists and what never does; export provenance.
- UX consistency: always-visible trust chip + predictable escape/focus behaviors; WCAG 2.1 AA target.

## Starter Template Evaluation

### Primary Technology Domain

Desktop application (cross-platform) with local-first state and direct cache connectivity (Redis/Memcached).

### Starter Options Considered

- Electron Forge + Webpack (+ TypeScript): most “established” bundling path, but slower iteration and more config friction for a UI-heavy product.
- Electron Forge + Vite (+ TypeScript): fast dev loop/HMR that better matches the product’s UX ambitions and complex UI surfaces.
- Tauri: not selected (preference is Electron Forge).

### Selected Starter: Electron Forge `vite-typescript` + React (renderer)

**Rationale for Selection:**
- Matches preference: Electron Forge + Vite + TypeScript + React.
- Optimizes development experience for a UI-heavy desktop app (fast refresh, tight feedback loops).
- Keeps packaging/distribution on the Forge path while we iterate product features.

**Notes on currency / “latest”:**
- Use `@latest` bootstrap commands and allow the lockfile to pin actual resolved versions.
- Treat Forge+Vite integration as potentially breaking across minor releases; keep CI/build validation tight and follow Forge release notes when updating.

**Initialization Command:**

```bash
# Optionally force npm if you have yarn on PATH:
# NODE_INSTALLER=npm npx create-electron-app@latest cachify-studio --template=vite-typescript

npx create-electron-app@latest cachify-studio --template=vite-typescript
cd cachify-studio

# Add React to the Vite renderer
npm install react react-dom
npm install --save-dev @types/react @types/react-dom @vitejs/plugin-react
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript-first Electron app structure with process separation (main vs preload vs renderer) supported by Forge’s Vite template.

**Styling Solution:**
- Not dictated by the starter; we will adopt the token-driven approach described in UX (Tailwind + semantic tokens) as an explicit architecture decision.

**Build Tooling:**
- Electron Forge lifecycle (dev/package/make/publish), with Vite-driven builds for main/preload/renderer under `@electron-forge/plugin-vite`.

**Testing Framework:**
- Not strongly prescribed by the starter; we’ll choose explicitly based on desktop needs (unit + E2E).

**Code Organization:**
- The starter enforces security-relevant boundaries (renderer isolated; preload as the IPC bridge), which aligns with the product’s safety posture.

**Development Experience:**
- Vite dev server + HMR for renderer; modern DX for iterating on Explorer/Inspector/Dashboard/Playbooks surfaces.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Data Architecture

**Local persistence approach (Hybrid):**
- Preferences/UI state: `electron-store` (pin exact version in lockfile)
- Structured app data: SQLite file stored under Electron `userData` (e.g., `cachify.sqlite`)

**SQLite access + ORM (pin exact versions in lockfile):**
- SQLite driver: `better-sqlite3`
- ORM: Drizzle (`drizzle-orm`)
- Migrations: `drizzle-kit`

**Process boundary (security + consistency):**
- Main process is the single writer/reader for SQLite and prefs.
- Renderer accesses persistence via typed IPC APIs (no direct DB/file access).

**Secrets policy alignment:**
- Credentials never stored in SQLite or `electron-store`; use OS keychain only.
- SQLite stores non-secret metadata only (profiles, tags, saved searches, recents/history, exports index/provenance).

**Packaging note:**
- `better-sqlite3` is a native module; ensure Forge rebuild/unpack configuration supports native deps for all target platforms.

### Authentication & Security

**Credential storage (secrets):**
- Store Redis/Memcached credentials using Electron `safeStorage` (OS-backed encryption where available).
- If `safeStorage.getSelectedStorageBackend() === "basic_text"`:
  - Disable “Save credentials” and force “Prompt every time”.
  - Notify the user why (system keyring not available; saving would be insecure) and provide guidance for enabling a supported keyring on Linux.

**Secrets boundaries:**
- Never store credentials in SQLite or `electron-store`.
- Only store non-secret connection metadata in SQLite (host/port/name/env labels, auth mode selection, TLS settings metadata without private keys, last-used timestamps, tags/favorites).

**Redis authentication:**
- Support both:
  - Password auth
  - ACL auth (username + password)

**Memcached authentication:**
- Support:
  - No auth (default)
  - SASL auth (optional per connection profile)

**Transport security (Redis):**
- Support TLS on/off per profile.
- Support custom CA bundles for TLS verification (no silent insecure fallback).
- mTLS client certificates: deferred (unless explicitly required).

**Deferred network posture:**
- SSH tunnels: deferred (requires key management, known_hosts verification, and tunnel lifecycle UX).

### API & Communication Patterns (Electron IPC)

**IPC primitives:**
- Renderer → Main request/response: `ipcRenderer.invoke()` + `ipcMain.handle()`
- Main → Renderer events (progress/state): event subscriptions wired through preload

**Serialization contract:**
- IPC arguments/results must be structured-clone safe (plain objects/arrays/strings/numbers/booleans).
- Avoid sending complex Electron/DOM objects over IPC.

**Typed IPC contract:**
- Define all IPC endpoints in a single contract module (names + request/response schemas).
- Validate inputs and outputs with Zod.
- Expose a small, typed preload API surface (no generic “send any channel”).

**Error handling (stable envelopes):**
- Standard response envelope from main:
  - `{ ok: true, data }`
  - `{ ok: false, error: { code, message, details? } }`
- Main handlers must not rely on thrown Errors reaching renderer intact; always map to the envelope.

**Long-running operations (search/scan/export):**
- Model as “jobs” managed in main:
  - `startX(request) -> { jobId }`
  - `cancelJob({ jobId }) -> { ok }`
  - progress events: `job:progress` `{ jobId, phase, percent?, message?, partial? }`
  - completion event: `job:done` `{ jobId, resultEnvelope }`
- Jobs are cancelable and must not block UI; partial results are allowed where feasible.

**Concurrency / worker model:**
- Network I/O to Redis/Memcached stays in main using async I/O.
- CPU-heavy tasks (decode pipeline stages, JSON pretty-printing, redaction transforms, diffing) run in `node:worker_threads` to keep main/renderer responsive.

### Frontend Architecture (React renderer)

**Routing (surfaces):**
- Use React Router for in-app routing between primary surfaces:
  - `/dashboard` (TTL heatmap hero + storm panel)
  - `/explorer` (connections-first + key results + inspector)
  - `/playbooks` (safe recipes + outputs)
- Single-window model; routing is purely within the renderer.

**State management:**
- Use Zustand for renderer state:
  - UI state (selected connection, filters, view modes, inspector selection)
  - Job state mirrors (progress, cancelability, results pointers)
- Persisted state is stored via main-process persistence (SQLite/electron-store) and accessed via IPC (renderer does not write local files directly).

**Component primitives & UI library:**
- Use shadcn-style “copy-in” components, configured to use Base UI primitives (not Radix).
- Primitive dependency: Base UI (`@base-ui/react`).
- Tailwind + semantic tokens for styling (per UX spec).

**Accessibility & UX consistency:**
- Keyboard-first navigation, consistent escape behavior, focus management.
- Always-visible TrustChip + env/safety state in chrome and inspector.

### Infrastructure & Deployment (Desktop Distribution)

**Release channel:**
- GitHub Releases is the distribution source of truth.
- App checks for updates when online and prompts the user to install (no forced silent installs).

**Packaging targets (Electron Forge makers):**
- Windows: Squirrel.Windows (`@electron-forge/maker-squirrel`)
- macOS: DMG + ZIP (`@electron-forge/maker-dmg`, `@electron-forge/maker-zip`)
- Linux: DEB + RPM + ZIP (`@electron-forge/maker-deb`, `@electron-forge/maker-rpm`, `@electron-forge/maker-zip`)

**Build/CI:**
- GitHub Actions matrix builds (Windows/macOS/Linux) on tag/release.
- CI produces artifacts, attaches them to the GitHub Release, and includes checksums.

**Signing / trust (recommended before public release):**
- macOS: code signing + notarization.
- Windows: code signing to reduce SmartScreen friction.

**Update implementation (manual, per decision):**
- Use GitHub Releases API to check latest version and provide a “Download update” prompt.
- Installation is user-driven via downloaded installer/package.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
~10+ areas where AI agents could make different choices (naming, file structure, IPC shapes, DB schema, error handling, job progress, logging).

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural (e.g., `connection_profiles`, `saved_searches`, `recent_keys`)
- Columns: `snake_case` (e.g., `created_at`, `last_used_at`, `env_label`)
- Primary keys: `id` (consistent type across tables)
- Foreign keys: `<table>_id` (e.g., `connection_profile_id`)
- Indexes: `idx_<table>__<col1>_<col2>` (e.g., `idx_recent_keys__connection_profile_id_last_used_at`)

**API/IPC Naming Conventions:**
- IPC channels: `domain:action` (e.g., `connections:list`, `connections:save`, `keys:search:start`, `jobs:cancel`)
- Job events: `job:progress`, `job:done`
- Error codes: `SCREAMING_SNAKE_CASE` (e.g., `CONNECTION_REFUSED`, `AUTH_FAILED`, `TLS_CERT_INVALID`, `CAP_REACHED`)

**Code Naming Conventions:**
- TypeScript: `camelCase` variables/functions, `PascalCase` React components
- Files:
  - React components: `PascalCase.tsx` (e.g., `TrustChip.tsx`)
  - Feature modules: `kebab-case/` folders (e.g., `features/explorer/`)
  - Stores: `something.store.ts`
  - IPC contract: `ipc.contract.ts`

### Structure Patterns

**Project Organization (renderer):**
- Organize by feature first:
  - `features/dashboard/*`
  - `features/explorer/*`
  - `features/playbooks/*`
- Shared UI primitives/components live in `ui/*` (shadcn-style copy-in components).
- Shared utilities live in `shared/*` (pure, no Electron imports).
- Zustand stores live in `stores/*` (or feature-local `stores/`) — pick one approach and keep it consistent.

**Project Organization (main):**
- `main/services/*` for connection + key scanning + export services
- `main/persistence/*` for SQLite + electron-store adapters
- `main/ipc/*` for handlers implementing the contract
- `main/jobs/*` for job manager (progress/cancel)

**Tests:**
- Co-locate unit tests as `*.test.ts` near the module.
- E2E tests (if/when added) live under `e2e/*`.

### Format Patterns

**IPC response envelope (mandatory):**
- Success: `{ ok: true, data }`
- Failure: `{ ok: false, error: { code, message, details? } }`
- Never throw raw errors across IPC boundaries.

**Dates/times:**
- Persist timestamps in one standard format across SQLite + IPC + UI (ISO strings or unix ms).
- UI displays localized, but IPC/persistence remains consistent.

**JSON naming:**
- IPC payload fields use `camelCase`.
- SQLite columns use `snake_case`.
- Mapping happens only in the main persistence layer.

### Communication Patterns

**Job model (mandatory):**
- Start returns `{ jobId }`.
- Progress events include `{ jobId, phase }` and may include `{ percent, message, partial }`.
- Cancel is idempotent.

**State management:**
- Renderer treats main as source of truth for persisted data.
- Zustand stores keep ephemeral UI state + job mirrors; persisted changes always round-trip via IPC.

### Process Patterns

**Error handling:**
- Categorize errors as user-facing actionable vs internal/unknown.
- User-facing errors include next actions (retry, open connection settings, view details).

**Loading states:**
- Every async operation uses explicit states: `idle | loading | success | error`.
- Long operations use the job system; UI must show Cancel.

### Enforcement Guidelines

**All AI Agents MUST:**
- Use the IPC envelope format and contract module (no ad-hoc channels).
- Use `snake_case` in SQLite and `camelCase` in IPC/UI.
- Keep persistence IO only in main; renderer never touches DB/files.

**Pattern Enforcement:**
- Keep these rules in the architecture doc and require stories/PRs to reference them.
- CI checks: lint + typecheck; optional schema drift checks via migrations.

### Pattern Examples

**Good Examples:**
- IPC handler returns `{ ok: false, error: { code: "AUTH_FAILED", message: "...", details: {...} } }`
- Job progress event `{ jobId, phase: "scanning", percent: 42 }`

**Anti-Patterns:**
- Renderer writes directly to the SQLite file
- Mixing `snake_case` fields in IPC payloads
- Creating new IPC channels without adding them to the contract module

## Project Structure & Boundaries

### Complete Project Directory Structure

```
cachify-studio/
├── README.md
├── package.json
├── package-lock.json
├── .gitignore
├── .editorconfig
├── .env.example
├── forge.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.renderer.json
├── drizzle.config.ts
├── migrations/
│   └── sqlite/
├── assets/
│   ├── icons/
│   └── screenshots/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   ├── app/
│   │   │   ├── window.ts
│   │   │   ├── tray.ts
│   │   │   ├── shortcuts.ts
│   │   │   └── updates.ts
│   │   ├── ipc/
│   │   │   ├── ipc.contract.ts
│   │   │   ├── handlers/
│   │   │   │   ├── connections.handlers.ts
│   │   │   │   ├── explorer.handlers.ts
│   │   │   │   ├── inspector.handlers.ts
│   │   │   │   ├── playbooks.handlers.ts
│   │   │   │   ├── exports.handlers.ts
│   │   │   │   └── jobs.handlers.ts
│   │   │   └── errors.ts
│   │   ├── jobs/
│   │   │   ├── job-manager.ts
│   │   │   ├── job-events.ts
│   │   │   └── job-types.ts
│   │   ├── domain/
│   │   │   ├── cache/
│   │   │   │   ├── clients/
│   │   │   │   │   ├── redis.client.ts
│   │   │   │   │   └── memcached.client.ts
│   │   │   │   ├── explorer/
│   │   │   │   │   ├── key-scan.ts
│   │   │   │   │   ├── key-search.ts
│   │   │   │   │   └── ttl-sampling.ts
│   │   │   │   ├── inspector/
│   │   │   │   │   ├── fetch.ts
│   │   │   │   │   ├── decode/
│   │   │   │   │   │   ├── pipeline.ts
│   │   │   │   │   │   ├── caps.ts
│   │   │   │   │   │   └── stages/
│   │   │   │   │   └── types.ts
│   │   │   │   └── dashboard/
│   │   │   │       ├── ttl-heatmap.ts
│   │   │   │       └── storm-signal.ts
│   │   │   ├── persistence/
│   │   │   │   ├── db.ts
│   │   │   │   ├── schema/
│   │   │   │   │   ├── connection-profiles.schema.ts
│   │   │   │   │   ├── saved-searches.schema.ts
│   │   │   │   │   ├── recent-keys.schema.ts
│   │   │   │   │   └── exports-index.schema.ts
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── connection-profiles.repo.ts
│   │   │   │   │   ├── saved-searches.repo.ts
│   │   │   │   │   ├── recent-keys.repo.ts
│   │   │   │   │   └── exports-index.repo.ts
│   │   │   │   └── prefs.store.ts
│   │   │   ├── security/
│   │   │   │   ├── safe-storage.ts
│   │   │   │   ├── secrets.ts
│   │   │   │   └── redaction.ts
│   │   │   ├── exports/
│   │   │   │   ├── bundle.ts
│   │   │   │   └── provenance.ts
│   │   │   └── playbooks/
│   │   │       ├── runner.ts
│   │   │       └── outputs.ts
│   │   ├── workers/
│   │   │   ├── decode.worker.ts
│   │   │   └── redaction.worker.ts
│   │   └── shared/
│   │       ├── types/
│   │       ├── constants/
│   │       └── time.ts
│   ├── preload/
│   │   ├── preload.ts
│   │   └── api.ts
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── app/
│       │   ├── router.tsx
│       │   ├── layout.tsx
│       │   └── error-boundary.tsx
│       ├── ui/
│       │   └── (shadcn/base-ui copy-in components)
│       ├── shared/
│       │   ├── ipc/
│       │   │   └── client.ts
│       │   └── types/
│       ├── stores/
│       │   ├── app.store.ts
│       │   ├── connections.store.ts
│       │   ├── explorer.store.ts
│       │   ├── inspector.store.ts
│       │   └── jobs.store.ts
│       └── features/
│           ├── dashboard/
│           │   ├── DashboardPage.tsx
│           │   └── components/
│           ├── explorer/
│           │   ├── ExplorerPage.tsx
│           │   └── components/
│           └── playbooks/
│               ├── PlaybooksPage.tsx
│               └── components/
├── tests/
│   ├── main/
│   ├── renderer/
│   └── fixtures/
└── e2e/
    └── (optional later)
```

### Architectural Boundaries

- Renderer = UI only; calls main via preload typed API.
- Preload = only bridge; minimal typed surface.
- Main = persistence, networking, jobs, secrets.
- Domain rule: business logic goes under `src/main/domain/*`; Electron “shell wiring” stays in `src/main/app/*`.

### Requirements → Structure Mapping (high level)

- Profiles/safety: `src/main/domain/persistence/*`, `src/main/domain/security/*`, renderer explorer feature
- Explorer: `src/main/domain/cache/explorer/*`, renderer explorer feature
- Inspector/decode/caps: `src/main/domain/cache/inspector/*` + `src/main/workers/*`
- Dashboard heatmap/storm: `src/main/domain/cache/dashboard/*`, renderer dashboard feature
- Exports: `src/main/domain/exports/*` + persistence exports index
- Playbooks: `src/main/domain/playbooks/*` + renderer playbooks feature
- Updates: `src/main/app/updates.ts` (manual GitHub Releases check + prompt)

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- Electron Forge + Vite + TypeScript + React renderer + typed IPC + worker_threads is coherent and supports the required desktop UX.
- Persistence/security boundaries are compatible (main-only IO; secrets via `safeStorage`; no fetched values persisted by default).
- Deployment choices align with the offline-first/no-backend posture (manual update prompt; GitHub Releases distribution).

**Pattern Consistency:**
- IPC envelope + contract module patterns align with Electron IPC constraints and keep renderer logic stable.
- Naming conventions (SQLite `snake_case`, IPC/UI `camelCase`) have an explicit mapping boundary (main persistence layer).
- Job model patterns align with performance requirements (cancelable/progressive operations; no UI lockups).

**Structure Alignment:**
- The `src/main/domain/*` rule cleanly contains business logic; `src/main/app/*` contains Electron shell wiring.
- Integration points (cache clients, decode workers, persistence, exports) have defined homes and do not require ad-hoc folders.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
- Connections/profiles at scale, environment labels, and safety modes are supported via SQLite + main IPC handlers + renderer surfaces.
- Redis exploration/inspection (keys/types/TTL) and Memcached basics are supported by explicit cache domain modules and the job model.
- Safe value viewing (Pretty/Raw), decode pipeline, redaction, and safety caps are supported via inspector domain + worker_threads.
- Saved searches/recents and export bundles are supported via persistence schema + exports domain + renderer export UI.
- Tray menu and global shortcut are supported via `src/main/app/*`.
- Update awareness is supported via manual GitHub Releases check + prompt.

**Non-Functional Requirements Coverage:**
- Performance/responsiveness: job model + worker_threads + progressive/cancelable operations + caps.
- Security/privacy: `safeStorage` secrets; disable saving when backend is `basic_text`; TLS + custom CA; secrets never stored in SQLite/electron-store.
- Offline-first: local persistence for app state; no backend required; exports are explicit artifacts.
- Accessibility/usability: keyboard-first patterns, focus management, and consistent escape behavior are part of the frontend and pattern rules.

### Implementation Readiness Validation ✅

**Decision Completeness:**
- Stack, persistence, IPC, security posture, and distribution/update strategy are documented and consistent.

**Structure Completeness:**
- A concrete project tree exists with defined boundaries and integration points.

**Pattern Completeness:**
- Critical agent-conflict areas (naming, IPC envelopes, job model, IO boundaries) are addressed with enforceable rules and examples.

### Gap Analysis Results

**Important (not blocking):**
- Choose one timestamp storage standard across SQLite + IPC (ISO strings vs unix ms).
- Specify “unlock mutations” mechanics (default duration, re-lock triggers, UX affordances).
- Define key search/scan semantics (limits, cancellation granularity, progressive results, sampling).
- Define logging strategy and redaction in logs (especially for values/errors).

**Deferred (explicit):**
- Redis mTLS client certificates (defer unless required).
- SSH tunnels (defer; requires key management + known_hosts verification + lifecycle UX).

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION  
**Confidence Level:** High

**Key Strengths:**
- Clear process boundaries (renderer/preload/main) with typed IPC + job model.
- Explicit security posture (safeStorage rules; no-secrets-in-db; Linux `basic_text` guard).
- Concrete project structure and naming conventions reduce multi-agent drift.

**Areas for Future Enhancement:**
- Optional testing strategy decisions (unit/e2e tooling) and first end-to-end smoke test.
- Linux keyring guidance UX copy and troubleshooting docs.

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions and implementation patterns exactly as documented.
- Respect boundaries: renderer UI only, preload bridge only, main owns IO/network/secrets.
- Use the IPC contract module and envelope format; do not invent new channels ad-hoc.

**First Implementation Priority:**
- Initialize the project using the selected Forge template (`vite-typescript`) and establish:
  - IPC contract module + job manager skeleton
  - SQLite + Drizzle schema/migrations skeleton
  - `safeStorage` secrets adapter with Linux `basic_text` disable-save behavior
