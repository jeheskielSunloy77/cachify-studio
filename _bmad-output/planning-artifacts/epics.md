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

FR1: Users can create, view, edit, and delete connection profiles.
FR2: Users can tag, favorite, and search connection profiles.
FR3: Users can connect to a Redis instance using a selected profile.
FR4: Users can connect to a Memcached instance using a selected profile.
FR5: Users can authenticate to Redis using password-based authentication.
FR6: Users can configure and use TLS for Redis connections (where supported by the target).
FR7: Users can choose whether to save credentials for a profile or be prompted each session.
FR8: Users can disconnect and switch between connections without restarting the app.
FR9: Users can view connection status and last connection error for the active connection.
FR10: Users can assign an environment label (e.g., local/staging/prod) to each connection profile.
FR11: Users can see the active connection’s environment clearly at all times.
FR12: The app enforces read-only mode by default for profiles labeled as production.
FR13: Users can explicitly enter an “unlocked mutations” mode for a connection.
FR14: Users can exit unlocked mutations mode and return to read-only mode.
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

### NonFunctional Requirements

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

### Additional Requirements

- Starter template requirement: initialize using create-electron-app@latest with vite-typescript; project initialization should be the first implementation story.
- Architecture boundary requirement: renderer is UI-only, preload is minimal typed bridge, main process owns all IO/network/secrets/persistence.
- Persistence requirement: hybrid local persistence with electron-store for prefs and SQLite for structured metadata.
- Secrets requirement: credentials must be stored only via Electron safeStorage; never in SQLite or electron-store.
- Linux keyring guard requirement: if safeStorage backend is basic_text, disable saved credentials and force prompt-per-session.
- Redis auth requirement: support password and ACL (username/password).
- Memcached auth requirement: support no-auth and optional SASL auth.
- Redis TLS requirement: per-profile TLS toggle with custom CA bundles; no silent insecure fallback.
- Deferred scope requirement: Redis mTLS and SSH tunneling are deferred unless explicitly required.
- IPC contract requirement: use a single typed contract module with Zod validation and strict structured-clone-safe payloads.
- IPC response requirement: all handlers return envelope format: success object with ok true and data, or failure object with ok false and error code/message/details.
- Long-running operations requirement: implement cancelable job model with start returning a jobId, plus progress and completion events.
- Performance isolation requirement: CPU-heavy decode/redaction/diff tasks run in worker_threads.
- Naming consistency requirement: SQLite uses snake_case; IPC/UI payloads use camelCase with explicit mapping in main persistence layer.
- Distribution requirement: release via GitHub Releases with update checks and user-driven install prompts.
- Packaging requirement: build/package targets for Windows (Squirrel), macOS (DMG/ZIP), Linux (DEB/RPM/ZIP).
- CI requirement: matrix builds on Windows/macOS/Linux producing release artifacts and checksums.
- UX requirement: keyboard-first interaction model with predictable focus management and visible shortcut affordances.
- UX requirement: trust/safety state remains always visible (environment + read-only/unlocked posture cues).
- UX requirement: redaction-by-default value handling with deliberate safe reveal and default redacted copy behavior.
- UX requirement: progressive loading/streaming with explicit cancel controls for long operations.
- UX requirement: all error states provide short diagnosis plus safe next actions.
- UX requirement: responsive desktop behavior with minimum width 900px and inspector collapse into drawer below 1100px.
- Accessibility requirement: target WCAG 2.1 AA, full keyboard support, ARIA for custom widgets, and no color-only safety signaling.
- Motion requirement: respect reduced-motion preferences and keep animations subtle/functional.

### FR Coverage Map

