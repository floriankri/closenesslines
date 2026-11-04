# Closeness Lines

Closeness Lines is a small, anonymous tool for drawing how relationships move closer and farther away across a life. The public site is hosted on GitHub Pages at [closenesslines.com](https://closenesslines.com); saved timelines use a Supabase Edge Function for storage and sharing.

## Development

Use Node.js 24 LTS. The project has no runtime npm dependencies.

```sh
npm ci
npm run check
npm test
npm run dev
```

`npm run dev` starts the local SQLite-backed server. It serves the site and `/api` on a loopback port. Set `PORT` to choose the port and `CLOSENESS_DATA_DIR` to keep the local database in a private directory outside the repository.

`npm run dev:hosted` starts the local frontend against the hosted Supabase API. This is useful for checking browser integration, but it does not change the hosted database by itself.

`npm run build` creates the GitHub Pages artifact in `dist/`. The artifact contains only the static frontend files. Server code, tests, SQL, and security documentation are never published as site assets.

## Repository map

- `public/` — static site files and the public Supabase API base URL.
- `server/` — local Node development server.
- `tests/` — API and projection tests.
- `supabase/` — Edge Function source and SQL migrations.
- `docs/` — architecture, operations, and security notes.
- `scripts/` — checks and the Pages build step.

See [`docs/architecture.md`](docs/architecture.md) for the request flow and capability model, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the change workflow.

## Supabase deployment

The hosted backend is project `jxnklhhjaumswbkmeqej`. Apply migrations through the Supabase migration workflow, then deploy the Edge Function explicitly with the installed CLI version's documented command. The service credential must remain an Edge runtime secret (`SUPABASE_SECRET_KEYS` or `SUPABASE_SERVICE_ROLE_KEY`); it must never be placed in `public/` or committed to Git.

The browser identifies the backend only through `public/config.js`, which contains the public Edge Function URL. That URL identifies the project and function, but it is not an authorization credential. The function authenticates its database requests with its server-side secret and enforces origin, input, quota, publication, and capability checks.

