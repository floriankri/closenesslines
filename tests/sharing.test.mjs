import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createDevServer } from '../server/dev-server.mjs';

const year = new Date().getUTCFullYear();
const privateName = 'Dave Private Example';
const privateSubtype = 'Eva Custom Subtype';
const track = (id, subtype, start = 0, category = 'family') => ({
  id, name: privateName, category, subtype, ending: 'ongoing', points: [[start, -0.5], [35, 0.7]]
});
const timeline = {
  version: 2, birthYear: year - 35, endMode: 'now', endYear: null, tagline: '',
  relationships: [
    track('original-relationship-id', 'Mum'),
    track('dad-original-id', 'Dad'),
    track('sibling-original-id', 'Sibling', 2),
    track('sibling-tie-id', 'Sibling', 2),
    track('youngest-original-id', 'Sibling', 5),
    track('friend-original-id', privateSubtype, 8, 'friends')
  ]
};
const normalizedTimeline = { ...timeline, birthMonth: null, duration: 35 };
const categoryColors = {
  family: '#4f6e85',
  friends: '#3e725f',
  romance: '#9c4c59',
  work: '#846629',
  pets: '#765f8d'
};

async function testServer(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'closeness-lines-test-'));
  let server;
  let baseUrl;
  async function restart() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    server = createDevServer({ dataDir, ...options });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  t.after(async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  });
  await restart();

  async function request(path, { method = 'GET', body, ...options } = {}) {
    const response = await fetch(baseUrl + path, {
      method,
      ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      ...options
    });
    const content = await response.text();
    return { response, content, json: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(content) : null };
  }

  async function save(input = timeline, publish = true) {
    const result = await request('/api/timelines', { method: 'POST', body: { timeline: input, publish } });
    assert.equal(result.response.status, 201, result.content);
    return result.json;
  }

  return { request, save, restart, dataDir };
}

