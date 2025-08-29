# Cachify Studio — Route Map (UI Contract)

This document is the **implementation contract** for Cachify Studio’s UI surfaces.
It exists to prevent accidental “screen merging” during implementation by keeping a clear separation between:

- **Primary surfaces (pages/routes)**: top-level navigation destinations
- **Secondary surfaces (drawers/panels/modals)**: contextual overlays that should not replace primary pages

## Source of truth (from planning artifacts)

- Information architecture: `_bmad-output/planning-artifacts/ux-design-specification.md` (“Navigation Patterns” → “Information architecture”)
- Renderer feature/page structure: `_bmad-output/planning-artifacts/architecture.md` (renderer tree listing `DashboardPage.tsx`, `ExplorerPage.tsx`, `PlaybooksPage.tsx`)

## Primary surfaces (must be separate pages)

These are the only **top-level pages** required by the IA:

1. **Dashboard** — state-oriented overview (e.g., TTL heatmap hero)
2. **Explorer** — key discovery + filtering
3. **Playbooks** — guided actions / recipes (safe-by-default)

Non-negotiable rules:

- Each primary surface must have its **own route** and **own page component**.
- Do **not** collapse these into a single “Home” screen with conditionally-rendered sections.

## Secondary surfaces (must be overlays, not pages)

These appear as drawers/panels/modals layered on top of the primary pages:

- **Inspector drawer** (Explorer → select key → Inspector opens without navigation jumps)
- **Connection switcher / connection management**
- **Connection details & diagnostics** (TLS posture, last error, proofs)
- **Trust / policy** surfaces (environment label, read-only vs unlocked state, break-glass flow)
- **Export / share sheet** (Markdown bundle, safe snippet copy)

Implementation intent:

- Primary page context should remain stable while the user opens/closes these overlays.
- `Esc` closes the top-most layer (menu → popover → drawer → dialog).

## Suggested route inventory (implementation-friendly)

This is a practical list to keep the app coherent while still honoring the IA:

- Pages/routes:
  - `Dashboard`
  - `Explorer`
  - `Playbooks`
- Overlays (not routes):
  - `InspectorDrawer`
  - `ConnectionSwitcher`
  - `ConnectionDiagnosticsDrawer`
  - `TrustPolicyDrawer`
  - `ExportBundleSheet`

## Guardrail automation

See `docs/route-contract.json` and `scripts/verify-route-contract.mjs`.
Wire the script into CI once the Electron app scaffold exists.

