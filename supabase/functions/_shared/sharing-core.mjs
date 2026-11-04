const categories = {
  family: ['Family member', 'Parent', 'Mum', 'Mom', 'Dad', 'Sibling', 'Brother', 'Sister', 'Child', 'Grandparent', 'Extended family'],
  friends: ['Friend', 'Childhood friend', 'School friend', 'University friend', 'Close friend', 'Neighbor', 'Friend group'],
  romance: ['Partner', 'Spouse', 'Dating', 'Fling'],
  work: ['Colleague', 'Mentor', 'Work friend', 'Team'],
  pets: ['Pet', 'Dog', 'Cat', 'Other pet']
};
const publicTypes = new Set([
  ...Object.values(categories).flat(),
  'Older sibling', 'Younger sibling', 'Middle sibling', 'Youngest sibling',
  'Oldest child', 'Middle child', 'Youngest child'
]);
const endings = new Set(['ongoing', 'fade', 'death']);
// This palette is assigned by line position, independently of relationship metadata.
const colors = ['#a74336', '#357267', '#5c598e', '#8a651d', '#486d90', '#9a4e73', '#626e45', '#90563e'];
const maxAge = 200;
const maxBodyBytes = 1024 * 1024;
const pageSize = 12;

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const invalid = () => new RequestError(400, 'Invalid timeline or request.');
const missing = () => new RequestError(404, 'Timeline not found.');
const conflict = () => new RequestError(409, 'This timeline changed. Reload it before saving again.');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integerIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const precise = value => Number.isFinite(value) && value === Math.round(value * 1000) / 1000;

function publicType(track, relationships) {
  const { category, subtype } = track;
  const presets = categories[category];
  if (!presets.includes(subtype)) return presets[0];
  if (category !== 'family' || !['Sibling', 'Child'].includes(subtype)) return subtype;

  const age = track.points[0][0];
  const sibling = subtype === 'Sibling';
  if (sibling && age === 0) return 'Older sibling';
  const peerAges = relationships
    .filter(peer => peer !== track && peer.category === category && peer.subtype === subtype)
    .map(peer => peer.points[0][0])
    .filter(peerAge => !sibling || peerAge > 0);
  const generic = sibling ? 'Younger sibling' : 'Child';
  if (!peerAges.length || peerAges.includes(age)) return generic;

  const earlier = peerAges.some(peerAge => peerAge < age);
  const later = peerAges.some(peerAge => peerAge > age);
  if (sibling) {
    if (!earlier) return generic;
    return later ? 'Middle sibling' : 'Youngest sibling';
  }
  if (!earlier) return 'Oldest child';
  return later ? 'Middle child' : 'Youngest child';
}

