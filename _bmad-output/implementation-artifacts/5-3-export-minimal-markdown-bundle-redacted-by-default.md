# Story 5.3: Export Minimal Markdown Bundle (Redacted by Default)

Status: done

Generated: 2026-02-13
Story Key: `5-3-export-minimal-markdown-bundle-redacted-by-default`

## Story

As a cache user,
I want to export a minimal single-file Markdown bundle with safe context,
so that I can share evidence offline without exposing secrets.

## Acceptance Criteria

1. **Given** an inspected key/value  
   **When** I export the Markdown bundle  
   **Then** it includes key metadata, decode context, and a redacted preview by default (FR42, NFR11).

2. **Given** the export completes  
   **When** I locate it  
   **Then** the artifact is saved locally as an explicit export (FR49).

## Tasks / Subtasks

- [x] Implement Markdown export builder for inspected results (AC: 1)
  - [x] Create formatter that produces a single-file Markdown bundle with: environment label, key, type, TTL, decode pipeline/view mode, and redacted preview.
  - [x] Reuse existing redaction output and metadata from inspector results; do not invent a second redaction pipeline.
  - [x] Include explicit note when preview is truncated/capped and preserve existing "export raw/partial later" guidance language.
- [x] Add local export persistence/index for artifact tracking (AC: 2)
  - [x] Add SQLite table + migration for export artifact index metadata (path, createdAt, profileId, key, redaction policy/version, preview mode).
  - [x] Save artifact files under a dedicated local exports folder managed by main process.
  - [x] Store only artifact metadata in SQLite; do not persist fetched raw cache value snapshots outside explicit artifact content.
- [x] Add typed IPC + preload API for export actions (AC: 1, 2)
  - [x] Add `exports:markdown:create` channel and strict request/response Zod schemas.
  - [x] Ensure responses follow existing envelope format and actionable error codes.
  - [x] Register handler in `register-handlers.ts` using existing validation and persistence-availability patterns.
- [x] Integrate export action in explorer inspector UI (AC: 1, 2)
  - [x] Add explicit “Export Markdown bundle” action in `RedisExplorerPanel.tsx` tied to currently inspected item.
  - [x] Show success feedback with output file path (or summary) and resilient failure feedback.
  - [x] Keep default export mode redacted and require deliberate user action for any revealed/raw export mode in future scope.
- [x] Add tests across domain/IPC/renderer (AC: 1, 2)
  - [x] Domain tests for markdown content structure, redaction defaults, and capped preview notes.
  - [x] Persistence tests for export index insert/list behavior.
  - [x] IPC tests for validation failures and envelope responses.
  - [x] Renderer tests for triggering export and showing success/failure states.

## Dev Notes

### Developer Context

This story converts inspector findings into shareable, offline-safe evidence artifacts. The implementation must keep the current safety posture: redaction-by-default, explicit user intent, and no hidden persistence of fetched values.

### Technical Requirements

- Export content contract (minimum):
  - Story-safe context: env label, key identifier, key type, TTL (if available), inspected timestamp.
  - Decode context: active pipeline/view mode + relevant decode status/failure details.
  - Value section: redacted preview by default with policy/version and redacted segment count.
- Reuse existing inspector/redaction primitives:
  - Redaction logic already exists in `src/main/domain/security/redaction.ts` and inspector normalization.
  - Copy/export should share the same safety semantics where feasible.
- Artifact storage:
  - Main process writes the markdown file locally.
  - Index metadata persisted in SQLite for FR49 traceability.
- Error handling:
  - Return stable envelopes and actionable error codes (`VALIDATION_ERROR`, `EXPORT_WRITE_FAILED`, `PERSISTENCE_UNAVAILABLE`, etc.).

### Architecture Compliance

- Process boundaries:
  - Renderer requests export and surfaces user feedback.
  - Preload is typed bridge.
  - Main owns file IO, markdown assembly, and export index persistence.
- Data boundaries:
  - Do not persist fetched cache values by default.
  - Persist explicit artifact only when user triggers export.
- Consistency:
  - Keep IPC channel + Zod schema conventions in `src/shared/ipc/ipc.contract.ts`.

### Library / Framework Requirements

Latest checks completed on 2026-02-13 (npm registry):
- `electron`: latest `40.4.0` (project `40.2.1`)
- `react`: latest `19.2.4` (project `19.2.0`)
- `zod`: latest `4.3.6` (project `4.1.5`)
- `drizzle-orm`: latest `0.45.1` (project `0.44.5`)
- `better-sqlite3`: latest `12.6.2` (project `12.4.1`)
- `vite`: latest `7.3.1` (project aligned)
- `vitest`: latest `4.0.18` (project aligned)
- `tailwindcss`: latest `4.1.18` (project aligned)

No dependency upgrade is required for this story.

