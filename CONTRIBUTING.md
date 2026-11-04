# Contributing

Keep changes small and reviewable. Use a branch named `codex/<topic>` or `feat/<topic>` and make commits describe one coherent change.

Before opening a pull request:

```sh
npm run check
npm test
npm run build
```

For API or Supabase changes, also verify that public projections contain no private names or IDs, capability authorization still works, and migration files match the hosted schema. Do not use a production editing link as a test fixture; create and remove synthetic local fixtures instead.

Never commit `.env` files, Supabase service keys, SQLite databases, browser exports, or generated `dist/` output unless the deployment workflow explicitly requires it. Public `config.js` may contain the Edge Function URL, but no secret.

Use normal commits and review the staged diff before pushing. A frontend change should not silently alter database schema or Edge Function behavior. A schema or Edge Function change should include a migration or deployment note and its focused tests.

