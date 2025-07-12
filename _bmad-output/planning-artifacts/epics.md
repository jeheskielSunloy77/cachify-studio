---
stepsCompleted:
- step-01-validate-prerequisites
- step-02-design-epics
- step-03-create-stories
- step-04-final-validation
inputDocuments:
- _bmad-output/planning-artifacts/prd.md
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/ux-design-specification.md
- _bmad-output/planning-artifacts/ux-design-directions.html
---

# cachify-studio - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for cachify-studio, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

```text
FR1: Users can create, view, edit, and delete connection profiles.
FR2: Users can tag, favorite, and search connection profiles.
FR3: Users can connect to a Redis instance using a selected profile.
FR4: Users can connect to a Memcached instance using a selected profile.
FR5: Users can authenticate to Redis using password-based authentication.
FR6: Users can configure and use TLS for Redis connections (where supported by the target).
FR7: Users can choose whether to save credentials for a profile or prompt each time.
FR8: Saved credentials are stored in OS keychain/credential store, not in plaintext config.
FR9: Users can choose from common Redis auth patterns (password, ACL username+password) for a profile.
FR10: Users can optionally configure a custom CA certificate for TLS validation.
FR11: Users can view connection status and error details when a connection attempt fails.
FR12: The app provides an always-visible environment label/state for the active connection (e.g., local/staging/prod).
FR13: Production connections default to enforced read-only mode.
FR14: Users can explicitly unlock mutations for a connection via a deliberate flow.
FR15: The app clearly indicates when mutations are enabled for the active connection.
FR16: Users can browse Redis keys using prefix/tree navigation.
FR17: Users can search Redis keys by substring/pattern (within defined limits).
FR18: Users can view Redis key metadata including type and TTL (when available).
FR19: Users can inspect Redis string values.
FR20: Users can inspect Redis hash values (fields and values).
FR21: Users can inspect Redis list values (ordered elements).
FR22: Users can inspect Redis set values (members).
FR23: Users can inspect Redis sorted set values (members and scores).
FR24: Users can inspect Redis stream data (entries and fields).
FR25: Users can get a value by key from Memcached.
FR26: Users can set a value by key in Memcached when mutations are enabled.
FR27: Users can view Memcached server statistics.
FR28: Users can view basic metadata for a fetched Memcached value when available (e.g., size/flags if exposed).
FR29: Users can view values in a safe preview mode that redacts sensitive-looking content by default.
FR30: Users can explicitly reveal redacted content through a deliberate “safe reveal” interaction.
FR31: Users can switch between raw and formatted views for values where formatting is applicable.
FR32: Users can apply a decode pipeline to a value (e.g., raw text, JSON pretty) and see which decoding is active.
FR33: Users can copy a value representation to the clipboard in a redacted-safe form.
FR34: When unlocked mutations mode is enabled, users can mutate Redis data using supported operations for the inspected type.
FR35: When unlocked mutations mode is disabled, the app prevents mutation operations for that connection.
FR36: Users can perform basic key-level operations in Redis when mutations are enabled (e.g., set string, update hash field, push list element, add set member, add zset member, add stream entry).
FR37: Users can delete a key in Redis when mutations are enabled.
FR38: The app provides clear feedback after a mutation (success/failure and reason).
FR39: Users can save searches (query + optional scope like connection/prefix).
FR40: Users can recall and run saved searches.
FR41: Users can view and reopen recently inspected keys/values for the current session.
FR42: Users can export a minimal single-file Markdown bundle containing key metadata, decode context, and a redacted preview.
FR43: Users can copy a “pretty snippet” for sharing that includes safe context (env label, key, TTL, decode info) without exposing secrets by default.
FR44: Users can access core actions from a tray menu (open app, recent connections, current safety/mode indicator).
FR45: Users can use a global keyboard shortcut to bring the app forward and focus search.
FR46: The app stores user preferences locally.
FR47: The app stores connection profile metadata locally.
FR48: The app stores saved searches locally.
FR49: The app stores exported artifacts locally.
FR50: The app does not persist fetched cache values by default.
FR51: When online, the app can check for available updates and notify the user.
FR52: The user can initiate installing an update from the prompt (handoff to the platform-appropriate install flow).
```

