import { createSharingHandler } from '../_shared/sharing-core.mjs';
import { ALLOWED_ORIGINS, PROJECT_REF } from './config.mjs';

function createSupabaseStore(projectUrl, key, legacy) {
  const table = new URL('/rest/v1/closeness_timelines', projectUrl);
  const auth = new Headers({ apikey: key });
  if (legacy) auth.set('Authorization', `Bearer ${key}`);

  async function data(query, { method = 'GET', record, prefer } = {}) {
    const url = new URL(table);
    url.search = new URLSearchParams(query).toString();
    const headers = new Headers(auth);
    if (record) headers.set('Content-Type', 'application/json');
    if (prefer) headers.set('Prefer', prefer);
    const result = await fetch(url, {
      method, headers, redirect: 'error', signal: AbortSignal.timeout(10000),
      body: record ? JSON.stringify(record) : undefined
    });
    if (!result.ok) {
      await result.body?.cancel();
      throw new Error('Timeline storage request failed.');
    }
    if (prefer === 'return=minimal') return;
    return result.json();
  }

  async function consumeRateLimit(kind, limit, windowSeconds) {
    const url = new URL('/rest/v1/rpc/consume_rate_limit', projectUrl);
    const headers = new Headers(auth);
    headers.set('Content-Type', 'application/json');
    const result = await fetch(url, {
      method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ p_kind: kind, p_limit: limit, p_window_seconds: windowSeconds })
    });
    if (!result.ok) {
      await result.body?.cancel();
      throw new Error('Rate limiter request failed.');
    }
    return result.json();
  }

  return {
    consumeRateLimit,
    insert(record) {
      // Duration and public event projections are derived from the stored timeline JSON.
      const { duration: _duration, events: _events, ...stored } = record;
      return data({}, { method: 'POST', record: stored, prefer: 'return=minimal' });
    },
    async findEdit(hash) {
      const [row] = await data({
        select: 'public_id,view_id,timeline,age,published,revision,created_at',
        edit_hash: `eq.${hash}`, limit: 1
      });
      return row;
    },
    async findView(id) {
      const headers = new Headers(auth);
      headers.set('Content-Type', 'application/json');
      const response = await fetch(new URL('/rest/v1/rpc/closeness_named_view', projectUrl), {
        method: 'POST', headers, body: JSON.stringify({ p_id: id }),
        redirect: 'error', signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error('Timeline lookup failed.'); }
      return response.json();
    },
    async findPublic(id) {
      const [row] = await data({ select: 'age,created_at,duration:timeline->>duration,lines,events:timeline->>events,tagline:timeline->>tagline', public_id: `eq.${id}`, published: 'eq.true', limit: 1 });
      if (row?.events && typeof row.events === 'string') row.events = JSON.parse(row.events);
      return row;
    },
    async update(hash, revision, { timeline, lines, age, published }) {
      const rows = await data(
        { select: 'revision', edit_hash: `eq.${hash}`, revision: `eq.${revision}` },
        { method: 'PATCH', record: { timeline, lines, age, published, revision: revision + 1 }, prefer: 'return=representation' }
      );
      return rows.length === 1;
    },
    gallery({ minAge, maxAge, cursor, limit }) {
      const url = new URL('/rest/v1/rpc/closeness_gallery', projectUrl);
      const headers = new Headers(auth);
      headers.set('Content-Type', 'application/json');
      return fetch(url, {
        method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ p_min_age: minAge, p_max_age: maxAge,
          p_cursor: cursor ?? null, p_limit: limit ?? 13 })
      }).then(async response => {
        if (!response.ok) { await response.body?.cancel(); throw new Error('Timeline storage request failed.'); }
        return response.json();
      });
    }
  };
}

const configuredOrigin = Deno.env.get('CLOSENESS_WEB_ORIGIN');
const allowedOrigins = new Set(ALLOWED_ORIGINS);
if (configuredOrigin) allowedOrigins.add(configuredOrigin);
const projectUrl = Deno.env.get('SUPABASE_URL');
const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const key = secretKey || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const store = Deno.env.get('CLOSENESS_ENABLE_EDGE') !== 'false' && projectUrl === `https://${PROJECT_REF}.supabase.co` && key
  ? createSupabaseStore(projectUrl, key, !secretKey)
  : null;
const onError = () => console.error('Closeness Lines storage request failed.');
const internal = store && createSharingHandler(store, { prefix: '/closeness-lines/api', onError });
const external = store && createSharingHandler(store, { prefix: '/functions/v1/closeness-lines/api', onError });

const quota = {
  read: ['reads_minute', 300, 60],
  write: ['writes_minute', 60, 60],
  createHour: ['creates_hour', 20, 3600],
  createDay: ['creates_day', 100, 86400]
};

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin' });
  if (!store || (origin && !allowedOrigins.has(origin))) {
    return Response.json({ error: 'Timeline not found.' }, { status: 404, headers });
  }
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(null, { status: 204, headers });
  }
  try {
    const path = new URL(request.url).pathname;
    const create = request.method === 'POST' && path.endsWith('/timelines');
    const write = create || (request.method === 'POST' && path.endsWith('/timelines/update')) || request.method === 'PUT';
    const checks = [quota[write ? 'write' : 'read']];
    if (create) checks.push(quota.createHour, quota.createDay);
    for (const [kind, limit, seconds] of checks) {
      if (!await store.consumeRateLimit(kind, limit, seconds)) {
        headers.set('Retry-After', String(seconds));
        return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429, headers });
      }
    }
  } catch {
    return Response.json({ error: 'Sharing is temporarily unavailable.' }, { status: 503, headers });
  }
  const pathname = new URL(request.url).pathname;
  if (/\/timelines\/[0-9a-f-]{36}$/.test(pathname)) {
    return Response.json({ error: 'Timeline not found.' }, { status: 404, headers });
  }
  const handler = new URL(request.url).pathname.startsWith('/functions/v1/') ? external : internal;
  const result = await handler(request);
  for (const [name, value] of headers) result.headers.set(name, value);
  return result;
});
