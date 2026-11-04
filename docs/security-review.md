# Release security review — 2026-11-04

Scope: static frontend, shared API, hosted Supabase permissions and public deployment. This is a focused review, not a penetration-test certification.

## Verified

- Seven automated API tests: public text exclusion, capability authorization, publication controls, revision conflict, age filters/pagination, persistence, input/body limits, static-file boundaries and body-based capability transport.
- Hosted API tests: private create/read, labeled read, unauthorized update denied, publish/unpublish, public role-only JSON, stale update409, age filtering, allowed/disallowed CORS. Synthetic fixture removed.
- Direct public table access denied; anon/authenticated have no table SELECT privilege. Named lookup and rate-limit RPCs grant execution only to service_role.
- Atomic distributed limiter tested under service_role: two permitted operations then denial; transaction rolled back. Edge wrapper tests cover429, Retry-After, fail-closed503 and allowed origin headers.
- Input names render with textContent; no dynamic user HTML insertion found. No service credentials in public assets.
- Function version4 logs inspected: generic read/update paths, zero request.body fields. Named database lookups also use POST body.
- HTTPS enabled on GitHub Pages; www redirects to canonical origin.

## Fixes applied

- Added global caps:300 reads/minute,60 writes/minute,20 creates/hour and100/day. Counters keep no personal identifiers and expire after two days.
- Moved capability IDs from API URL paths into POST bodies; disabled hosted legacy token paths.
- Added service-only POST database lookup for named capabilities.
- Fixed local preview Web Stream draining so oversized request rejection consistently returns413 instead of a connection reset.

## Accepted limits

- Edit and named view links are bearer capabilities: anyone receiving one can use it. Website /t/UUID routes remain visible to the user browser and GitHub hosting infrastructure. No third-party analytics are loaded and private-page requests omit referrers.
- Global quotas can be exhausted by an abusive visitor, temporarily affecting others; these are not full DDoS controls or moderation. Revisit identity/rate limits as traffic grows.
- Advisor INFO notices for RLS without policies are intentional: browser access is denied; only the backend service accesses these tables.
- Real-device iOS/Android touch tests remain unverified; browser layout and pointer behavior were checked separately.

## Release verification

Published frontend commit ee23336 to floriankri/closenesslines main; GitHub Pages build succeeded. Live creator and /t/UUID fallback work. A synthetic script-like name rendered literally without script execution; its public version displayed only Dad. Test record removed. Live api.js matches reviewed source.


## Repository foundation follow-up — 2026-11-04
The source now includes tests and the exact four hosted migrations. Pages artifacts are built from an explicit public-file allowlist; backend files are not website assets. Publishing the source does not provide database access. New public fields are an explicitly public optional tagline and creation date; relationship names and private IDs remain excluded. Local development defaults to local SQLite rather than production. CI runs syntax checks, API tests and artifact-boundary checks before frontend deployment.
