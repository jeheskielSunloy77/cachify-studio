---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-01b-continue
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-02-04.md
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 1
  projectDocsCount: 0
workflowType: prd
project_name: cachify-studio2
user_name: Jay
date: 2026-02-04T22:22:36+07:00
classification:
  projectType: desktop_app
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - cachify-studio2

**Author:** Jay  
**Date:** 2026-02-04T22:22:36+07:00

## Executive Summary

**Product:** cachify-studio2 — a cross-platform (macOS/Windows/Linux) desktop cache client for Redis and Memcached.

**Target users:** Software engineers who debug local and remote caches frequently and need a safe, modern UI that works without relying on an external backend.

**Primary value:** Find the right connection and key quickly (search + prefix workflows) and inspect values safely (type/size/TTL, redaction-by-default, decode pipeline) without UI lockups.

**Safety posture:** Production connections default to enforced read-only; users can explicitly unlock mutations with clear always-visible environment cues to prevent wrong-env mistakes.

**Offline-first:** App state is stored locally; no fetched cache values are persisted by default (exports are explicit).

## Success Criteria

### User Success

- **Primary “aha” moment:** An app developer finds the right key and inspects a correctly decoded value in **under 60 seconds** from opening the app.
- **Top v1 jobs (ranked):**
  1. Connect (local/remote) with secure auth options
  2. Find keys fast (search + prefix workflows)
  3. Inspect values safely (type/size/TTL + decode pipeline + redaction-by-default)

### Business Success

- **Portfolio product:** A polished, credible “daily driver” cache client that demonstrates strong product craft (UX + safety + performance) with a clear differentiation story.
- **3-month success:** Public v1 shipped with a solid README, screenshots, and a short demo video; stable enough for regular use on dev caches.
- **12-month success:** Sustained release cadence, a small but real user base, and strong word-of-mouth as a premium-feeling cache explorer with guardrails.

### Technical Success

- **Security:**
  - Secrets stored in the OS keychain (no plaintext creds on disk).
  - User can optionally save auth (including password) by choice; offer “prompt every time” as an alternative.
  - Redaction-by-default for sensitive data with a “safe reveal” UX.
- **Guardrails:**
  - Production connections default to enforced read-only mode.
  - Explicit “unlock mutations” flow plus dangerous-command firewall (flush/bulk delete/config-risk actions).
- **Offline-first:** No required backend; app state stored locally; sharing via export/import artifacts.
- **Reliability:** Avoid UI lockups on large payloads via safety limits (size/depth/time) plus an escape hatch (export raw / partial view).

### Measurable Outcomes

- **Time-to-value:** 80% of sessions reach a successfully decoded value view in **≤ 60 seconds**.
- **Performance targets (initial):**
  - App launch → usable UI: **≤ 2 seconds**
  - Connect → first data visible: **≤ 3 seconds** (local/dev), **≤ 8 seconds** (remote)
  - Search → first results: **≤ 500 ms** (typical keyspaces), with progressive results for large scans
  - Open/inspect value: **≤ 250 ms** for typical payloads; graceful degradation beyond caps

## Product Scope

### MVP - Minimum Viable Product

- Connection profiles for Redis + Memcached with keychain-backed secrets and secure auth options (with user-controlled save/prompt).
- Explorer with search/prefix navigation, key metadata (type/size/TTL), safe previews, and decode pipelines.
- Prod-safe posture: enforced read-only by default + explicit unlock (dangerous command firewall deferred to post-MVP).
- Export/share: redacted “pretty snippet” and minimal single-file Markdown bundle.

### Growth Features (Post-MVP)

- TTL heatmap dashboard and higher-level summaries.
- Snapshots + diff timeline for key/value changes.
- Playbooks surface (guided actions) with policy rules.
- Stronger parity/abstractions across Redis vs Memcached common operations.

### Vision (Future)

- “Prod-safe by design” workflows (audit trail, policies, approvals).
- Permissioned, isolated plugin system.
- Team sharing model via export/import bundles (no required backend).

## User Journeys

### Journey 1 — “Fast Debug, No Sweat” (Primary happy path)

