import { createServer } from 'node:http';
import { mkdirSync, lstatSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createSharingHandler, uuidPattern } from '../supabase/functions/_shared/sharing-core.mjs';

const siteDir = fileURLToPath(new URL('../public/', import.meta.url));
const staticFiles = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['creator.html', 'text/html; charset=utf-8'],
  ['gallery.html', 'text/html; charset=utf-8'],
  ['timeline.html', 'text/html; charset=utf-8'],
  ['404.html', 'text/html; charset=utf-8'],
  ['site.css', 'text/css; charset=utf-8'],
  ['favicon.svg', 'image/svg+xml'],
  ['api.js', 'text/javascript; charset=utf-8'],
  ['config.js', 'text/javascript; charset=utf-8'],
  ['timeline-plot.js', 'text/javascript; charset=utf-8']
]);

function openLocalStore(directory) {
  const dataDir = resolve(directory);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const stat = lstatSync(dataDir);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) {
    throw new Error('The data directory must be a private directory owned by the current user.');
  }
  const db = new DatabaseSync(join(dataDir, 'timelines.sqlite'));
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS timelines (
      public_id TEXT PRIMARY KEY,
      view_id TEXT NOT NULL UNIQUE,
      edit_hash TEXT NOT NULL UNIQUE,
      timeline TEXT NOT NULL,
      lines TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 200),
      published INTEGER NOT NULL CHECK (published IN (0, 1)),
      revision INTEGER NOT NULL CHECK (revision >= 1)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS gallery_idx ON timelines (public_id, age) WHERE published = 1;
  `);

  if (!db.prepare("PRAGMA table_info(timelines)").all().some(column => column.name === "created_at")) db.exec("ALTER TABLE timelines ADD COLUMN created_at TEXT");

  const insert = db.prepare(`
    INSERT INTO timelines (public_id, view_id, edit_hash, timeline, lines, age, published, revision, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const edit = db.prepare(`
    SELECT public_id, view_id, timeline, age, published, revision, created_at FROM timelines WHERE edit_hash = ?
  `);
  const view = db.prepare('SELECT timeline, age, created_at FROM timelines WHERE view_id = ?');
  const publicTimeline = db.prepare("SELECT lines, age, created_at, json_extract(timeline, '$.tagline') AS tagline FROM timelines WHERE public_id = ? AND published = 1");
  const update = db.prepare(`
    UPDATE timelines SET timeline = ?, lines = ?, age = ?, published = ?, revision = ?
    WHERE edit_hash = ? AND revision = ?
  `);
  const gallery = db.prepare(`
    WITH ranked AS (
      SELECT public_id, age, created_at, lines, json_extract(timeline, '$.tagline') AS tagline,
        json_array_length(lines) AS line_count,
        COALESCE((SELECT SUM(json_array_length(json_extract(value, '$.points'))) FROM json_each(lines)), 0) AS point_count
      FROM timelines WHERE published = 1 AND age BETWEEN ? AND ?
    )
    SELECT public_id, age, created_at, lines, tagline FROM ranked
    WHERE line_count >= 2
    ORDER BY line_count DESC, point_count DESC, public_id ASC
    LIMIT ?
  `);
  const galleryAfter = db.prepare(`
    WITH ranked AS (
      SELECT public_id, age, created_at, lines, json_extract(timeline, '$.tagline') AS tagline,
        json_array_length(lines) AS line_count,
        COALESCE((SELECT SUM(json_array_length(json_extract(value, '$.points'))) FROM json_each(lines)), 0) AS point_count
      FROM timelines WHERE published = 1 AND age BETWEEN ? AND ?
    )
    SELECT public_id, age, created_at, lines, tagline FROM ranked
    WHERE line_count >= 2 AND (
      line_count < ? OR (line_count = ? AND point_count < ?) OR
      (line_count = ? AND point_count = ? AND public_id > ?)
    )
    ORDER BY line_count DESC, point_count DESC, public_id ASC
    LIMIT ?
  `);
  const galleryAnchor = db.prepare(`
    SELECT json_array_length(lines) AS line_count,
      COALESCE((SELECT SUM(json_array_length(json_extract(value, '$.points'))) FROM json_each(lines)), 0) AS point_count
    FROM timelines WHERE public_id = ? AND published = 1
  `);

  return {
    insert(record) {
      insert.run(record.public_id, record.view_id, record.edit_hash, JSON.stringify(record.timeline),
        JSON.stringify(record.lines), record.age, Number(record.published), record.revision, record.created_at);
    },
    findEdit(hash) {
      const row = edit.get(hash);
      if (row) return { ...row, published: Boolean(row.published), timeline: JSON.parse(row.timeline) };
    },
    findView(id) {
      const row = view.get(id);
      if (row) return { ...row, timeline: JSON.parse(row.timeline) };
    },
    findPublic(id) {
      const row = publicTimeline.get(id);
      if (row) return { ...row, lines: JSON.parse(row.lines) };
    },
    update(hash, revision, record) {
      return update.run(JSON.stringify(record.timeline), JSON.stringify(record.lines), record.age,
        Number(record.published), record.revision, hash, revision).changes === 1;
    },
    gallery({ minAge, maxAge, cursor, limit }) {
      const anchor = cursor ? galleryAnchor.get(cursor) : undefined;
      const rows = anchor
        ? galleryAfter.all(minAge, maxAge, anchor.line_count, anchor.line_count, anchor.point_count,
          anchor.line_count, anchor.point_count, cursor, limit)
        : gallery.all(minAge, maxAge, limit);
      return rows.map(row => ({ ...row, lines: JSON.parse(row.lines) }));
    },
    close() { db.close(); }
  };
}

