## Epic 2: Explore Redis & Memcached Data (Keys, Search, Inspect)

Users can quickly find keys and inspect cache data (type/TTL + all supported Redis types + Memcached get/stats) with fast, responsive browsing.

### Story 2.1: Redis Keyspace Explorer: prefix navigation + streaming search

As a a cache user,
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

As a a cache user,
I want to view key metadata like type and TTL,
So that I can quickly judge what I’m looking at.

**Acceptance Criteria:**

**Given** I select a Redis key
**When** metadata loads
**Then** type and TTL are displayed (or clearly marked unavailable)

### Story 2.3: Inspect Redis Strings/Hashes/Lists/Sets/ZSets/Streams (read-only)

As a a cache user,
I want to inspect each supported Redis data type safely,
So that I can debug data structures without using the CLI.

**Acceptance Criteria:**

**Given** a key of a supported type
**When** I open it
**Then** I see a stable inspector view with pagination/virtualization where needed

### Story 2.4: Memcached: get by key + stats (read-only)

As a a cache user,
I want to fetch a value by key and view server stats from Memcached,
So that I can diagnose simple Memcached issues quickly.

**Acceptance Criteria:**

**Given** I am connected to Memcached
**When** I fetch a key
**Then** I see the value and any available metadata (size/flags if exposed)

**Given** I am connected to Memcached
**When** I open stats
**Then** I see a stats table and can refresh it