### NonFunctional Requirements

```text
NFR1: App launch to usable UI is **≤ 2 seconds** on typical developer hardware.
NFR2: Connect to first data visible is **≤ 3 seconds** for local/dev targets and **≤ 8 seconds** for remote targets (typical networks).
NFR3: Key search returns first results in **≤ 500 ms** for typical keyspaces; for large scans, results stream progressively with a visible “search in progress” state.
NFR4: Opening/inspecting a typical value renders within **≤ 250 ms**; beyond safety limits the app degrades gracefully (partial preview + export options).
NFR5: The UI remains responsive during long operations via progressive loading and user-cancelable tasks.
NFR6: The app enforces safety limits to prevent UI lockups and memory exhaustion.
NFR7: Network failures (timeouts, disconnects) produce actionable errors and leave the app in a recoverable state without restart.
NFR8: Credentials are **never stored in plaintext** on disk.
NFR9: Saved secrets are stored only via the OS credential store/keychain; users can choose “prompt every time” for sensitive profiles.
NFR10: Remote connections use TLS when configured, and insecure configurations are surfaced clearly to the user.
NFR11: Value viewing is **redaction-by-default** with an intentional “safe reveal” interaction.
NFR12: The app is fully usable with **no internet connection** for all non-remote workflows (profiles, saved searches, preferences, viewing exports).
NFR13: All app state is stored locally; the app does **not** persist fetched cache values by default.
NFR14: Core workflows are usable by keyboard (navigation, search, open/close inspectors, copy/export).
NFR15: Interactive elements have clear focus states and meet reasonable contrast/readability defaults (basic good practice).
NFR16: Default value preview limit is **1 MB** decoded output (with a clear “too large to preview safely” state beyond this).
NFR17: Default structured render depth limit is **20 levels** (or equivalent) before collapsing/truncating with user-visible indicators.
NFR18: A user can always choose an “export raw/partial” path when limits are hit.
```

### Additional Requirements

- Use the selected starter stack: Electron Forge `vite-typescript` + TypeScript, with React in the renderer via Vite React plugin.
- Enforce process boundaries: renderer UI only, preload is the minimal typed bridge, main owns IO/network/secrets.
- Store connection secrets in OS credential store/keychain via Electron (`safeStorage`); on Linux, disable “save secret” when `safeStorage` backend is `basic_text`.
- Persist app state locally (profiles, preferences, saved searches, exports). Do not persist fetched cache values by default.
- Implement a job model for long operations (key scans, large fetch/decode): progressive results + cancellation + safety caps; keep UI responsive (no lockups).
- Production posture: default enforced read-only; explicit, clearly-visible, deliberate “unlock mutations” flow (time-boxed recommended by UX/architecture).
- Share/export as explicit artifacts (single-file Markdown bundle + “pretty snippet”) with provenance/context (env/key/TTL/decode) and redaction-by-default.
- Desktop integration: tray menu entry points + a global keyboard shortcut that focuses primary search.
- Accessibility and interaction standards: keyboard-first core flows, consistent `Esc` to close top-most layer, focus management, WCAG 2.1 AA target, and “reduce motion” support.
- Layout constraints: minimum supported width ~900px (collapse inspector into a drawer), full experience ≥1100px with optional multi-pane layout; density modes (Compact default, Comfort optional).
- Updates: manual update check + notify (GitHub Releases), with platform-appropriate install handoff; signing/notarization expected per platform.

### FR Coverage Map

### FR Coverage Map

