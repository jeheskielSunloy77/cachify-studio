## Epic 3: Understand Values Safely (Redaction + Decode + Views)

Users can safely understand values via redaction-by-default, deliberate reveal, raw/formatted views, and decode pipelines—without UI lockups.

### Story 3.1: Redaction-by-default previews with deliberate “safe reveal”

As a a cache user,
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

As a a cache user,
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

As a a cache user,
I want to apply a decode pipeline and see which decoding is active,
So that opaque payloads become understandable quickly.

**Acceptance Criteria:**

**Given** a value
**When** I select a decode pipeline
**Then** the rendered view updates and the active pipeline is clearly indicated