test('distinct links expose only their intended data, with public preset types and no custom text', async t => {
  const { request, save, dataDir } = await testServer(t);
  const input = structuredClone(timeline);
  input.owner = privateName;
  input.relationships[0].label = privateSubtype;
  input.relationships[0].color = privateName;
  const saved = await save(input);
  const { editId, viewId, publicId } = saved;
  assert.equal(new Set([editId, viewId, publicId]).size, 3);

  const edit = await request('/api/timelines/' + editId);
  assert.deepEqual(edit.json, {
    mode: 'edit', timeline: normalizedTimeline, links: { editId, viewId, publicId }, revision: 1, published: true, age: 35, duration: 35
  });
  assert.equal(edit.response.headers.get('cache-control'), 'no-store');
  assert.equal(edit.response.headers.get('referrer-policy'), 'no-referrer');
  const view = await request('/api/timelines/' + viewId);
  assert.deepEqual(view.json, { mode: 'view', timeline: normalizedTimeline, age: 35, duration: 35, createdAt: saved.createdAt });
  for (const id of [editId, viewId, publicId]) assert.ok(!view.content.includes(id));

  const publicLink = await request('/api/timelines/' + publicId);
  assert.deepEqual(Object.keys(publicLink.json), ['mode', 'age', 'duration', 'createdAt', 'lines', 'events', 'tagline']);
  assert.equal(publicLink.json.mode, 'public');
  assert.equal(publicLink.json.age, 35);
  assert.deepEqual(publicLink.json.lines.map(line => line.type), [
    'Mum', 'Dad', 'Younger sibling', 'Younger sibling', 'Youngest sibling', 'Friend'
  ]);
  for (const [index, line] of publicLink.json.lines.entries()) {
    assert.deepEqual(Object.keys(line), ['color', 'type', 'ending', 'points']);
    assert.match(line.color, /^#[\da-f]{6}$/);
    assert.equal(line.ending, timeline.relationships[index].ending);
    assert.deepEqual(line.points, timeline.relationships[index].points);
  }
  assert.deepEqual(publicLink.json.lines.map(line => line.color), [
    categoryColors.family, categoryColors.family, categoryColors.family,
    categoryColors.family, categoryColors.family, categoryColors.friends
  ]);
  const gallery = await request('/api/gallery');
  assert.deepEqual(gallery.json, { items: [{ publicId, age: 35, duration: 35, createdAt: saved.createdAt, tagline: '', lines: publicLink.json.lines, events: [] }] });
  for (const result of [publicLink, gallery]) {
    for (const value of [privateName, privateSubtype, 'birthYear', 'original-relationship-id', 'viewId', viewId, 'editId', editId]) {
      assert.ok(!result.content.includes(value), 'Private field in public response: ' + value);
    }
  }

  const db = new DatabaseSync(join(dataDir, 'timelines.sqlite'), { readOnly: true });
  try {
    const row = db.prepare('SELECT edit_hash, lines FROM timelines').get();
    assert.equal(row.edit_hash, createHash('sha256').update(editId).digest('hex'));
    assert.equal(row.lines, JSON.stringify(publicLink.json.lines));
  } finally {
    db.close();
  }
});

test('public colors follow relationship categories rather than line position', async t => {
  const { request, save, dataDir } = await testServer(t);
  const input = structuredClone(timeline);
  input.relationships = [
    { ...input.relationships[5], id: 'romance-track', category: 'romance', subtype: 'Dating' },
    { ...input.relationships[0], id: 'family-track' },
    { ...input.relationships[1], id: 'work-track', category: 'work', subtype: 'Work friend' },
    { ...input.relationships[2], id: 'pet-track', category: 'pets', subtype: 'Dog' }
  ];
  const saved = await save(input);
  const expected = {
    Dating: categoryColors.romance,
    Mum: categoryColors.family,
    'Work friend': categoryColors.work,
    Dog: categoryColors.pets
  };
  const publicLink = await request('/api/timelines/' + saved.publicId);
  assert.deepEqual(Object.fromEntries(publicLink.json.lines.map(line => [line.type, line.color])), expected);

  // A legacy row may still contain the former position-based colors. Public
  // projections must normalize it so old shared links match new timelines.
  const db = new DatabaseSync(join(dataDir, 'timelines.sqlite'));
  try {
    const wrongColors = publicLink.json.lines.map(line => ({ ...line, color: '#000000' }));
    db.prepare('UPDATE timelines SET lines = ? WHERE public_id = ?').run(JSON.stringify(wrongColors), saved.publicId);
  } finally {
    db.close();
  }
  const corrected = await request('/api/timelines/' + saved.publicId);
  assert.deepEqual(Object.fromEntries(corrected.json.lines.map(line => [line.type, line.color])), expected);
  const gallery = await request('/api/gallery');
  const card = gallery.json.items.find(item => item.publicId === saved.publicId);
  assert.deepEqual(Object.fromEntries(card.lines.map(line => [line.type, line.color])), expected);
});

test('unpublished timelines stay out of public routes and gallery; only the edit link can change publication', async t => {
  const { request, save } = await testServer(t);
  const { editId, viewId, publicId, revision, createdAt } = await save(timeline, false);
  const get = id => request('/api/timelines/' + id);
  const put = (id, body) => request('/api/timelines/' + id, { method: 'PUT', body });
  assert.equal((await get(publicId)).response.status, 404);
  assert.deepEqual((await request('/api/gallery')).json, { items: [] });
  assert.equal((await get(viewId)).json.mode, 'view');
  for (const id of [viewId, publicId, randomUUID(), 'not-a-link']) {
    const result = await put(id, { timeline, revision, publish: true });
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.json, { error: 'Timeline not found.' });
  }

  const updated = await put(editId, { timeline, revision, publish: true });
  assert.deepEqual(updated.json, { editId, viewId, publicId, revision: 2, age: 35, duration: 35, published: true, createdAt });
  assert.equal((await get(publicId)).json.mode, 'public');
  const changed = structuredClone(timeline);
  changed.relationships[0].points[1][1] = -0.9;
  const saved = await put(editId, { timeline: changed, revision: 2 });
  assert.equal(saved.json.published, true);
  assert.equal((await get(publicId)).json.lines[0].points[1][1], -0.9);
  const removed = await put(editId, { timeline: changed, revision: 3, publish: false });
  assert.equal(removed.json.published, false);
  assert.equal((await get(publicId)).response.status, 404);
  assert.deepEqual((await request('/api/gallery')).json, { items: [] });
});

test('revisions are atomic and records persist independently across a restart', async t => {
  const { request, save, restart } = await testServer(t);
  const [first, second] = await Promise.all([save(timeline, false), save(timeline, false)]);
  const firstPath = '/api/timelines/' + first.editId;
  const submissions = ['First edit', 'Second edit'].map(name => {
    const changed = structuredClone(timeline);
    changed.relationships[0].name = name;
    return request(firstPath, { method: 'PUT', body: { timeline: changed, revision: first.revision } });
  });
  const updates = await Promise.all(submissions);
  assert.deepEqual(updates.map(update => update.response.status).sort(), [200, 409]);
  const winningName = updates[0].response.ok ? 'First edit' : 'Second edit';

  await restart();
  const savedFirst = await request(firstPath);
  assert.equal(savedFirst.json.revision, 2);
  assert.equal(savedFirst.json.timeline.relationships[0].name, winningName);
  const savedSecond = await request('/api/timelines/' + second.editId);
  assert.equal(savedSecond.json.revision, 1);
  assert.equal(savedSecond.json.timeline.relationships[0].name, privateName);
});