FR1: Epic 1 - Connect Safely and Establish Trust
FR2: Epic 1 - Connect Safely and Establish Trust
FR3: Epic 1 - Connect Safely and Establish Trust
FR4: Epic 1 - Connect Safely and Establish Trust
FR5: Epic 1 - Connect Safely and Establish Trust
FR6: Epic 1 - Connect Safely and Establish Trust
FR7: Epic 1 - Connect Safely and Establish Trust
FR8: Epic 1 - Connect Safely and Establish Trust
FR9: Epic 1 - Connect Safely and Establish Trust
FR10: Epic 1 - Connect Safely and Establish Trust
FR11: Epic 1 - Connect Safely and Establish Trust
FR12: Epic 1 - Connect Safely and Establish Trust
FR13: Epic 1 - Connect Safely and Establish Trust
FR14: Epic 1 - Connect Safely and Establish Trust
FR15: Epic 1 - Connect Safely and Establish Trust
FR16: Epic 2 - Explore Redis and Memcached Data
FR17: Epic 2 - Explore Redis and Memcached Data
FR18: Epic 2 - Explore Redis and Memcached Data
FR19: Epic 2 - Explore Redis and Memcached Data
FR20: Epic 2 - Explore Redis and Memcached Data
FR21: Epic 2 - Explore Redis and Memcached Data
FR22: Epic 2 - Explore Redis and Memcached Data
FR23: Epic 2 - Explore Redis and Memcached Data
FR24: Epic 2 - Explore Redis and Memcached Data
FR25: Epic 2 - Explore Redis and Memcached Data
FR26: Epic 4 - Perform Controlled Mutations
FR27: Epic 2 - Explore Redis and Memcached Data
FR28: Epic 2 - Explore Redis and Memcached Data
FR29: Epic 3 - Interpret Values Safely
FR30: Epic 3 - Interpret Values Safely
FR31: Epic 3 - Interpret Values Safely
FR32: Epic 3 - Interpret Values Safely
FR33: Epic 3 - Interpret Values Safely
FR34: Epic 4 - Perform Controlled Mutations
FR35: Epic 4 - Perform Controlled Mutations
FR36: Epic 4 - Perform Controlled Mutations
FR37: Epic 4 - Perform Controlled Mutations
FR38: Epic 4 - Perform Controlled Mutations
FR39: Epic 5 - Reuse Investigation Workflows and Share Findings
FR40: Epic 5 - Reuse Investigation Workflows and Share Findings
FR41: Epic 5 - Reuse Investigation Workflows and Share Findings
FR42: Epic 5 - Reuse Investigation Workflows and Share Findings
FR43: Epic 5 - Reuse Investigation Workflows and Share Findings
FR44: Epic 6 - Work Faster with Desktop and Offline-First Productivity
FR45: Epic 6 - Work Faster with Desktop and Offline-First Productivity
FR46: Epic 6 - Work Faster with Desktop and Offline-First Productivity
FR47: Epic 1 - Connect Safely and Establish Trust
FR48: Epic 5 - Reuse Investigation Workflows and Share Findings
FR49: Epic 5 - Reuse Investigation Workflows and Share Findings
FR50: Epic 6 - Work Faster with Desktop and Offline-First Productivity
FR51: Epic 7 - Stay Current with Updates
FR52: Epic 7 - Stay Current with Updates

## Epic List

### Epic 1: Connect Safely and Establish Trust
Users can create and manage connection profiles, establish secure connections, and operate with clear environment and safety state controls.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR47

### Epic 2: Explore Redis and Memcached Data
Users can discover keys/data structures and inspect cache metadata across Redis and Memcached to quickly understand system state.
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR27, FR28

### Epic 3: Interpret Values Safely
Users can understand values quickly with raw/pretty/decode workflows while keeping sensitive data protected by default.
**FRs covered:** FR29, FR30, FR31, FR32, FR33

### Epic 4: Perform Controlled Mutations
Users can perform intentional write operations only when explicitly unlocked, with safeguards and clear outcome feedback.
**FRs covered:** FR26, FR34, FR35, FR36, FR37, FR38

### Epic 5: Reuse Investigation Workflows and Share Findings
Users can save/replay searches, reopen recent investigations, and share safe evidence artifacts.
**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR48, FR49

### Epic 6: Work Faster with Desktop and Offline-First Productivity
Users can accelerate workflows via tray and global shortcut while relying on local persistence aligned with offline-first constraints.
**FRs covered:** FR44, FR45, FR46, FR50

