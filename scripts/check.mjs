import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
async function check(directory) {
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await check(path); continue; }
    if (/\.(?:m?js)$/.test(path)) execFileSync(process.execPath, ['--check', resolve(root, path)], { stdio: 'pipe' });
    if (path.endsWith('.html')) {
      const html = await readFile(resolve(root, path), 'utf8');
      for (const [, script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) execFileSync(process.execPath, ['--check', '--input-type=commonjs'], { input: script, stdio: ['pipe', 'pipe', 'pipe'] });
    }
  }
}
for (const dir of ['public', 'server', 'scripts', 'tests', 'supabase/functions']) await check(dir);
console.log('JavaScript and inline scripts passed syntax checks.');