test('gallery uses a bounded cursor and filters on whole saved age, including death horizons', async t => {
  const { request, save } = await testServer(t);
  const saved = await Promise.all(Array.from({ length: 13 }, () => save()));
  const ended = structuredClone(timeline);
  ended.birthYear = year - 65;
  ended.endMode = 'death';
  ended.endYear = ended.birthYear + 39;
  const endedSave = await save(ended);
  assert.equal(endedSave.age, 39);
  const query = '/api/gallery?minAge=35&maxAge=35';
  const first = await request(query);
  assert.equal(first.json.items.length, 12);
  assert.ok(first.json.nextCursor);
  const second = await request(query + '&cursor=' + first.json.nextCursor);
  assert.equal(second.json.items.length, 1);
  assert.equal(second.json.nextCursor, undefined);
  const ids = [...first.json.items, ...second.json.items].map(item => item.publicId);
  assert.deepEqual(ids, saved.map(record => record.publicId).sort());
  const filtered = await request('/api/gallery?minAge=36');
  assert.deepEqual(filtered.json.items.map(item => item.publicId), [endedSave.publicId]);
  for (const filter of ['minAge=40&maxAge=30', 'minAge=2.5', 'maxAge=201', 'cursor=bad']) {
    assert.equal((await request('/api/gallery?' + filter)).response.status, 400);
  }
});

test('gallery excludes one-line drafts and ranks by lines, then points', async t => {
  const { request, save } = await testServer(t);
  const oneLine = structuredClone(timeline);
  oneLine.relationships = [oneLine.relationships[0]];
  const twoLinesFewPoints = structuredClone(timeline);
  twoLinesFewPoints.relationships = twoLinesFewPoints.relationships.slice(0, 2).map(track => ({
    ...track, points: [track.points[0], track.points.at(-1)]
  }));
  const threeLines = structuredClone(timeline);
  threeLines.relationships = threeLines.relationships.slice(0, 3);
  const fourLines = structuredClone(timeline);
  fourLines.relationships = fourLines.relationships.slice(0, 4);
  const draft = await save(oneLine);
  const few = await save(twoLinesFewPoints);
  const many = await save(threeLines);
  const most = await save(fourLines);
  const first = await request('/api/gallery');
  assert.deepEqual(first.json.items.map(item => item.publicId), [most.publicId, many.publicId, few.publicId]);
  assert.ok(!first.content.includes(draft.publicId));

  assert.equal(first.json.nextCursor, undefined);
});

test('taglines are public-safe, limited, and creation timestamps survive edits', async t => {
  const { request, save } = await testServer(t);
  const input = structuredClone(timeline);
  input.tagline = 'A quiet life.\nWith room to grow.';
  const saved = await save(input);
  assert.match(saved.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/);

  const named = await request('/api/timelines/' + saved.viewId);
  assert.equal(named.json.timeline.tagline, input.tagline);
  assert.equal(named.json.createdAt, saved.createdAt);
  assert.ok(named.content.includes(privateName));

  const publicView = await request('/api/timelines/' + saved.publicId);
  assert.equal(publicView.json.tagline, input.tagline);
  assert.equal(publicView.json.createdAt, saved.createdAt);
  assert.ok(!publicView.content.includes(privateName));

  const gallery = await request('/api/gallery');
  const galleryItem = gallery.json.items.find(item => item.publicId === saved.publicId);
  assert.equal(galleryItem.tagline, input.tagline);
  assert.equal(galleryItem.createdAt, saved.createdAt);
  assert.ok(!JSON.stringify(galleryItem).includes(privateName));

  const updated = structuredClone(input);
  updated.tagline = 'A changed caption.';
  const update = await request('/api/timelines/' + saved.editId, {
    method: 'PUT', body: { timeline: updated, revision: saved.revision }
  });
  assert.equal(update.response.status, 200, update.content);
  assert.equal(update.json.createdAt, saved.createdAt);
  const after = await request('/api/timelines/' + saved.publicId);
  assert.equal(after.json.tagline, updated.tagline);
  assert.equal(after.json.createdAt, saved.createdAt);

  for (const tagline of ['x'.repeat(181), 'one\ntwo\nthree']) {
    const invalidTagline = structuredClone(timeline);
    invalidTagline.tagline = tagline;
    const result = await request('/api/timelines', {
      method: 'POST', body: { timeline: invalidTagline, publish: true }
    });
    assert.equal(result.response.status, 400);
  }
});