### Epic 7: Stay Current with Updates
Users can discover available updates online and initiate installation from in-app prompts.
**FRs covered:** FR51, FR52

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic 1: Connect Safely and Establish Trust

Users can create and manage connection profiles, establish secure connections, and operate with clear environment and safety state controls.

### Story 1.1: Initialize Desktop Foundation and Secure Process Boundaries

As a developer,
I want the Electron app scaffolded with main/preload/renderer boundaries,
So that connection workflows can be implemented safely and consistently.

**Acceptance Criteria:**

**Given** a fresh repo
**When** the app is initialized using the selected starter template
**Then** main, preload, and renderer processes are separated and build successfully.
**And** context isolation is enabled and the renderer does not have direct Node access.

**Given** the renderer needs privileged operations
**When** it accesses persistence, network, or secrets
**Then** it can only do so via preload-exposed typed APIs (no ad-hoc IPC channels).

### Story 1.2: UI Foundation (Tailwind Tokens + Base UI + shadcn Copy-In)

As a developer,
I want the renderer UI system set up with semantic tokens and accessible primitives,
So that every feature ships with consistent, keyboard-first components.

**Acceptance Criteria:**

**Given** the renderer build
**When** Tailwind is configured
**Then** semantic design tokens exist for surfaces/text/border/focus/danger and env/safety states.

**Given** UI primitives are needed (buttons, dialogs, menus)
**When** components are created
**Then** they follow a shadcn-style copy-in approach backed by Base UI primitives (not Radix).

**Given** baseline components (at least Button and Dialog)
**When** rendered in the app
**Then** they are keyboard accessible with visible focus states and predictable Escape behavior.

### Story 1.3: Create and Manage Connection Profiles

As a cache user,
I want to create, edit, delete, tag, favorite, and search connection profiles,
So that I can quickly organize and access target environments.

**Acceptance Criteria:**

**Given** the profiles UI
**When** I create, edit, or delete a profile
**Then** changes persist locally and validation errors are shown clearly (FR1).

**Given** multiple profiles
**When** I tag, favorite, or search profiles
**Then** results filter correctly and update immediately (FR2).

**Given** the app restarts
**When** I reopen the app
**Then** profile metadata is restored from local persistence (FR47).

### Story 1.4: Configure Authentication and Secure Credential Handling

As a cache user,
I want to configure Redis/Memcached authentication and credential persistence policy,
So that I can connect securely without exposing secrets.

**Acceptance Criteria:**

**Given** a profile with authentication enabled
**When** I choose to save credentials
**Then** secrets are stored only via safeStorage and never in plaintext on disk (NFR8, NFR9).

**Given** safeStorage reports a basic_text backend
**When** I attempt to save credentials
**Then** saving is disabled and prompt-per-session is enforced with clear guidance (NFR9).

**Given** Redis auth settings
**When** I configure authentication
**Then** password-based auth is supported (FR5).

**Given** a profile with sensitive credentials
**When** I choose “prompt every time” for that profile
**Then** credentials are not persisted and I am prompted each session before connecting (FR7).

### Story 1.5: Connect, Disconnect, and Switch Sessions with Status and Errors

As a cache user,
I want to connect, disconnect, and switch between connections without restarting,
So that I can move across environments quickly and recover from failures.

**Acceptance Criteria:**

**Given** a valid profile
**When** I connect
**Then** the app connects to the selected Redis or Memcached target (FR3) (FR4).

**Given** an active connection
**When** I disconnect or switch profiles
**Then** the session transitions complete without restarting the app (FR8).

**Given** connection attempts succeed or fail
**When** status changes
**Then** the app shows connection status and the last connection error for the active connection (FR9).
**And** failures provide actionable errors and the app remains recoverable (NFR7).

### Story 1.6: Configure Redis TLS per Profile (When Supported)

As a cache user,
I want to configure TLS for Redis connections when supported by the target,
So that remote connections can be secured.

