import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const commit = '10ec57e6076c7f132757b76e3d9c4570733efc83';
const manifest = JSON.parse(await readFile(resolve(root, 'android/game-provenance.json'), 'utf8'));
const destination = resolve(root, 'scan/public/world/game-v2');
for (const file of manifest.files) {
  if (!file.path || file.path.startsWith('/') || file.path.split('/').some(part => part === '..') || file.path.includes('\\')) throw new Error('Unsafe manifest path');
  const output = resolve(destination, file.path);
  let bytes;
  try { bytes = await readFile(output); } catch {}
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
    const url = `https://raw.githubusercontent.com/mikeminer/devfridge/${commit}/scan/public/world/game-v2/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${file.path}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Provenance mismatch: ${file.path}`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  console.log(`Verified ${file.path}`);
}
console.log(`Restored ${manifest.files.length} pinned game files. Next: cd android && npm ci && npm run prepare:game`);