**Persona:** Sam, a software engineer shipping features daily.

**Opening scene:** A bug report lands: “Users sometimes see stale data.” Sam suspects cache, but there are hundreds of local + remote caches and Sam doesn’t want to remember connection details or CLI flags.

**Rising action:**

- Sam opens Cachify and uses a Spotlight-style search to find the right connection profile in seconds.
- The app shows an always-visible trust chip (env + identity + security state) so Sam immediately knows “this is staging, read-only.”
- Sam searches by key/prefix, gets fast results, and opens a key to see type / size / TTL at a glance.
- The value is safely previewed with redaction-by-default and a clear decode pipeline (e.g., gzip → JSON → pretty).

**Climax:** Sam finds the exact key, confirms TTL/shape, and spots the root cause (wrong serialization / unexpected structure) without exposing secrets or freezing the UI on a large payload.

**Resolution:** Sam fixes the bug, exports a redacted pretty snippet (with context like env/key/TTL/decode pipeline) into the ticket, and moves on.

**Failure/Recovery beats:**

- Auth fails → guided fix (wrong password/ACL) without leaking secrets; retry is quick.
- Value too large / deeply nested → safety caps kick in; Sam can export raw or partial view instead of UI hanging.

### Journey 2 — “Wrong Env Near‑Miss” (Primary edge case)

**Persona:** Riley, a software engineer under time pressure.

**Opening scene:** An incident is brewing. Riley needs to check “prod cache” quickly—exactly when mistakes happen.

**Rising action:**

- Riley selects what they think is staging, but the app’s environment color + trust chip screams “PROD”.
- The app defaults to enforced read-only for prod connections (browse/inspect is fine).
- Riley tries to run a risky action (delete/flush/bulk change) out of habit.

**Climax:** Cachify blocks it with a dangerous-command firewall and requires an explicit “unlock mutations” flow that is hard to do accidentally (clear warnings, re-auth if needed, time-boxed unlock).

**Resolution:** Riley gets the needed information safely (TTL/value shape), avoids a production foot-gun, and shares a redacted artifact with the team.

**Failure/Recovery beats:**

- Riley insists it’s not prod → app provides connection proof (host, TLS state, profile name, last used) so Riley can correct the profile labeling.
- Riley must mutate → explicit break-glass flow makes intent obvious and reversible (auto re-lock).

### Journey 3 — “Secure Connection Confidence” (Security-minded single user)

**Persona:** Jordan, a software engineer who’s been burned by credential mishandling.

**Opening scene:** Jordan wants a cache client they can trust for local + remote work without scattering secrets across config files.

**Rising action:**

- Jordan creates connection profiles with secrets stored in the OS keychain, choosing “prompt every time” for sensitive targets.
- Jordan validates remote connections via a TLS posture view (cert chain, hostname verification, warnings for weak configs).
- Jordan sets default redaction rules (tokens/JWT/API keys) and uses “press-and-hold reveal” when absolutely needed.

**Climax:** Jordan can confidently inspect real production-like payloads without leaking secrets in screenshots or chat.

**Resolution:** The tool becomes a daily driver because it’s safe by default.

**Failure/Recovery beats:**

- Misconfigured TLS → clear error + recommended secure settings (not silent fallback).
- Accidental clipboard copy risk → app copies redacted by default and previews what will be shared.

### Journey 4 — “Incident Investigation + Shareable Artifact” (Troubleshooting / self-support)

**Persona:** Alex, a software engineer on-call this week.

**Opening scene:** “Cache stampede?” “Why is this key flapping?” Alex needs fast evidence, not vibes.

**Rising action:**

- Alex uses saved searches/prefix workflows to quickly navigate the keyspace.
- Alex compares values over time via snapshot/diff (even minimal v1: compare “now” vs “refetch” with decoded diff).
- Alex generates a minimal single-file Markdown bundle with metadata + redacted preview + reproduction notes.

**Climax:** Alex can hand the artifact to teammates without requiring them to install Cachify or get credentials.

**Resolution:** Faster team alignment; fewer “can you screenshare?” loops.