**Acceptance Criteria:**

**Given** a Redis profile
**When** I enable or disable TLS settings
**Then** the connection uses TLS according to the profile configuration (FR6).

**Given** an insecure or misconfigured TLS setup
**When** I attempt to connect
**Then** the app surfaces the risk or error clearly and does not silently fall back to insecure behavior (NFR10).

### Story 1.7: Environment Labels and Default Safety Posture (Read-Only by Default for Prod)

As a cache user,
I want environment labels and production-safe defaults,
So that I avoid accidental risky operations.

**Acceptance Criteria:**

**Given** profile settings
**When** I assign an environment label
**Then** the active environment is always visible in the app (FR10) (FR11).

**Given** a profile labeled as production
**When** I connect
**Then** the app enforces read-only mode by default for that connection (FR12).

### Story 1.8: Unlock and Relock Mutations Mode with Explicit Safety Signals

As a cache user,
I want to deliberately unlock mutations and return to read-only,
So that write operations are always intentional.

**Acceptance Criteria:**

**Given** an active connection in read-only mode
**When** I explicitly unlock mutations
**Then** mutation-enabled state is visibly and persistently indicated (FR13) (FR15).

**Given** unlocked mode
**When** I relock
**Then** the connection returns to read-only mode and the UI reflects that immediately (FR14).

## Epic 2: Explore Redis and Memcached Data

Users can discover Redis keys quickly (prefix browsing plus search), inspect metadata (type/TTL), and retrieve values with safe performance caps; for Memcached, users can fetch a value by key and review server stats.

### Story 2.1: Redis Key Discovery (Prefix Browse + Search) with Progressive, Cancelable Results

As a cache user,
I want to browse Redis keys via prefix/tree navigation and search by substring/pattern,
So that I can find the right key fast without freezing the app.

**Acceptance Criteria:**

**Given** an active Redis connection
**When** I browse keys by prefix/tree navigation
**Then** I can drill into prefixes and see matching keys (FR16).

**Given** an active Redis connection
**When** I run a substring/pattern search
**Then** results begin streaming quickly and I can cancel the search (FR17) (NFR3) (NFR5).

**Given** a large keyspace or long-running scan
**When** results are incomplete due to limits/caps
**Then** the UI shows an explicit "search in progress" or "limit reached" state with safe next actions (NFR3, NFR6).

### Story 2.2: Redis Key Metadata in Results (Type + TTL)

As a cache user,
I want to see Redis key metadata including type and TTL when available,
So that I can choose the right keys to inspect.

**Acceptance Criteria:**

**Given** Redis key results are displayed
**When** metadata is available
**Then** each key can show its type and TTL (FR18).

**Given** TTL/type lookups are slow or fail
**When** metadata is requested
**Then** the UI remains responsive and errors are actionable without forcing an app restart (NFR5, NFR7).

### Story 2.3: Redis Inspect Strings and Hashes (Fetch + Minimal Viewer with Safety Caps)

As a cache user,
I want to inspect Redis string and hash values,
So that I can understand what a key contains.

**Acceptance Criteria:**

**Given** a selected Redis string key
**When** I open the inspector
**Then** the app fetches and displays the string value (FR19).

**Given** a selected Redis hash key
**When** I open the inspector
**Then** the app fetches and displays fields and values (FR20).

**Given** values exceed safe preview limits
**When** I inspect the key
**Then** the app degrades gracefully (partial preview + clear "too large" state) and stays responsive (NFR4, NFR6, NFR16).

### Story 2.4: Redis Inspect Lists, Sets, and Sorted Sets (Fetch + Minimal Viewer with Safety Caps)

As a cache user,
I want to inspect Redis list, set, and sorted set values,
So that I can understand ordered and collection-based data.

**Acceptance Criteria:**

**Given** a selected Redis list key
**When** I open the inspector
**Then** the app fetches and displays ordered elements (FR21).

**Given** a selected Redis set key
**When** I open the inspector
**Then** the app fetches and displays members (FR22).