async function serve(request, response, server, api, backend) {
  const authority = request.headers.host;
  const port = server.address().port;
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(authority) || !request.url?.startsWith('/')) {
    response.writeHead(400).end('Invalid request.');
    return;
  }
  const origin = `http://${authority}`;
  const url = new URL(request.url, origin);
  if (url.origin !== origin) {
    response.writeHead(400).end('Invalid request.');
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    const options = { method: request.method, headers: request.headers };
    if (!['GET', 'HEAD'].includes(request.method)) {
      options.body = Readable.toWeb(request);
      options.duplex = 'half';
    }
    const webRequest = new Request(url, options);
    const result = await api(webRequest);
    // Drain the adapted stream before replying to an early body rejection.
    // Resuming IncomingMessage directly can race its Web Stream adapter.
    if (webRequest.body && !request.complete) {
      const reader = webRequest.body.getReader();
      try { while (!(await reader.read()).done) {} }
      finally { reader.releaseLock(); }
    }
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
    return;
  }

  let status = 200;
  let filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (url.pathname.startsWith('/t/') && uuidPattern.test(url.pathname.slice(3))) filename = 'timeline.html';
  if (!staticFiles.has(filename) || !['GET', 'HEAD'].includes(request.method)) {
    filename = '404.html';
    status = 404;
  }
  const body = filename === 'config.js' && backend === 'local'
    ? Buffer.from("window.CLOSENESS_LINES_API_BASE = '/api';\n")
    : await readFile(join(siteDir, filename)).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  response.writeHead(body ? status : 404, {
    'Content-Type': body ? staticFiles.get(filename) : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  response.end(request.method === 'HEAD' ? undefined : body ?? 'Page not found.');
}

export function createDevServer({ backend = process.env.CLOSENESS_BACKEND ?? 'local', dataDir = process.env.CLOSENESS_DATA_DIR ??
    join(tmpdir(), `closeness-lines-${process.getuid()}`) } = {}) {
  if (!['local', 'hosted'].includes(backend)) throw new Error('Invalid backend mode.');
  const store = openLocalStore(dataDir);
  const api = createSharingHandler(store, { onError: () => console.error('Sharing request failed.') });
  const server = createServer((request, response) => {
    serve(request, response, server, api, backend).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end('The local server could not process the request.');
    });
  });
  server.on('close', () => store.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8837);
  const server = createDevServer({ backend: process.argv.includes('--hosted') ? 'hosted' : undefined });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Closeness Lines listening on http://127.0.0.1:${server.address().port}`);
  });
}