FR1: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR2: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR3: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR4: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR5: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR6: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR7: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR8: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR9: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR10: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR11: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR12: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR13: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR14: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR15: Epic 1 - Get Connected Safely (Profiles + Trust + Read-Only by Default)
FR16: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR17: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR18: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR19: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR20: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR21: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR22: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR23: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR24: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR25: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR26: Epic 5 - Controlled Mutations (Unlock + Type-Aware Edits)
FR27: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR28: Epic 2 - Explore Redis & Memcached Data (Keys, Search, Inspect)
FR29: Epic 3 - Understand Values Safely (Redaction + Decode + Views)
FR30: Epic 3 - Understand Values Safely (Redaction + Decode + Views)
FR31: Epic 3 - Understand Values Safely (Redaction + Decode + Views)
FR32: Epic 3 - Understand Values Safely (Redaction + Decode + Views)
FR33: Epic 4 - Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)
FR34: Epic 5 - Controlled Mutations (Unlock + Type-Aware Edits)
FR35: Epic 5 - Controlled Mutations (Unlock + Type-Aware Edits)
FR36: Epic 5 - Controlled Mutations (Unlock + Type-Aware Edits)
FR37: Epic 5 - Controlled Mutations (Unlock + Type-Aware Edits)
FR38: Epic 5 - Controlled Mutations (Unlock + Type-Aware Edits)
FR39: Epic 4 - Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)
FR40: Epic 4 - Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)
FR41: Epic 4 - Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)
FR42: Epic 4 - Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)
FR43: Epic 4 - Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)
FR44: Epic 6 - Desktop Power & Updates (Tray + Global Shortcut + Update Awareness)
FR45: Epic 6 - Desktop Power & Updates (Tray + Global Shortcut + Update Awareness)
FR46: Epic 7 - Offline-First Local State (Preferences + Persistence Boundaries)
FR47: Epic 7 - Offline-First Local State (Preferences + Persistence Boundaries)
FR48: Epic 7 - Offline-First Local State (Preferences + Persistence Boundaries)
FR49: Epic 7 - Offline-First Local State (Preferences + Persistence Boundaries)
FR50: Epic 7 - Offline-First Local State (Preferences + Persistence Boundaries)
FR51: Epic 6 - Desktop Power & Updates (Tray + Global Shortcut + Update Awareness)
FR52: Epic 6 - Desktop Power & Updates (Tray + Global Shortcut + Update Awareness)


## Epic List

### Epic 1: Get Connected Safely (Profiles + Trust + Read-Only by Default)
Users can create secure connection profiles for Redis/Memcached, connect reliably, and always understand safety posture (env + read-only/unlock state) before doing anything else.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15

### Epic 2: Explore Redis & Memcached Data (Keys, Search, Inspect)
Users can quickly find keys and inspect cache data (type/TTL + all supported Redis types + Memcached get/stats) with fast, responsive browsing.
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR27, FR28

### Epic 3: Understand Values Safely (Redaction + Decode + Views)
Users can safely understand values via redaction-by-default, deliberate reveal, raw/formatted views, and decode pipelines—without UI lockups.
**FRs covered:** FR29, FR30, FR31, FR32

### Epic 4: Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)
Users can safely share what they found and quickly resume investigations via saved searches, recents, and exportable artifacts.
**FRs covered:** FR33, FR39, FR40, FR41, FR42, FR43

### Epic 5: Controlled Mutations (Unlock + Type-Aware Edits)
When explicitly unlocked, users can perform supported mutations with clear feedback; when locked, mutations are reliably prevented.
**FRs covered:** FR26, FR34, FR35, FR36, FR37, FR38

### Epic 6: Desktop Power & Updates (Tray + Global Shortcut + Update Awareness)
The app integrates with the desktop for speed (tray + global shortcut) and can check for updates and assist installation.
**FRs covered:** FR44, FR45, FR51, FR52

### Epic 7: Offline-First Local State (Preferences + Persistence Boundaries)
The app persists profiles/metadata/preferences/saved searches/exports locally while honoring the boundary of not persisting fetched values by default.
**FRs covered:** FR46, FR47, FR48, FR49, FR50

