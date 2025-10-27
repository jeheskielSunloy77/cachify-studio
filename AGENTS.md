# Repository Guidelines

## Project Structure & Module Organization

This project is an Electron desktop app built with Vite, React, and TypeScript.

- `src/main`: Electron main-process lifecycle, IPC registration, and persistence/domain logic.
- `src/preload`: secure preload bridge (`window.api`) exposed to the renderer.
- `src/renderer`: React UI (`app/`, `features/`, `components/ui/`, `lib/`, and tests).
- `src/shared`: cross-process contracts and schemas (IPC + profile types/validation).
- `out/`: packaged artifacts; `_bmad/` and `_bmad-output/`: planning/workflow artifacts.

Keep process boundaries explicit: renderer code must use preload APIs instead of Node/Electron internals.

## Build, Test, and Development Commands

- `npm run start`: run Electron app locally with Vite.
- `npm run package`: create unpacked app output.
- `npm run make`: build distributables (zip/deb/rpm/squirrel based on Forge config).
- `npm run lint`: run ESLint on `.ts`/`.tsx` files.
- `npm run typecheck`: run both app and node TypeScript checks.
- `npm test`: run Vitest test suites once.

Use `npm run lint && npm run typecheck && npm test` before opening a PR.

## Coding Style & Naming Conventions

- Language: TypeScript (`.ts`/`.tsx`), React function components.
- Indentation: 2 spaces; prefer trailing commas where the formatter/linter expects them.
- Imports: use `@/` alias for `src` paths when practical.
- Naming: `PascalCase` for components (`ProfilesPage.tsx`), `kebab-case` for domain modules (`connection-profiles.repository.ts`).
- Validation and IPC contracts belong in `src/shared` to avoid duplication.
- UI components: Prefer shadcn/ui components (Input, Label, Select, Checkbox, etc.). If a component is missing, install it with `npx shadcn@latest add <component>`, then use it in the UI. use the shadcn/ui MCP to browse for components if needed.

## Testing Guidelines

- Framework: Vitest (`jsdom`), with Testing Library for renderer tests.
- Test locations:
  - Renderer: `src/renderer/test/**/*.test.ts(x)`
  - Main/domain: `src/main/test/**/*.test.ts`
- Keep tests behavior-focused and colocated by process boundary.
- Add or update tests for every behavior change (IPC handlers, repositories, UI interactions).

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), often with scopes (for example `feat(electron): ...`).

- Write commit titles in imperative mood, under ~72 characters.
- Keep one logical change per commit.
- PRs should include: concise summary, linked issue/story, test evidence (command output), and screenshots/GIFs for renderer UI changes.
- Call out IPC contract or schema changes explicitly to help reviewers assess cross-process impact.
