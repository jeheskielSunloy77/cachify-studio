## Epic 6: Desktop Power & Updates (Tray + Global Shortcut + Update Awareness)

The app integrates with the desktop for speed (tray + global shortcut) and can check for updates and assist installation.

### Story 6.1: Tray menu: quick open + recent connections + safety indicator

As a a cache user,
I want to access core actions from a tray menu with a visible mode indicator,
So that I can jump into debugging quickly.

**Acceptance Criteria:**

**Given** the app is running
**When** I open the tray menu
**Then** I can open the app and see recent connections and the current safety mode

### Story 6.2: Global shortcut focuses primary search

As a a cache user,
I want a global keyboard shortcut that brings the app forward and focuses search,
So that I can start an investigation instantly.

**Acceptance Criteria:**

**Given** the app is running in the background
**When** I press the configured shortcut
**Then** the app is focused and the search input is ready

### Story 6.3: Update awareness: check online + prompt to install

As a a cache user,
I want to be notified when an update is available and initiate installation,
So that I can keep the app current.

**Acceptance Criteria:**

**Given** the app is online
**When** I check for updates
**Then** I see whether a newer version exists and can start the install handoff
