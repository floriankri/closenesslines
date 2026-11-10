import { mkdir, rm, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
export const publicFiles = ['impressum.html', 'privacy.html', 'index.html', 'creator.html', 'gallery.html', 'timeline.html', '404.html', 'api.js', 'config.js', 'timeline-plot.js', 'social-export.js', 'site.css', 'favicon.svg', 'CNAME', '.nojekyll'];
export async function build() {
  const found = await readdir(resolve(root, 'public'));
  if (found.some(file => !publicFiles.includes(file)) || publicFiles.some(file => !found.includes(file))) throw new Error('Review the public asset allowlist before building.');
  await rm(resolve(root, 'dist'), { recursive: true, force: true });
  await mkdir(resolve(root, 'dist'));
  for (const file of publicFiles) await copyFile(resolve(root, 'public', file), resolve(root, 'dist', file));
  console.log(`Built ${publicFiles.length} public files into dist/.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
