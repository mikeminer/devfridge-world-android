// Public, read-only history discovery. Node20+, no packages, wallets or cookies.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const PROGRAM = '9RY54dNPYTzDyh3TfFqDdt2b2KMM56KW1tw9erRTGQo6';
const ENDPOINTS = ['https://scan.devfridge.cool/api/rpc', 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];
const READ_METHODS = new Set(['getGenesisHash', 'getSlot', 'getAccountInfo', 'getProgramAccounts', 'getSignaturesForAddress', 'getTransaction']);
const HERE = fileURLToPath(new URL('.', import.meta.url));

export async function collectFridgeHistory(outputDirectory = join(HERE, 'receipts')) {
  const out = resolve(outputDirectory);
  await mkdir(out, { recursive: true });
  let sequence = (await readdir(out)).reduce((max, name) => Math.max(max, Number(name.match(/^(\d+)-/)?.[1] ?? 0)), 0);
  const receipts = [], beganAt = new Date().toISOString();
  async function request(endpoint, method, params, label) {
    if (!READ_METHODS.has(method) || !ENDPOINTS.includes(endpoint)) throw Error('Only declared public read-only RPC calls are allowed');
    const name = `${String(++sequence).padStart(4, '0')}-${label}`;
    const payload = { jsonrpc: '2.0', id: sequence, method, params };
    const startedAt = new Date().toISOString();
    let body = '', status = null, headers = {}, error = null;
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000) });
      status = response.status; headers = Object.fromEntries(response.headers.entries()); body = await response.text();
    } catch (e) { error = String(e); }
    const record = { name, url: endpoint, method: 'POST', request: payload, startedAt, finishedAt: new Date().toISOString(), status, headers, error, bodyFile: `${name}.body.txt`, bodySha256: createHash('sha256').update(body).digest('hex') };
    await writeFile(join(out, record.bodyFile), body, { flag: 'wx' });
    await writeFile(join(out, `${name}.receipt.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    receipts.push(record);
    let json = null;
    try { json = JSON.parse(body); } catch {}
    return { ...record, json };
  }
  async function rpc(method, params, label) {
    for (const endpoint of ENDPOINTS) {
      const record = await request(endpoint, method, params, label);
      if (record.status === 200 && record.json && !record.json.error && 'result' in record.json) return record;
    }
    return null;
  }
  const genesis = await rpc('getGenesisHash', [], 'genesis');
  const slot = await rpc('getSlot', [{ commitment: 'finalized' }], 'pinned-finalized-slot');
  const signatures = [], pages = [];
  let before, terminalEmptyPage = false, signatureError = null;
  for (let page = 1; page <= 20; page++) {
    const record = await rpc('getSignaturesForAddress', [PROGRAM, { commitment: 'finalized', limit: 1000, ...(before ? { before } : {}) }], `program-signatures-page-${page}`);
    if (!record || !Array.isArray(record.json.result)) { signatureError = 'Provider did not return a signature page'; break; }
    const rows = record.json.result;
    pages.push({ page, receipt: record.name, count: rows.length, before: before ?? null, newestSlot: rows[0]?.slot ?? null, oldestSlot: rows.at(-1)?.slot ?? null });
    if (!rows.length) { terminalEmptyPage = true; break; }
    if (signatures.some(item => item.signature === rows.at(-1).signature)) { signatureError = 'Repeated pagination cursor'; break; }
    signatures.push(...rows);
    before = rows.at(-1).signature;
  }
  const duplicateSignatures = signatures.length - new Set(signatures.map(item => item.signature)).size;
  const uniqueSignatures = [...new Map(signatures.map(item => [item.signature, item])).values()];
  const pinnedSlot = slot?.json.result ?? null;
  const inScope = uniqueSignatures.filter(item => pinnedSlot === null || item.slot <= pinnedSlot);
  await writeFile(join(out, 'program-signatures.json'), `${JSON.stringify({ programId: PROGRAM, commitment: 'finalized', pinnedSlot, pages, terminalEmptyPage, duplicateSignatures, signatures: inScope }, null, 2)}\n`);
  const samples = [];
  for (const [label, signature] of [['newest', inScope[0]?.signature], ['oldest', inScope.at(-1)?.signature]]) {
    if (!signature) continue;
    const record = await rpc('getTransaction', [signature, { commitment: 'finalized', encoding: 'json', maxSupportedTransactionVersion: 0 }], `${label}-program-transaction`);
    samples.push({ label, signature, receipt: record?.name ?? null, available: Boolean(record?.json.result), slot: record?.json.result?.slot ?? null, blockTime: record?.json.result?.blockTime ?? null });
  }
  const summary = {
    schemaVersion: 1, beganAt, completedAt: new Date().toISOString(), readOnly: true, programId: PROGRAM,
    genesisHash: genesis?.json.result ?? null, pinnedFinalizedSlot: pinnedSlot,
    signatureDiscovery: { observedSignatures: inScope.length, terminalEmptyPage, pages, error: signatureError, earliestObserved: inScope.at(-1) ?? null, latestObserved: inScope[0] ?? null },
    transactionSamples: samples, closedHistoryCoverage: 'not_established',
    limits: ['An empty signature page proves only that the selected RPC provider returned no earlier address records. Deployment-origin coverage and every successful lock/claim transaction must also be verified before a complete historical renewal rate is claimed.', 'Failed transactions are not deposits. Program-address references can include loader or other non-lock instructions.', 'No full historical adoption or renewal rate is calculated by this discovery stage.'],
    receipts: receipts.map(item => item.name)
  };
  await writeFile(join(out, 'discovery-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: out, ...summary }, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  collectFridgeHistory(process.argv[2]).catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