test('birth month gives a precise current horizon without leaking it publicly', async t => {
  let date = new Date('2026-11-04T12:00:00Z');
  const { request, save } = await testServer(t, { now: () => date });
  const input = structuredClone(timeline);
  input.birthYear = 1991;
  input.birthMonth = 10;
  input.relationships = [input.relationships[0], input.relationships[1]].map(track => ({
    ...track, points: [[0, -.2], [34.9, .2]]
  }));
  const saved = await save(input);
  assert.equal(saved.age, 35);
  assert.equal(saved.duration, 35.083);
  const named = await request('/api/timelines/' + saved.viewId);
  assert.equal(named.json.duration, 35.083);
  assert.equal(named.json.timeline.birthMonth, 10);
  const publicView = await request('/api/timelines/' + saved.publicId);
  assert.equal(publicView.json.duration, 35.083);
  assert.ok(!publicView.content.includes('birthMonth'));

  const preBirthday = structuredClone(input);
  preBirthday.birthYear = 2025;
  preBirthday.birthMonth = 12;
  preBirthday.relationships = preBirthday.relationships.map(track => ({
    ...track, points: [[0, 0], [.5, .2]]
  }));
  const beforeBirthday = await save(preBirthday);
  assert.equal(beforeBirthday.age, 0);
  assert.equal(beforeBirthday.duration, 0.917);

  const currentYearBeforeBirthday = structuredClone(input);
  currentYearBeforeBirthday.birthYear = 2026;
  currentYearBeforeBirthday.birthMonth = 12;
  currentYearBeforeBirthday.relationships = currentYearBeforeBirthday.relationships.map(track => ({
    ...track, points: [[0, 0], [.5, .2]]
  }));
  const invalidBirth = await request('/api/timelines', { method: 'POST', body: { timeline: currentYearBeforeBirthday, publish: false } });
  assert.equal(invalidBirth.response.status, 400);

  date = new Date('2027-11-04T12:00:00Z');
  for (const id of [saved.viewId, saved.publicId]) {
    const snapshot = await request('/api/timelines/' + id);
    assert.equal(snapshot.json.age, 35);
    assert.equal(snapshot.json.duration, 35.083);
  }
  const gallery = await request('/api/gallery?minAge=35&maxAge=35');
  assert.equal(gallery.json.items.find(item => item.publicId === saved.publicId)?.age, 35);
});

test('gallery ranking remains ordered across the twelve-item page boundary', async t => {
  const { request, save } = await testServer(t);
  const records = [];
  for (let i = 0; i < 14; i++) {
    const lineCount = 2 + (i % 4);
    const pointCount = 2 + (i % 2);
    const input = structuredClone(timeline);
    input.relationships = input.relationships.slice(0, lineCount).map((track, index) => {
      const start = track.points[0][0];
      const middle = Math.min(34, Math.max(start + 1, 10 + index));
      const ages = pointCount === 2 ? [start, 35] : [start, middle, 35];
      return { ...track, points: ages.map((age, point) => [age, point === 0 ? -.5 : point === ages.length - 1 ? .7 : 0]) };
    });
    const saved = await save(input);
    records.push({ id: saved.publicId, lineCount, pointCount: lineCount * pointCount });
  }
  const expected = records
    .slice()
    .sort((a, b) => b.lineCount - a.lineCount || b.pointCount - a.pointCount || a.id.localeCompare(b.id))
    .map(record => record.id);
  const first = await request('/api/gallery');
  assert.equal(first.json.items.length, 12);
  assert.ok(first.json.nextCursor);
  const second = await request('/api/gallery?cursor=' + first.json.nextCursor);
  assert.equal(second.json.items.length, 2);
  assert.equal(second.json.nextCursor, undefined);
  assert.deepEqual([...first.json.items, ...second.json.items].map(item => item.publicId), expected);
});