## Epic 1: Get Connected Safely (Profiles + Trust + Read-Only by Default)

Users can create secure connection profiles for Redis/Memcached, connect reliably, and always understand safety posture (env + read-only/unlock state) before doing anything else.

### Story 1.1: Project Bootstrap (Forge + Vite + React + Typed IPC)

As a developer,
I want a working Electron Forge app scaffolded with the chosen stack and a minimal typed IPC bridge,
So that I can begin implementing features with the correct security boundaries from day one.

**Acceptance Criteria:**

**Given** a new repo workspace
**When** I run the dev command
**Then** the app launches with a renderer window and no console errors
**And** renderer calls a sample IPC method via preload with typed request/response

**Given** the app is running
**When** I inspect the code structure
**Then** renderer/preload/main are separated and renderer cannot access Node APIs directly

### Story 1.2: Connection Profiles: CRUD + Local Persistence (metadata only)

As a cache user,
I want to create, edit, delete, tag, favorite, and search connection profiles,
So that I can manage many environments and quickly pick the right one.

**Acceptance Criteria:**

**Given** I am on the Profiles screen
**When** I create or edit a profile (name, host, port, type, tags, env label)
**Then** the profile is saved locally and appears in the list
**And** search and tag/favorite filters find it

**Given** a saved profile
**When** I delete it
**Then** it is removed from local storage and no longer selectable

### Story 1.3: Secrets Storage: Keychain-backed credentials with “prompt every time” option

As a cache user,
I want to choose whether to save credentials in the OS keychain or be prompted each time,
So that my secrets are safe and I control persistence.

**Acceptance Criteria:**

**Given** a profile with auth configured
**When** I choose “save credentials”
**Then** credentials are stored only via OS credential store and not written to app DB/files

**Given** a profile set to “prompt every time”
**When** I connect
**Then** I am prompted for credentials and they are not persisted after the session

### Story 1.4: Connect to Redis/Memcached with error reporting and connection status

As a cache user,
I want to connect to Redis or Memcached using a profile and see clear status and errors,
So that I can reliably reach the right cache and recover from failures.

**Acceptance Criteria:**

**Given** a valid Redis profile
**When** I connect
**Then** the app shows connected status and server identity basics (host/port) in the UI

**Given** an invalid or unreachable profile
**When** I attempt to connect
**Then** I see an actionable error message and remain in a recoverable state

### Story 1.5: Trust & Safety Chip: environment label + read-only default + unlock indicator

As a cache user,
I want to always see what environment I am connected to and whether I am in read-only or unlocked mode,
So that I avoid wrong-environment mistakes.

**Acceptance Criteria:**

**Given** I am connected to any profile
**When** I view the app chrome
**Then** an always-visible chip shows env label and safety mode

**Given** a profile marked as production
**When** I connect
**Then** mutations are disabled by default and the UI clearly indicates read-only

## Epic 2: Explore Redis & Memcached Data (Keys, Search, Inspect)

Users can quickly find keys and inspect cache data (type/TTL + all supported Redis types + Memcached get/stats) with fast, responsive browsing.

### Story 2.1: Redis Keyspace Explorer: prefix navigation + streaming search

As a cache user,
I want to browse keys via prefix/tree navigation and search by substring/pattern within safety limits,
So that I can find the right key quickly even in large keyspaces.

**Acceptance Criteria:**

**Given** I am connected to Redis
**When** I select a prefix and search
**Then** I see progressively loading results and can cancel the operation

**Given** a large keyspace
**When** search limits are hit
**Then** the UI explains the limit and offers safe next actions (narrow prefix, refine query)

### Story 2.2: Key Metadata Panel: type + TTL (where available)

As a cache user,
I want to view key metadata like type and TTL,
So that I can quickly judge what I’m looking at.

**Acceptance Criteria:**

**Given** I select a Redis key
**When** metadata loads
**Then** type and TTL are displayed (or clearly marked unavailable)

