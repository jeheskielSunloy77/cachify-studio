## Epic 1: Get Connected Safely (Profiles + Trust + Read-Only by Default)

Users can create secure connection profiles for Redis/Memcached, connect reliably, and always understand safety posture (env + read-only/unlock state) before doing anything else.

### Story 1.1: Project Bootstrap (Forge + Vite + React + Typed IPC)

As a a developer,
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

As a a cache user,
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

As a a cache user,
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

As a a cache user,
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

As a a cache user,
I want to always see what environment I am connected to and whether I am in read-only or unlocked mode,
So that I avoid wrong-environment mistakes.

**Acceptance Criteria:**

**Given** I am connected to any profile
**When** I view the app chrome
**Then** an always-visible chip shows env label and safety mode

**Given** a profile marked as production
**When** I connect
**Then** mutations are disabled by default and the UI clearly indicates read-only
