import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { build } from '../scripts/build.mjs';
test('Pages artifact contains only public assets and retains deep-link routing', async () => {
  await build();
  const dist = new URL('../dist/', import.meta.url);
  const files = await readdir(dist);
  assert.deepEqual(files.sort(), ['.nojekyll', '404.html', 'CNAME', 'api.js', 'config.js', 'creator.html', 'favicon.svg', 'gallery.html', 'index.html', 'site.css', 'social-export.js', 'timeline-plot.js', 'timeline.html'].sort());
  assert.equal((await readFile(new URL('CNAME', dist), 'utf8')).trim(), 'closenesslines.com');
  assert.match(await readFile(new URL('404.html', dist), 'utf8'), /timeline/);
  assert.match(await readFile(new URL('config.js', dist), 'utf8'), /jxnklhhjaumswbkmeqej\.supabase\.co/);
});