function normalizeTimeline(input, nowDate) {
  const year = nowDate.getUTCFullYear();
  const month = nowDate.getUTCMonth() + 1;
  if (!object(input) || input.version !== 2 || !integerIn(input.birthYear, 1900, year) ||
      !['now', 'death'].includes(input.endMode) || !Array.isArray(input.relationships) ||
      input.relationships.length < 1 || input.relationships.length > 100) throw invalid();

  const { birthYear, endMode, endYear } = input;
  const birthMonth = input.birthMonth === undefined || input.birthMonth === null ? null : input.birthMonth;
  if (birthMonth !== null && !integerIn(birthMonth, 1, 12)) throw invalid();
  if (birthMonth !== null && birthYear === year && birthMonth > month) throw invalid();
  const tagline = input.tagline === undefined ? '' : input.tagline;
  if (typeof tagline !== 'string' || tagline.length > 180 || tagline.replace(/\r\n?/g, '\n').split('\n').length > 2) throw invalid();
  if (endMode === 'now' && endYear !== null) throw invalid();
  if (endMode === 'death' && !integerIn(endYear, birthYear, year)) throw invalid();
  const duration = endMode === 'now' && birthMonth !== null
    ? Math.round((((year - birthYear) * 12 + month - birthMonth) / 12) * 1000) / 1000
    : (endYear ?? year) - birthYear;
  if (!Number.isFinite(duration) || duration < 0 || duration > maxAge) throw invalid();
  const age = Math.floor(duration);

  const ids = new Set();
  const relationships = input.relationships.map(track => {
    if (!object(track) || typeof track.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(track.id) ||
        ids.has(track.id) || !Object.hasOwn(categories, track.category) || !endings.has(track.ending) ||
        typeof track.name !== 'string' || track.name.length > 80 ||
        typeof track.subtype !== 'string' || track.subtype.length > 50 ||
        !Array.isArray(track.points) || track.points.length < 1 || track.points.length > 500) throw invalid();
    ids.add(track.id);

    let previous = -1;
    const points = track.points.map(point => {
      if (!Array.isArray(point) || point.length !== 2) throw invalid();
      const [pointAge, distance] = point;
      if (!precise(pointAge) || pointAge < 0 || pointAge <= previous || pointAge > duration ||
      !precise(distance) || Math.abs(distance) > 1) throw invalid();
      previous = pointAge;
      return [pointAge, distance];
    });
    if (track.ending === 'ongoing' && previous < duration) {
      if (points.length === 1) points.push([duration, points[0][1]]);
      else points.at(-1)[0] = duration;
    }
    return {
      id: track.id,
      name: track.name.trim(),
      category: track.category,
      subtype: track.subtype.trim(),
      ending: track.ending,
      points
    };
  });
  return {
    age,
    duration,
    timeline: { version: 2, birthYear, birthMonth, endMode, endYear, duration, tagline: tagline.replace(/\r\n?/g, '\n').trim(), relationships },
    lines: relationships.map((track, index) => ({
      color: colors[index % colors.length],
      type: publicType(track, relationships),
      ending: track.ending,
      points: track.points
    }))
  };
}

async function hashEditId(editId) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editId));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function saveResponse(record, editId) {
  return {
    editId, viewId: record.view_id, publicId: record.public_id,
    revision: record.revision, age: record.age, duration: record.duration ?? record.timeline?.duration ?? record.age, published: record.published, createdAt: record.created_at ?? null
  };
}

function publicGeometry(record) {
  const lines = record.lines.map(({ color, type, ending, points }) => ({
    color, type: publicTypes.has(type) ? type : 'Relationship', ending,
    points: points.map(([age, distance]) => [age, distance])
  }));
  const duration = record.duration === null || record.duration === undefined
    ? record.age
    : (Number.isFinite(Number(record.duration)) ? Number(record.duration) : record.age);
  return { age: record.age, duration, createdAt: record.created_at ?? null, lines, tagline: typeof record.tagline === 'string' ? record.tagline : '' };
}

async function readBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Send a JSON request.');
  }
  const tooLarge = () => new RequestError(413, 'This timeline is too large to save.');
  if (Number(request.headers.get('content-length')) > maxBodyBytes) throw tooLarge();
  if (!request.body) throw invalid();

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let content = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) throw tooLarge();
      content += decoder.decode(value, { stream: true });
    }
    const result = JSON.parse(content + decoder.decode());
    if (!object(result)) throw invalid();
    return result;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw invalid();
  } finally {
    reader.releaseLock();
  }
}