**Failure/Recovery beats:**

- Network flakiness → retries/backoff and clear partial results.
- Huge keyspaces → progressive results + “stop scan” controls.

### Journey Requirements Summary

From these journeys, v1 must support:

- Connection profiles at scale (hundreds), fast switching, and clear labeling.
- Environment clarity: trust chip + distinct env cues (prod is unmistakable).
- Prod-safe defaults: enforced read-only by default + explicit unlock + dangerous-command firewall.
- Search-first explorer: key/prefix search, fast results, keyboard-friendly.
- Safe inspection: type/size/TTL visible, redaction-by-default, safe reveal, decode pipeline.
- Reliability guardrails: safety caps for large values/keyspaces, progressive loading, no UI lockups.
- Sharing: copy redacted pretty snippet + export minimal Markdown bundle with context.

## Desktop App Specific Requirements

### Project-Type Overview

- **App type:** Cross-platform desktop app for software engineers to inspect and debug Redis/Memcached caches.
- **Platforms (v1 must-have):** macOS, Windows, Linux.
- **Connectivity model:** No required backend; app runs fully locally. Internet is only needed when the user connects to remote caches.

### Platform Support

- **macOS:** Support Apple silicon + Intel where feasible; follow platform security expectations (keychain, notarization for distribution).
- **Windows:** Support modern Windows versions; use OS credential storage where available.
- **Linux:** Provide a supported distribution format (e.g., AppImage or Flatpak) with clear install/uninstall guidance.

### Update Strategy

- **Update source:** GitHub Releases.
- **Behavior:** When online, automatically check for updates and **prompt** the user to install (no forced silent installs).
- **Offline behavior:** No update checks; app remains fully functional without internet.
- **Trust & safety:** Signed releases strongly recommended (platform-appropriate signing/notarization) to prevent tampered updates.

### System Integration

- **Tray menu (v1):** Yes — quick access + recent connections; show clear mode state (e.g., read-only/prod cues).
- **Global shortcut (v1):** Yes — bring app to front and focus search (Spotlight-style).
- **Deep links:** No.
- **File association for export bundles:** No (users can still import via in-app file picker/drag-drop if supported).

### Offline Capabilities & Local Storage

- **Offline-first guarantee:** App works with **no internet connection** for all local workflows (managing profiles, reviewing saved searches, viewing exports).
- **Local persistence scope (S1):**
  - Persist locally: connection profile metadata, preferences, saved searches, UI state, and exported artifacts.
  - Do **not** persist fetched cache values by default (to reduce sensitive-data risk).
- **Export/import:** Support generating local artifacts (e.g., redacted Markdown bundle) and importing them later, fully offline.

### Implementation Considerations

- Avoid UI lockups: progressive loading + safety caps for large keyspaces/values.
- Keyboard-first usability: consistent shortcuts across platforms where possible.
- Accessibility: baseline accessibility support (focus states, screen reader semantics where applicable, contrast-safe defaults).

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** **Experience MVP** — a premium, accessible, “no sweat” UX with strong safety defaults (wrong-env avoidance) even if we defer advanced power features.

**Resource Requirements (lean):** 1 strong full-stack/Electron engineer + 1 design-minded contributor (can be same person), with time allocated for packaging/signing and performance profiling.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

- Fast debug / inspect flow across many connections (local + remote)
- Wrong-env / prod fear near-miss prevention (read-only-by-default + clear env cues)
- Secure connection confidence (keychain-backed secrets, TLS where applicable)

**Must-Have Capabilities:**

- **Connections**
  - Connection profiles at scale (hundreds), fast switching/search
  - Redis + Memcached support (v1)
  - Auth (v1): password + TLS (where supported)
  - Secrets stored in OS keychain; option to prompt each time
- **Explorer**
  - Prefix/tree browser **plus** search (baseline)
  - Key metadata: type/size/TTL (as available per backend)
  - Safe inspection: redaction-by-default + safe reveal
  - Decode pipeline (at least: raw text + JSON pretty; extensible later)