### File Structure Requirements

Primary files to create/update:
- `src/main/domain/exports/markdown-bundle.service.ts` (new)
- `src/main/domain/persistence/schema/exports-index.ts` (new)
- `src/main/domain/persistence/schema/index.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/repositories/exports-index.repository.ts` (new)
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`

Likely test files to create/update:
- `src/main/test/markdown-bundle.service.test.ts` (new)
- `src/main/test/exports-index.repository.test.ts` (new)
- `src/main/test/register-handlers.exports.test.ts` (new)
- `src/renderer/test/explorer.test.tsx`

### Testing Requirements

- Domain tests:
  - markdown includes required context fields.
  - redacted default output even if inspector is currently revealed.
  - cap/truncation indicators included when applicable.
- Persistence tests:
  - export index writes/read ordering and field mapping.
- IPC tests:
  - input schema validation.
  - persistence/file-write failures mapped to envelope errors.
- Renderer tests:
  - export action enabled only when inspect result exists.
  - success and failure feedback visible and recoverable.

### Previous Story Intelligence

From Story 5.2 and earlier patterns:
- Keep main-process source of truth for IO and persistence.
- Extend existing `explorer.test.tsx` and main handler test style instead of introducing a new testing style.
- Preserve strict schema contracts and envelope-based errors.

### Git Intelligence Summary

Recent repository patterns:
- Feature delivery is coordinated across `ipc.contract.ts` + `register-handlers.ts` + `preload/api.ts` + renderer.
- Redaction and safe-copy logic are already implemented and heavily tested in inspector paths.
- Use the same implementation flow for export to avoid duplicate logic and regressions.

### Latest Tech Information

- Current stack is sufficiently current for Story 5.3 scope.
- Avoid version churn; focus on feature implementation and safety correctness.

### Project Context Reference

No `project-context.md` file was found in repository search (`**/project-context.md`).

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.3)
- `_bmad-output/planning-artifacts/prd.md` (FR42, FR49, NFR11, NFR13)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/5-2-recent-keys-and-investigation-history-session.md`
- `src/main/domain/cache/inspector/redis-inspector.service.ts`
- `src/main/domain/security/redaction.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/renderer/test/explorer.test.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow-driven story context creation completed for Story 5.3.
- Full context analysis completed across planning artifacts, previous stories, and codebase.
- Sprint status transition prepared for Story 5.3.

### Completion Notes List

- Implemented markdown bundle generation with safe-redacted preview defaults and capped-preview guidance.
- Added export artifact SQLite schema/repository + migration and stored only export metadata in DB.
- Added `exports:markdown:create` IPC + preload bridge + renderer action with recoverable success/failure messaging.
- Added domain, repository, IPC, and renderer tests; full validation passed (`npm run lint && npm run typecheck && npm test`).

### File List

- `src/main/domain/exports/markdown-bundle.service.ts`
- `src/main/domain/persistence/schema/exports-index.ts`
- `src/main/domain/persistence/schema/index.ts`
- `src/main/domain/persistence/db/migrations.ts`
- `src/main/domain/persistence/repositories/exports-index.repository.ts`
- `src/shared/ipc/ipc.contract.ts`
- `src/main/ipc/register-handlers.ts`
- `src/preload/api.ts`
- `src/renderer/features/explorer/RedisExplorerPanel.tsx`
- `src/main/test/markdown-bundle.service.test.ts`
- `src/main/test/exports-index.repository.test.ts`
- `src/main/test/register-handlers.exports.test.ts`
- `src/renderer/test/explorer.test.tsx`
- `src/main/test/register-handlers.persistence.test.ts`
- `src/main/test/register-handlers.mutations.test.ts`
- `src/main/test/register-handlers.secrets.test.ts`
- `src/main/test/register-handlers.saved-searches.test.ts`
- `src/main/test/register-handlers.recents.test.ts`
- `_bmad-output/implementation-artifacts/5-3-export-minimal-markdown-bundle-redacted-by-default.md`

## Change Log

- 2026-02-13: Created Story 5.3 with comprehensive implementation context and marked status ready-for-dev.
- 2026-02-13: Implemented Story 5.3 export flow end-to-end and moved status to review.
- 2026-02-13: Senior Developer Review (AI) completed; auto-fixed export action pending/error resilience in Explorer UI; status moved to done.

## Senior Developer Review (AI)

Date: 2026-02-13
Reviewer: Jay
Outcome: Approved with changes applied

- Fixed `MEDIUM`: markdown export action could remain in pending state if `exports:createMarkdown` invocation rejects in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
- Fixed `MEDIUM`: export failure handling now covers thrown runtime exceptions, not only envelope failures, in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
- Fixed `LOW`: improved fallback export failure message consistency in `src/renderer/features/explorer/RedisExplorerPanel.tsx`.