function galleryQuery(params) {
  function ageFilter(key, fallback) {
    const value = params.get(key);
    if (value === null || value === '') return fallback;
    if (!/^\d{1,3}$/.test(value) || !integerIn(Number(value), 0, maxAge)) {
      throw new RequestError(400, 'Invalid age filter.');
    }
    return Number(value);
  }

  const minAge = ageFilter('minAge', 0);
  const max = ageFilter('maxAge', maxAge);
  if (minAge > max) throw new RequestError(400, 'Invalid age filter.');
  const cursor = params.get('cursor');
  if (cursor !== null && !uuidPattern.test(cursor)) throw new RequestError(400, 'Invalid gallery cursor.');
  return { minAge, maxAge: max, cursor, limit: pageSize + 1 };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export function createSharingHandler(store, { prefix = '/api', now = () => new Date(), onError = () => {} } = {}) {
  async function route(request) {
    const url = new URL(request.url);
    const path = url.pathname.slice(prefix.length);
    if (!url.pathname.startsWith(prefix + '/')) throw missing();

    // Capability IDs travel in request bodies rather than provider access-log URLs.
    if (request.method === 'POST' && ['/timelines/read', '/timelines/update'].includes(path)) {
      const body = await readBody(request);
      if (!uuidPattern.test(body.id)) throw missing();
      const read = path === '/timelines/read';
      const destination = new URL(prefix + '/timelines/' + body.id, url.origin);
      return route(new Request(destination, {
        method: read ? 'GET' : 'PUT',
        headers: read ? undefined : { 'Content-Type': 'application/json' },
        body: read ? undefined : JSON.stringify({ timeline: body.timeline, revision: body.revision, publish: body.publish })
      }));
    }

    if (path === '/gallery' && request.method === 'GET') {
      const rows = await store.gallery(galleryQuery(url.searchParams));
      const items = rows.slice(0, pageSize).map(row => ({ publicId: row.public_id, ...publicGeometry(row) }));
      const body = { items };
      if (rows.length > pageSize) body.nextCursor = items.at(-1).publicId;
      return json(body);
    }

    if (path === '/timelines' && request.method === 'POST') {
      const { timeline, publish } = await readBody(request);
      if (typeof publish !== 'boolean') throw invalid();
      const data = normalizeTimeline(timeline, now());
      const [editId, viewId, publicId] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
      if (new Set([editId, viewId, publicId]).size !== 3) throw new Error('Identifier collision.');
      const record = {
        ...data,
        edit_hash: await hashEditId(editId), view_id: viewId, public_id: publicId,
        revision: 1, published: publish, created_at: now().toISOString()
      };
      await store.insert(record);
      return json(saveResponse(record, editId), 201);
    }

    const match = /^\/timelines\/([^/]+)$/.exec(path);
    if (!match || !uuidPattern.test(match[1]) || !['GET', 'PUT'].includes(request.method)) throw missing();
    const id = match[1];
    const editHash = await hashEditId(id);
    const edit = await store.findEdit(editHash);
    if (request.method === 'PUT') {
      if (!edit) throw missing();
      const { timeline, revision, publish } = await readBody(request);
      if (!integerIn(revision, 1, 2147483646) || (publish !== undefined && typeof publish !== 'boolean')) throw invalid();
      if (revision !== edit.revision) throw conflict();
      const data = normalizeTimeline(timeline, now());
      const record = {
        ...edit, ...data,
        revision: revision + 1, published: publish ?? edit.published
      };
      if (!(await store.update(editHash, revision, record))) throw conflict();
      return json(saveResponse(record, id));
    }

    if (edit) {
      return json({
        mode: 'edit', timeline: edit.timeline, age: edit.age, duration: edit.duration ?? edit.timeline.duration ?? edit.age, revision: edit.revision, published: edit.published,
        links: { editId: id, viewId: edit.view_id, publicId: edit.public_id }
      });
    }
    const view = await store.findView(id);
    if (view) return json({ mode: 'view', timeline: view.timeline, age: view.age, duration: view.timeline.duration ?? view.age, createdAt: view.created_at ?? null });
    const publicRecord = await store.findPublic(id);
    if (publicRecord) return json({ mode: 'public', ...publicGeometry(publicRecord) });
    throw missing();
  }

  return async request => {
    try {
      return await route(request);
    } catch (error) {
      if (error instanceof RequestError) return json({ error: error.message }, error.status);
      onError();
      return json({ error: 'Sharing is temporarily unavailable.' }, 500);
    }
  };
}