- **Safety (non-negotiable)**
  - Environment labeling/color system (prod unmistakable)
  - Prod connections default to **enforced read-only**
  - Explicit “unlock mutations” mode (time-boxed re-lock recommended)
  - (Deferred) Dangerous command firewall — **Phase 2**
- **Desktop UX**
  - Tray menu (recent connections + current mode)
  - Global shortcut to focus search
  - Accessibility baseline (keyboard nav, focus, contrast)
- **Offline-first**
  - No backend required; all app state stored locally
  - Do not persist fetched values by default; exports only

### Post-MVP Features

**Phase 2 (Post-MVP):**

- Dangerous command firewall (flush/bulk delete/config-risk actions) + policy rules by environment
- Stronger decode pipelines (gzip/base64/msgpack/etc.) and saved pipelines
- Value diffing / snapshots (explicit save) and timeline
- More advanced search (search inside decoded JSON with safety caps)
- Improved export/import flows (bundle formats, templates)

**Phase 3 (Expansion):**

- TTL heatmap dashboard + stampede indicators
- Playbooks surface (guided actions) with guardrails
- Audit trail artifacts (local) and more enterprise-ready features (optional)

### Risk Mitigation Strategy

**Technical Risks:**

- Redis+Memcached parity can balloon scope → mitigate by defining a **common minimal capability set** and backend-specific “extras” later.
- Tree/prefix + search on huge keyspaces can hang UI → mitigate with progressive loading, cancellation, caps, and clear “scan” semantics.
- Cross-platform packaging/signing/updates is non-trivial → mitigate by choosing one Linux distribution format and integrating signing early.

**Market Risks:**

- “Simple + modern UI” is subjective → mitigate via 3–5 target users early and measure time-to-value (≤60s) with real caches.

**Resource Risks:**

- If time is tight, ship Redis-first then Memcached as Phase 1.5 (but keep UI consistent), without compromising safety/UX.

## Functional Requirements

### Connection Profiles & Session Management

- FR1: Users can create, view, edit, and delete connection profiles.
- FR2: Users can tag, favorite, and search connection profiles.
- FR3: Users can connect to a Redis instance using a selected profile.
- FR4: Users can connect to a Memcached instance using a selected profile.
- FR5: Users can authenticate to Redis using password-based authentication.
- FR6: Users can configure and use TLS for Redis connections (where supported by the target).
- FR7: Users can choose whether to save credentials for a profile or be prompted each session.
- FR8: Users can disconnect and switch between connections without restarting the app.
- FR9: Users can view connection status and last connection error for the active connection.

### Environment Identification & Safety Modes

- FR10: Users can assign an environment label (e.g., local/staging/prod) to each connection profile.
- FR11: Users can see the active connection’s environment clearly at all times.
- FR12: The app enforces read-only mode by default for profiles labeled as production.
- FR13: Users can explicitly enter an “unlocked mutations” mode for a connection.
- FR14: Users can exit unlocked mutations mode and return to read-only mode.
- FR15: The app clearly indicates when mutations are enabled for the active connection.

### Redis Data Exploration (All Types)

- FR16: Users can browse Redis keys using prefix/tree navigation.
- FR17: Users can search Redis keys by substring/pattern (within defined limits).
- FR18: Users can view Redis key metadata including type and TTL (when available).
- FR19: Users can inspect Redis string values.
- FR20: Users can inspect Redis hash values (fields and values).
- FR21: Users can inspect Redis list values (ordered elements).
- FR22: Users can inspect Redis set values (members).
- FR23: Users can inspect Redis sorted set values (members and scores).
- FR24: Users can inspect Redis stream data (entries and fields).

### Memcached Capabilities (v1 scope)

- FR25: Users can get a value by key from Memcached.
- FR26: Users can set a value by key in Memcached when mutations are enabled.
- FR27: Users can view Memcached server statistics.
- FR28: Users can view basic metadata for a fetched Memcached value when available (e.g., size/flags if exposed).

### Value Presentation, Redaction, and Decoding

