## Epic 7: Offline-First Local State (Preferences + Persistence Boundaries)

The app persists profiles/metadata/preferences/saved searches/exports locally while honoring the boundary of not persisting fetched values by default.

### Story 7.1: Preferences persistence (local, offline-first)

As a a cache user,
I want my preferences stored locally,
So that the app behaves consistently across sessions offline.

**Acceptance Criteria:**

**Given** I change a preference (theme/density/limits)
**When** I restart the app
**Then** the preference is preserved locally

### Story 7.2: Saved searches persistence (local)

As a a cache user,
I want saved searches persisted locally,
So that I can reuse them across sessions.

**Acceptance Criteria:**

**Given** I saved a search
**When** I restart the app
**Then** the saved search remains available

### Story 7.3: Export artifacts index + local storage

As a a cache user,
I want exports stored and indexed locally,
So that I can find past evidence bundles.

**Acceptance Criteria:**

**Given** I exported a Markdown bundle
**When** I open Exports
**Then** I see the artifact listed and can open the file

### Story 7.4: No fetched cache values persisted by default (enforced)

As a a security-minded user,
I want the app to avoid persisting fetched cache values by default,
So that sensitive data doesn’t end up on disk accidentally.

**Acceptance Criteria:**

**Given** I inspect values during a session
**When** I inspect app storage locations
**Then** no raw fetched values are stored unless I explicitly export
