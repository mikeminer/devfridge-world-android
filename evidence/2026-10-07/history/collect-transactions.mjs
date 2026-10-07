// Read-only expansion of the preserved program signature list. Node20+.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const ENDPOINTS = ['https://scan.devfridge.cool/api/rpc', 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];

export async function collectHistoricalTransactions(directory = fileURLToPath(new URL('./receipts/', import.meta.url))) {
  const out = resolve(directory);
  await mkdir(out, { recursive: true });
  const discovery = JSON.parse(await readFile(join(out, 'program-signatures.json'), 'utf8'));
  let sequence = (await readdir(out)).reduce((max, name) => Math.max(max, Number(name.match(/^(\d+)-/)?.[1] ?? 0)), 0);
  const beganAt = new Date().toISOString(), records = [];
  async function getTransaction(info) {
    for (const endpoint of ENDPOINTS) {
      const name = `${String(++sequence).padStart(4, '0')}-transaction-${info.signature.slice(0, 12)}`;
      const request = { jsonrpc: '2.0', id: sequence, method: 'getTransaction', params: [info.signature, { encoding: 'json', commitment: 'finalized', maxSupportedTransactionVersion: 0 }] };
      const startedAt = new Date().toISOString();
      let status = null, body = '', headers = {}, error = null;
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(25000) });
        status = response.status; headers = Object.fromEntries(response.headers.entries()); body = await response.text();
      } catch (e) { error = String(e); }
      const receipt = { name, url: endpoint, method: 'POST', request, startedAt, finishedAt: new Date().toISOString(), status, headers, error, bodyFile: `${name}.body.txt`, bodySha256: createHash('sha256').update(body).digest('hex') };
      await writeFile(join(out, receipt.bodyFile), body, { flag: 'wx' });
      await writeFile(join(out, `${name}.receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
      let json;
      try { json = JSON.parse(body); } catch {}
      if (status === 200 && json?.result && !json.error) return { signature: info.signature, receipt: name, slot: json.result.slot, available: true };
    }
    return { signature: info.signature, slot: info.slot, available: false };
  }
  for (let index = 0; index < discovery.signatures.length; index += 4) {
    const batch = await Promise.all(discovery.signatures.slice(index, index + 4).map(getTransaction));
    records.push(...batch);
    if ((index + 4) % 40 === 0) process.stdout.write(`Captured ${records.length}/${discovery.signatures.length} transaction receipts\n`);
  }
  const manifest = { schemaVersion: 1, beganAt, completedAt: new Date().toISOString(), programId: discovery.programId, pinnedSlot: discovery.pinnedSlot, requested: discovery.signatures.length, available: records.filter(record => record.available).length, unavailable: records.filter(record => !record.available), transactions: records };
  await writeFile(join(out, 'transactions-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ requested: manifest.requested, available: manifest.available, unavailable: manifest.unavailable.length, completedAt: manifest.completedAt })}\n`);
  return manifest;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  collectHistoricalTransactions(process.argv[2]).catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
