# Repository instructions

Closeness Lines is a static frontend with a local development server and a hosted Supabase Edge Function.

- Keep deployable browser files under `public/`.
- Keep local server code under `server/`; never serve its source, SQL, tests, or secrets through GitHub Pages.
- Keep tests under `tests/` and run them with Node.js 24.
- Keep schema and Edge Function changes under `supabase/` with explicit migrations.
- Never commit service-role keys, `.env` files, local SQLite data, or private capability URLs.
- Public relationship projections may include preset relationship types, geometry, creation date, and the optional public tagline; they must not include custom names or private IDs.
- Treat editing links as bearer secrets. Do not log or paste them into issues, screenshots, analytics, or external services.
- Use the existing no-dependency Node toolchain unless a dependency is clearly justified and pinned.