- FR29: Users can view values in a safe preview mode that redacts sensitive-looking content by default.
- FR30: Users can explicitly reveal redacted content through a deliberate “safe reveal” interaction.
- FR31: Users can switch between raw and formatted views for values where formatting is applicable.
- FR32: Users can apply a decode pipeline to a value (e.g., raw text, JSON pretty) and see which decoding is active.
- FR33: Users can copy a value representation to the clipboard in a redacted-safe form.

### Mutations (Allowed, Controlled)

- FR34: When unlocked mutations mode is enabled, users can mutate Redis data using supported operations for the inspected type.
- FR35: When unlocked mutations mode is disabled, the app prevents mutation operations for that connection.
- FR36: Users can perform basic key-level operations in Redis when mutations are enabled (e.g., set string, update hash field, push list element, add set member, add zset member, add stream entry).
- FR37: Users can delete a key in Redis when mutations are enabled.
- FR38: The app provides clear feedback after a mutation (success/failure and reason).

### Search Workflow, Saved Searches, and History

- FR39: Users can save searches (query + optional scope like connection/prefix).
- FR40: Users can recall and run saved searches.
- FR41: Users can view and reopen recently inspected keys/values for the current session.

### Sharing & Export (Offline-friendly)

- FR42: Users can export a minimal single-file Markdown bundle containing key metadata, decode context, and a redacted preview.
- FR43: Users can copy a “pretty snippet” for sharing that includes safe context (env label, key, TTL, decode info) without exposing secrets by default.

### Desktop Integration

- FR44: Users can access core actions from a tray menu (open app, recent connections, current safety/mode indicator).
- FR45: Users can use a global keyboard shortcut to bring the app forward and focus search.

### Local Persistence (Offline-first, app-state only)

- FR46: The app stores user preferences locally.
- FR47: The app stores connection profile metadata locally.
- FR48: The app stores saved searches locally.
- FR49: The app stores exported artifacts locally.
- FR50: The app does not persist fetched cache values by default.

### Update Awareness

- FR51: When online, the app can check for available updates and notify the user.
- FR52: The user can initiate installing an update from the prompt (handoff to the platform-appropriate install flow).

## Non-Functional Requirements

### Performance

- NFR1: App launch to usable UI is **≤ 2 seconds** on typical developer hardware.
- NFR2: Connect to first data visible is **≤ 3 seconds** for local/dev targets and **≤ 8 seconds** for remote targets (typical networks).
- NFR3: Key search returns first results in **≤ 500 ms** for typical keyspaces; for large scans, results stream progressively with a visible “search in progress” state.
- NFR4: Opening/inspecting a typical value renders within **≤ 250 ms**; beyond safety limits the app degrades gracefully (partial preview + export options).

### Reliability & Resilience

- NFR5: The UI remains responsive during long operations via progressive loading and user-cancelable tasks.
- NFR6: The app enforces safety limits to prevent UI lockups and memory exhaustion.
- NFR7: Network failures (timeouts, disconnects) produce actionable errors and leave the app in a recoverable state without restart.

### Security & Privacy

- NFR8: Credentials are **never stored in plaintext** on disk.
- NFR9: Saved secrets are stored only via the OS credential store/keychain; users can choose “prompt every time” for sensitive profiles.
- NFR10: Remote connections use TLS when configured, and insecure configurations are surfaced clearly to the user.
- NFR11: Value viewing is **redaction-by-default** with an intentional “safe reveal” interaction.

### Offline & Local Data

- NFR12: The app is fully usable with **no internet connection** for all non-remote workflows (profiles, saved searches, preferences, viewing exports).
- NFR13: All app state is stored locally; the app does **not** persist fetched cache values by default.

### Accessibility & Usability Quality

- NFR14: Core workflows are usable by keyboard (navigation, search, open/close inspectors, copy/export).
- NFR15: Interactive elements have clear focus states and meet reasonable contrast/readability defaults (basic good practice).

### Safety Limits

- NFR16: Default value preview limit is **1 MB** decoded output (with a clear “too large to preview safely” state beyond this).
- NFR17: Default structured render depth limit is **20 levels** (or equivalent) before collapsing/truncating with user-visible indicators.
- NFR18: A user can always choose an “export raw/partial” path when limits are hit.
