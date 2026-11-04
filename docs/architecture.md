# Architecture

Closeness Lines is intentionally split into a static client and a small server boundary.

## Request flow

```text
Browser
  │ public/config.js: public API base URL
  ▼
Supabase Edge Function /functions/v1/closeness-lines/api
  │ service credential held only in Edge runtime
  ▼
Supabase private table + service-only RPCs
```

The browser never connects directly to the table and never receives a service key. The public API URL identifies the Supabase project; it does not identify a user or grant database access. CORS is an origin check, not authentication.

The local Node server uses the same shared request logic with a private SQLite database. It is an offline development backend, not a replication of hosted data.

## Capabilities

There are no user accounts. A save creates three random UUID capabilities:

- an editing link that can read and update the labeled timeline;
- a labeled view link;
- a public view link containing only generic relationship types and geometry.

The server stores only a SHA-256 digest of the edit capability. Possession of a capability URL is access, so editing links should be treated like passwords. Public projections omit names, custom subtypes, birth year, original relationship IDs, and private capability IDs. An optional tagline is deliberate public text and is limited to two lines and 180 characters.

The gallery is a database-ranked public projection. It excludes timelines with fewer than two relationships, then orders by relationship count, total point count, and UUID tie-breaker. Pagination is applied after that ordering.

## Persistence and deployment

The static client is built from `public/` into `dist/` for GitHub Pages. The Pages workflow publishes only `dist/`. Supabase migrations and Edge Function deploys are separate operational changes and should be reviewed independently from frontend changes.