test('invalid input and oversized bodies are rejected without echoing data', async t => {
  const { request } = await testServer(t);
  const badInputs = [
    { ...timeline, version: 1 },
    { ...timeline, birthYear: null },
    { ...timeline, endYear: year + 1 },
    { ...timeline, endMode: 'future' },
    { ...timeline, relationships: [] },
    { ...timeline, relationships: Array(101).fill(timeline.relationships[0]) },
    { ...timeline, relationships: [timeline.relationships[0], timeline.relationships[0]] },
    { ...timeline, relationships: [{ ...timeline.relationships[0], category: 'constructor' }] },
    { ...timeline, relationships: [{ ...timeline.relationships[0], name: privateName.repeat(10) }] },
    { ...timeline, relationships: [{ ...timeline.relationships[0], points: [[1, 0], [0, 1]] }] },
    { ...timeline, relationships: [{ ...timeline.relationships[0], points: [[1, 1.1]] }] },
    { ...timeline, relationships: [{ ...timeline.relationships[0], points: [[1.0001, 0.1]] }] },
    { ...timeline, relationships: [{ ...timeline.relationships[0], points: Array(501).fill([0, 0]) }] }
  ];
  for (const input of badInputs) {
    const result = await request('/api/timelines', { method: 'POST', body: { timeline: input, publish: true } });
    assert.equal(result.response.status, 400);
    assert.equal(result.json.error, 'Invalid timeline or request.');
  }
  const badPublish = await request('/api/timelines', { method: 'POST', body: { timeline, publish: 'true' } });
  assert.equal(badPublish.response.status, 400);
  const oversized = await request('/api/timelines', {
    method: 'POST', body: { timeline, publish: true, extra: 'a'.repeat(1024 * 1024) }
  });
  assert.equal(oversized.response.status, 413);
  assert.equal((await request('/api/timelines', { method: 'POST' })).response.status, 415);
  assert.deepEqual((await request('/api/gallery')).json, { items: [] });
});

test('local server serves the site and denies backend and data file routes', async t => {
  const { request } = await testServer(t);
  assert.equal((await request('/')).response.status, 200);
  const config = await request('/config.js');
  assert.match(config.content, /CLOSENESS_LINES_API_BASE = '\/api'/);
  assert.ok(!config.content.includes('supabase.co'));
  for (const path of ['/dev-server.mjs', '/server/dev-server.mjs', '/tests/sharing.test.mjs', '/supabase/schema.sql', '/package.json', '/.env', '/timelines.sqlite', '/t/not-a-link']) {
    assert.equal((await request(path)).response.status, 404);
  }
});

test('body-based capabilities preserve privacy and edit authorization', async t => {
  const { request, save } = await testServer(t);
  const saved = await save(timeline, false);
  const read = id => request('/api/timelines/read', { method: 'POST', body: { id } });
  assert.equal((await read(saved.editId)).json.mode, 'edit');
  assert.ok((await read(saved.viewId)).content.includes(privateName));
  assert.equal((await read(saved.publicId)).response.status, 404);
  const update = (id, revision) => request('/api/timelines/update', {
    method: 'POST', body: { id, timeline, revision, publish: true }
  });
  assert.equal((await update(saved.viewId, 1)).response.status, 404);
  assert.equal((await update(saved.editId, 1)).response.status, 200);
  assert.equal((await update(saved.editId, 1)).response.status, 409);
  const published = await read(saved.publicId);
  assert.ok(published.content.includes('Dad'));
  for (const value of [privateName, privateSubtype, saved.editId, saved.viewId]) {
    assert.ok(!published.content.includes(value));
  }
  assert.equal((await read('../bad')).response.status, 404);
});

test('life events preserve private labels but expose only safe public types', async t => {
  const { request, save } = await testServer(t);
  const events = [{ id: 'move-event', age: 12, type: 'Moved city', label: 'Moved to Lisbon' }];
  const eventTimeline = { ...timeline, events };
  const created = await save(eventTimeline, true);
  const named = await request(`/api/timelines/${created.viewId}`);
  assert.deepEqual(named.json.timeline.events, events);
  const publicLink = await request(`/api/timelines/${created.publicId}`);
  assert.deepEqual(publicLink.json.events, [{ age: 12, type: 'Moved city' }]);
  assert.equal(JSON.stringify(publicLink.json).includes('Moved to Lisbon'), false);
  const gallery = await request('/api/gallery');
  assert.deepEqual(gallery.json.items[0].events, [{age:12,type:'Moved city'}]);
  assert.equal(JSON.stringify(gallery.json).includes('Moved to Lisbon'), false);
  assert.equal(JSON.stringify(gallery.json).includes('move-event'), false);
});

test('invalid life events are rejected as bad requests', async t => {
  const { request } = await testServer(t);
  const cases = [
    { events: {} },
    { events: [{ id: 'same', age: 2, type: 'Moved city', label: '' }, { id: 'same', age: 3, type: 'New job', label: '' }] },
    { events: [{ id: 'future', age: 99, type: 'Moved city', label: '' }] },
    { events: [{ id: 'bad-type', age: 2, type: 'Vacation', label: '' }] }
  ];
  for (const extra of cases) {
    const result = await request('/api/timelines', { method: 'POST', body: { timeline: { ...timeline, ...extra }, publish: false } });
    assert.equal(result.response.status, 400, result.content);
  }
});