**Given** a selected Redis sorted set key
**When** I open the inspector
**Then** the app fetches and displays members and scores (FR23).

**Given** results are large
**When** I inspect a collection
**Then** the app shows partial results safely and provides an explicit path to export partial/raw later (NFR6, NFR18).

### Story 2.5: Redis Inspect Streams (Fetch + Minimal Viewer with Safety Caps)

As a cache user,
I want to inspect Redis stream data,
So that I can review recent entries and their fields.

**Acceptance Criteria:**

**Given** a selected Redis stream key
**When** I open the inspector
**Then** the app fetches and displays entries and fields (FR24).

**Given** stream entry counts can be high
**When** I inspect a stream
**Then** the app limits the default fetch safely, remains responsive, and makes any truncation obvious (NFR5, NFR6).

### Story 2.6: Memcached Get by Key (Read) with Basic Metadata and Error Handling

As a cache user,
I want to fetch a Memcached value by key,
So that I can verify what is currently cached.

**Acceptance Criteria:**

**Given** an active Memcached connection
**When** I enter a key and request a fetch
**Then** the app retrieves the value by key (FR25).

**Given** Memcached exposes metadata for a fetched value
**When** the fetch succeeds
**Then** the app displays basic metadata when available (e.g., size/flags) (FR28).

**Given** the fetch fails (missing key, network error)
**When** the request completes
**Then** the app shows an actionable error and remains recoverable without restart (NFR7).

### Story 2.7: Memcached Server Statistics

As a cache user,
I want to view Memcached server statistics,
So that I can assess cache health quickly.

**Acceptance Criteria:**

**Given** an active Memcached connection
**When** I open the stats view
**Then** the app displays server statistics and refreshes on demand (FR27).

**Given** the server is unreachable or times out
**When** stats are requested
**Then** the app reports the failure with next actions and keeps the UI responsive (NFR5, NFR7).

## Epic 3: Interpret Values Safely

Users can view cache values in a safe preview mode, understand decoded/formatted representations, and copy/share in a redaction-safe way by default.

### Story 3.1: Safe Value Preview Limits and "Cap Reached" States

As a cache user,
I want value previews to be safe and fast even for large payloads,
So that the app stays responsive under pressure.

**Acceptance Criteria:**

**Given** an inspected value
**When** the decoded output is within limits
**Then** it renders quickly and the UI remains responsive (NFR4, NFR5).

**Given** an inspected value exceeds the default preview limit
**When** I open it in the inspector
**Then** the app shows a clear "too large to preview safely" state with a partial preview when feasible (NFR16).

**Given** structured rendering would exceed depth limits
**When** I view formatted output
**Then** the app truncates/collapses beyond the limit with clear indicators (NFR17).

### Story 3.2: Redaction-by-Default Safe Preview Mode

As a cache user,
I want values to be redacted by default with clear affordances,
So that I do not accidentally expose secrets during debugging or screen share.

**Acceptance Criteria:**

**Given** a value that appears sensitive
**When** it is displayed in the inspector
**Then** sensitive-looking segments are redacted by default (FR29) (NFR11).

**Given** redaction is applied
**When** I view the value
**Then** the UI clearly indicates that redaction is active and what policy is applied (NFR11).

### Story 3.3: Deliberate Safe Reveal Interaction

As a cache user,
I want a deliberate safe reveal interaction to view redacted content,
So that revealing secrets is an intentional action.

**Acceptance Criteria:**

**Given** redacted content in the inspector
**When** I perform the safe reveal interaction
**Then** the content is revealed deliberately and the UI clearly indicates it is revealed (FR30).

**Given** revealed content
**When** I navigate away or re-lock safety state
**Then** the app re-hides revealed content to return to safe defaults (NFR11).

### Story 3.4: Raw vs Formatted Views

As a cache user,
I want to switch between raw and formatted views,
So that I can quickly validate the underlying bytes and the interpreted meaning.

**Acceptance Criteria:**

**Given** an inspected value where formatting is applicable
**When** I switch between Raw and Formatted
**Then** the correct representation is shown without losing my place (FR31).