### Story 2.3: Inspect Redis Strings/Hashes/Lists/Sets/ZSets/Streams (read-only)

As a cache user,
I want to inspect each supported Redis data type safely,
So that I can debug data structures without using the CLI.

**Acceptance Criteria:**

**Given** a key of a supported type
**When** I open it
**Then** I see a stable inspector view with pagination/virtualization where needed

### Story 2.4: Memcached: get by key + stats (read-only)

As a cache user,
I want to fetch a value by key and view server stats from Memcached,
So that I can diagnose simple Memcached issues quickly.

**Acceptance Criteria:**

**Given** I am connected to Memcached
**When** I fetch a key
**Then** I see the value and any available metadata (size/flags if exposed)

**Given** I am connected to Memcached
**When** I open stats
**Then** I see a stats table and can refresh it

## Epic 3: Understand Values Safely (Redaction + Decode + Views)

Users can safely understand values via redaction-by-default, deliberate reveal, raw/formatted views, and decode pipelines—without UI lockups.

### Story 3.1: Redaction-by-default previews with deliberate “safe reveal”

As a cache user,
I want values to be redacted by default and only revealed deliberately,
So that I can inspect data without accidentally leaking secrets.

**Acceptance Criteria:**

**Given** a value containing sensitive-looking patterns
**When** I preview it
**Then** sensitive segments are redacted by default

**Given** a redacted value
**When** I choose “safe reveal”
**Then** the UI requires a deliberate action and then shows the content

### Story 3.2: Pretty ↔ Raw viewer modes for inspectable values

As a cache user,
I want to switch between formatted and raw representations,
So that I can understand data without losing fidelity.

**Acceptance Criteria:**

**Given** a JSON-ish value
**When** I toggle Pretty
**Then** it renders formatted with truncation/safety limits

**Given** any value
**When** I toggle Raw
**Then** I see the raw bytes/text representation within preview caps

### Story 3.3: Decode pipeline (JSON pretty and extensible pipeline model)

As a cache user,
I want to apply a decode pipeline and see which decoding is active,
So that opaque payloads become understandable quickly.

**Acceptance Criteria:**

**Given** a value
**When** I select a decode pipeline
**Then** the rendered view updates and the active pipeline is clearly indicated

## Epic 4: Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)

Users can safely share what they found and quickly resume investigations via saved searches, recents, and exportable artifacts.

### Story 4.1: Safe copy to clipboard (redacted-safe default)

As a cache user,
I want to copy a value representation to the clipboard safely,
So that I can share without leaking secrets by default.

**Acceptance Criteria:**

**Given** a value view
**When** I click Copy
**Then** the clipboard content is redacted-safe by default and includes minimal context

### Story 4.2: Export minimal Markdown bundle (single file) with context

As a cache user,
I want to export a single-file Markdown bundle with key metadata, decode context, and redacted preview,
So that I can attach evidence to tickets offline.

**Acceptance Criteria:**

**Given** an inspected key
**When** I export
**Then** a single Markdown file is created including env label, key, TTL, decode pipeline, and redacted preview

### Story 4.3: Saved searches and quick recall (with optional scoping)

As a cache user,
I want to save searches and recall them later,
So that I can reuse common workflows.

**Acceptance Criteria:**

**Given** a search query and optional scope
**When** I save it
**Then** it appears in Saved Searches and can be re-run

### Story 4.4: Recents: reopen recently inspected keys/values

As a cache user,
I want to view and reopen recently inspected keys/values for the session,
So that I can bounce between items while debugging.

**Acceptance Criteria:**

**Given** I inspected keys during this session
**When** I open Recents
**Then** I can reopen a prior key and the inspector restores context

## Epic 5: Controlled Mutations (Unlock + Type-Aware Edits)

When explicitly unlocked, users can perform supported mutations with clear feedback; when locked, mutations are reliably prevented.

### Story 5.1: Unlock mutations flow + locked-mode enforcement

