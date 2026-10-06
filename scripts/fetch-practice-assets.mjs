import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
export async function fetchPracticeAssets() {
  const manifest = JSON.parse(await readFile(resolve(root, 'android/practice-source.json'), 'utf8'));
  if (manifest.repository !== 'mikeminer/devfridge' || !/^[a-f0-9]{40}$/.test(manifest.commit) || manifest.basePath !== 'scan/public/demo-player') throw Error('Unexpected practice source');
  const destination = resolve(root, 'android/tools/practice-source');
  for (const file of manifest.files) {
    if (!file.path || file.path.startsWith('/') || file.path.split('/').some(part => part === '..') || file.path.includes('\\') || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('Unsafe practice manifest path');
    const output = resolve(destination, file.path);
    let bytes;
    try { bytes = await readFile(output); } catch {}
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
      const url = `https://raw.githubusercontent.com/${manifest.repository}/${manifest.commit}/${manifest.basePath}/${file.path}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error(`${file.path}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw Error(`Practice provenance mismatch: ${file.path}`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, bytes);
  }
  return { manifest, destination };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { manifest } = await fetchPracticeAssets();
  console.log(`Verified ${manifest.files.length} pinned practice assets at ${manifest.commit}.`);
}
