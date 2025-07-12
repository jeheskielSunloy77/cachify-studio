## Epic 4: Share Evidence & Revisit Work (Copy/Export + Recents + Saved Searches)

Users can safely share what they found and quickly resume investigations via saved searches, recents, and exportable artifacts.

### Story 4.1: Safe copy to clipboard (redacted-safe default)

As a a cache user,
I want to copy a value representation to the clipboard safely,
So that I can share without leaking secrets by default.

**Acceptance Criteria:**

**Given** a value view
**When** I click Copy
**Then** the clipboard content is redacted-safe by default and includes minimal context

### Story 4.2: Export minimal Markdown bundle (single file) with context

As a a cache user,
I want to export a single-file Markdown bundle with key metadata, decode context, and redacted preview,
So that I can attach evidence to tickets offline.

**Acceptance Criteria:**

**Given** an inspected key
**When** I export
**Then** a single Markdown file is created including env label, key, TTL, decode pipeline, and redacted preview

### Story 4.3: Saved searches and quick recall (with optional scoping)

As a a cache user,
I want to save searches and recall them later,
So that I can reuse common workflows.

**Acceptance Criteria:**

**Given** a search query and optional scope
**When** I save it
**Then** it appears in Saved Searches and can be re-run

### Story 4.4: Recents: reopen recently inspected keys/values

As a a cache user,
I want to view and reopen recently inspected keys/values for the session,
So that I can bounce between items while debugging.

**Acceptance Criteria:**

**Given** I inspected keys during this session
**When** I open Recents
**Then** I can reopen a prior key and the inspector restores context