**Given** long values or expensive formatting
**When** I toggle views
**Then** the UI remains responsive and does not block other interactions (NFR5).

### Story 3.5: Decode Pipeline Selection and Visibility

As a cache user,
I want to apply a decode pipeline and see which decode is active,
So that I can understand how the app is interpreting the value.

**Acceptance Criteria:**

**Given** an inspected value
**When** I choose a decode pipeline (e.g., raw text, JSON pretty)
**Then** the viewer updates and indicates the active decoding choice (FR32).

**Given** decoding fails or is unsupported
**When** the pipeline runs
**Then** the app shows a guided failure state and safe fallback actions (NFR7).

### Story 3.6: Copy in Redacted-Safe Form

As a cache user,
I want to copy a value representation in a redacted-safe form by default,
So that I can share findings without accidentally leaking secrets.

**Acceptance Criteria:**

**Given** an inspected value with redaction active
**When** I copy the value
**Then** the copied content is redacted-safe by default (FR33).

**Given** the value is revealed in the UI
**When** I copy
**Then** the default copy action still copies the redacted-safe form unless I explicitly choose otherwise (NFR11).

## Epic 4: Perform Controlled Mutations

Users can perform intentional write operations only when explicitly unlocked, with clear safeguards and feedback that prevent accidental production damage.

### Story 4.1: Enforce Mutation Blocking by Default (Read-Only Posture)

As a cache user,
I want mutation operations to be blocked unless I have explicitly unlocked mutations,
So that I cannot accidentally modify data.

**Acceptance Criteria:**

**Given** the active connection is not in unlocked mutations mode
**When** I attempt any mutation operation in the UI
**Then** the action is blocked with a clear explanation (FR35).

**Given** a production-labeled profile
**When** I connect
**Then** mutations remain blocked by default until I explicitly unlock (FR12) (FR35).

### Story 4.2: Redis Mutations for Strings and Hashes (When Unlocked)

As a cache user,
I want to mutate Redis string and hash data in unlocked mode,
So that I can fix or test cache state intentionally.

**Acceptance Criteria:**

**Given** unlocked mutations mode is enabled
**When** I set a string value
**Then** Redis is updated and the UI shows success/failure with reason (FR34) (FR36) (FR38).

**Given** unlocked mutations mode is enabled
**When** I update a hash field
**Then** Redis is updated and the UI shows success/failure with reason (FR34) (FR36) (FR38).

### Story 4.3: Redis Mutations for Lists, Sets, ZSets, and Streams (When Unlocked)

As a cache user,
I want to mutate Redis collection and stream types in unlocked mode,
So that I can apply targeted edits across common data structures.

**Acceptance Criteria:**

**Given** unlocked mutations mode is enabled
**When** I push a list element, add a set member, add a zset member with score, or add a stream entry
**Then** the operation succeeds or fails with clear feedback (FR34) (FR36) (FR38).

### Story 4.4: Redis Key Deletion (When Unlocked)

As a cache user,
I want to delete a Redis key in unlocked mode,
So that I can remove incorrect or stale cached data safely.

**Acceptance Criteria:**

**Given** unlocked mutations mode is enabled
**When** I delete a key
**Then** the key is removed and the UI confirms the outcome (FR37) (FR38).

### Story 4.5: Memcached Set by Key (When Unlocked)

As a cache user,
I want to set a Memcached value by key in unlocked mode,
So that I can test or correct cached values intentionally.

**Acceptance Criteria:**

**Given** unlocked mutations mode is enabled on a Memcached connection
**When** I set a value by key
**Then** the operation succeeds or fails with clear feedback (FR26) (FR38).

## Epic 5: Reuse Investigation Workflows and Share Findings

Users can reuse common investigation workflows and share evidence artifacts safely without leaking secrets by default.

### Story 5.1: Save and Recall Searches (Scoped)

As a cache user,
I want to save searches (query plus optional scope) and recall them later,
So that repetitive investigations are fast.

