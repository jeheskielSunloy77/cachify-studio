## Epic 5: Controlled Mutations (Unlock + Type-Aware Edits)

When explicitly unlocked, users can perform supported mutations with clear feedback; when locked, mutations are reliably prevented.

### Story 5.1: Unlock mutations flow + locked-mode enforcement

As a a cache user,
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

As a a cache user,
I want to perform supported mutation operations for the inspected Redis type,
So that I can fix issues directly when I intend to.

**Acceptance Criteria:**

**Given** mutations are unlocked
**When** I edit a string or update a hash field / push list element / add set member / add zset member / add stream entry
**Then** the operation succeeds or fails with a clear reason

### Story 5.3: Delete Redis key (guarded) with success/failure feedback

As a a cache user,
I want to delete a key when mutations are enabled,
So that I can remove bad data intentionally.

**Acceptance Criteria:**

**Given** mutations are unlocked
**When** I delete a key and confirm
**Then** the key is removed and the UI updates the explorer list

### Story 5.4: Memcached set (only when unlocked)

As a a cache user,
I want to set a Memcached value by key when mutations are enabled,
So that I can validate fixes or adjust cached values intentionally.

**Acceptance Criteria:**

**Given** I am connected to Memcached and mutations are unlocked
**When** I set a value by key
**Then** the operation completes with clear feedback