As a cache user,
I want a deliberate unlock flow for enabling mutations and strict enforcement when locked,
So that I avoid accidental writes and understand risk clearly.

**Acceptance Criteria:**

**Given** mutations are locked
**When** I attempt a mutation action
**Then** the app blocks it and explains how to unlock

**Given** I run the unlock flow
**When** I confirm intent
**Then** mutations become enabled and the UI shows an always-visible unlocked indicator

### Story 5.2: Redis key-level mutations (type-aware) with feedback

As a cache user,
I want to perform supported mutation operations for the inspected Redis type,
So that I can fix issues directly when I intend to.

**Acceptance Criteria:**

**Given** mutations are unlocked
**When** I edit a string or update a hash field / push list element / add set member / add zset member / add stream entry
**Then** the operation succeeds or fails with a clear reason

### Story 5.3: Delete Redis key (guarded) with success/failure feedback

As a cache user,
I want to delete a key when mutations are enabled,
So that I can remove bad data intentionally.

**Acceptance Criteria:**

**Given** mutations are unlocked
**When** I delete a key and confirm
**Then** the key is removed and the UI updates the explorer list

### Story 5.4: Memcached set (only when unlocked)

As a cache user,
I want to set a Memcached value by key when mutations are enabled,
So that I can validate fixes or adjust cached values intentionally.

**Acceptance Criteria:**

**Given** I am connected to Memcached and mutations are unlocked
**When** I set a value by key
**Then** the operation completes with clear feedback

## Epic 6: Desktop Power & Updates (Tray + Global Shortcut + Update Awareness)

The app integrates with the desktop for speed (tray + global shortcut) and can check for updates and assist installation.

### Story 6.1: Tray menu: quick open + recent connections + safety indicator

As a cache user,
I want to access core actions from a tray menu with a visible mode indicator,
So that I can jump into debugging quickly.

**Acceptance Criteria:**

**Given** the app is running
**When** I open the tray menu
**Then** I can open the app and see recent connections and the current safety mode

### Story 6.2: Global shortcut focuses primary search

As a cache user,
I want a global keyboard shortcut that brings the app forward and focuses search,
So that I can start an investigation instantly.

**Acceptance Criteria:**

**Given** the app is running in the background
**When** I press the configured shortcut
**Then** the app is focused and the search input is ready

### Story 6.3: Update awareness: check online + prompt to install

As a cache user,
I want to be notified when an update is available and initiate installation,
So that I can keep the app current.

**Acceptance Criteria:**

**Given** the app is online
**When** I check for updates
**Then** I see whether a newer version exists and can start the install handoff

## Epic 7: Offline-First Local State (Preferences + Persistence Boundaries)

The app persists profiles/metadata/preferences/saved searches/exports locally while honoring the boundary of not persisting fetched values by default.

### Story 7.1: Preferences persistence (local, offline-first)

As a cache user,
I want my preferences stored locally,
So that the app behaves consistently across sessions offline.

**Acceptance Criteria:**

**Given** I change a preference (theme/density/limits)
**When** I restart the app
**Then** the preference is preserved locally

### Story 7.2: Saved searches persistence (local)

As a cache user,
I want saved searches persisted locally,
So that I can reuse them across sessions.

**Acceptance Criteria:**

**Given** I saved a search
**When** I restart the app
**Then** the saved search remains available

### Story 7.3: Export artifacts index + local storage

As a cache user,
I want exports stored and indexed locally,
So that I can find past evidence bundles.

**Acceptance Criteria:**

**Given** I exported a Markdown bundle
**When** I open Exports
**Then** I see the artifact listed and can open the file

### Story 7.4: No fetched cache values persisted by default (enforced)

As a security-minded user,
I want the app to avoid persisting fetched cache values by default,
So that sensitive data doesn’t end up on disk accidentally.

**Acceptance Criteria:**

**Given** I inspect values during a session
**When** I inspect app storage locations
**Then** no raw fetched values are stored unless I explicitly export