**Acceptance Criteria:**

**Given** an explorer search
**When** I save it with optional scope (connection and/or prefix)
**Then** it is stored locally and appears in a saved searches list (FR39) (FR48).

**Given** a saved search
**When** I select it
**Then** the app re-runs the search with the saved scope and shows results (FR40).

### Story 5.2: Recent Keys and Investigation History (Session)

As a cache user,
I want to view and reopen recently inspected keys for the current session,
So that I can bounce between findings quickly.

**Acceptance Criteria:**

**Given** I inspect keys during a session
**When** I open "Recents"
**Then** I can see and reopen recently inspected keys/values for the current session (FR41).

### Story 5.3: Export Minimal Markdown Bundle (Redacted by Default)

As a cache user,
I want to export a minimal single-file Markdown bundle with safe context,
So that I can share evidence offline without exposing secrets.

**Acceptance Criteria:**

**Given** an inspected key/value
**When** I export the Markdown bundle
**Then** it includes key metadata, decode context, and a redacted preview by default (FR42) (NFR11).

**Given** the export completes
**When** I locate it
**Then** the artifact is saved locally as an explicit export (FR49).

### Story 5.4: Copy "Pretty Snippet" for Sharing (Safe Context)

As a cache user,
I want to copy a pretty snippet that includes safe context without secrets by default,
So that I can share findings in chat or tickets.

**Acceptance Criteria:**

**Given** an inspected key/value
**When** I copy the pretty snippet
**Then** it includes env label, key, TTL, and decode info while redacting sensitive content by default (FR43) (NFR11).

## Epic 6: Work Faster with Desktop and Offline-First Productivity

Users can access core actions quickly via desktop integration and rely on predictable local-first behavior without requiring internet access for core workflows.

### Story 6.1: Tray Menu Quick Actions with Safety Indicator

As a cache user,
I want core actions accessible from a tray menu with a safety indicator,
So that I can quickly re-enter context and avoid mistakes.

**Acceptance Criteria:**

**Given** the app is running
**When** I open the tray menu
**Then** I can access core actions (open app, recent connections) and see current safety/mode indicator (FR44).

### Story 6.2: Global Shortcut to Focus Search

As a cache user,
I want a global keyboard shortcut to bring the app forward and focus search,
So that I can jump in and find keys immediately.

**Acceptance Criteria:**

**Given** the app is running in the background
**When** I trigger the global shortcut
**Then** the app comes to the foreground and focuses the search field (FR45).

### Story 6.3: Local Preferences Storage

As a cache user,
I want my preferences stored locally,
So that the app behaves consistently across sessions without needing a backend.

**Acceptance Criteria:**

**Given** I change user preferences
**When** I restart the app
**Then** preferences are restored from local storage (FR46) (NFR12).

### Story 6.4: Do Not Persist Fetched Cache Values by Default

As a cache user,
I want the app to avoid persisting fetched cache values by default,
So that sensitive cache content is not retained on disk unintentionally.

**Acceptance Criteria:**

**Given** I inspect cache values in the UI
**When** I close and reopen the app
**Then** previously fetched values are not stored/restored automatically (FR50) (NFR13).

**Given** I want to retain evidence
**When** I use export features
**Then** only explicit export artifacts are saved locally (FR49).

## Epic 7: Stay Current with Updates

Users can check for updates when online and initiate installation through a platform-appropriate flow.

### Story 7.1: Check for Available Updates and Notify User

As a cache user,
I want the app to check for available updates when online,
So that I can stay current without manual monitoring.

**Acceptance Criteria:**

**Given** the app has internet access
**When** the update check runs
**Then** the app can detect a newer version and notify the user (FR51).

### Story 7.2: User-Initiated Update Install Handoff

As a cache user,
I want to initiate installing an update from the prompt,
So that I can install updates using the platform-appropriate flow.

**Acceptance Criteria:**

**Given** an update is available
**When** I accept the prompt to install
**Then** the app hands off to the appropriate download/install flow and clearly indicates next steps (FR52).
