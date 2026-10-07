// Offline archive-to-metrics wrapper. Frozen source receipts and earlier outputs stay intact.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROGRAM } from './collect-history.mjs';
import { decodeBase58, decodeHistoricalFridge } from './decode-history.mjs';
import { reconcileFridgeHistory } from './reconcile-history.mjs';
import { perGameLockMetrics, timelockRenewalMetrics } from '../measurement/metrics.mjs';

const PUBLIC_ENDPOINTS = new Set(['https://scan.devfridge.cool/api/rpc', 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com']);
const READ_METHODS = new Set(['getGenesisHash', 'getSlot', 'getSignaturesForAddress', 'getTransaction', 'getProgramAccounts']);
const GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const POLICY_SHA256 = '21ab3cf0f7da3e078c4690d39daae28e2cdcccc6afda00158df8f061a345cb64';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const objectSort = list => [...list].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

export async function loadWorldHistoryEvidence(directory = fileURLToPath(new URL('./receipts/', import.meta.url))) {
  const out = resolve(directory), json = async name => JSON.parse(await readFile(join(out, name), 'utf8'));
  const [history, snapshot, signatures, manifest, discovery, policyText] = await Promise.all([
    ...['decoded-history.json', 'fresh-decoded-locks.json', 'program-signatures.json', 'transactions-manifest.json', 'discovery-summary.json'].map(json),
    readFile(new URL('../measurement/game-policy.json', import.meta.url), 'utf8')
  ]);
  const receipts = [];
  for (const name of (await readdir(out)).filter(name => name.endsWith('.receipt.json')).sort()) {
    const metadata = await json(name);
    assert.match(metadata.name, /^\d{4}-[A-Za-z0-9-]+$/);
    assert.equal(metadata.bodyFile, `${metadata.name}.body.txt`);
    receipts.push({ metadata, body: await readFile(join(out, metadata.bodyFile), 'utf8') });
  }
  return { history, snapshot, signatures, manifest, discovery, policy: JSON.parse(policyText), policyText, policySha256: sha256(policyText), receipts };
}

/** Revalidate archived receipts, then call the actual existing measurement exports. */
export function buildWorldHistoryMetrics(evidence) {
  const { history, snapshot, signatures, manifest, discovery, policy } = evidence;
  assert.equal(sha256(evidence.policyText), POLICY_SHA256, 'Current policy artifact SHA256 differs from its frozen pin');
  assert.equal(evidence.policySha256, POLICY_SHA256);
  assert.deepEqual(policy, JSON.parse(evidence.policyText), 'Parsed policy differs from its pinned source artifact');
  assert.equal(policy.programId, PROGRAM);
  assert.equal(history.programId, PROGRAM);
  assert.equal(signatures.programId, PROGRAM);
  assert.equal(discovery.genesisHash, GENESIS);
  const parsed = new Map();
  for (const { metadata, body } of evidence.receipts) {
    assert.equal(PUBLIC_ENDPOINTS.has(metadata.url), true, 'Only declared public endpoint receipts are accepted');
    assert.equal(READ_METHODS.has(metadata.request?.method), true, 'Only read-only methods are accepted');
    assert.equal(metadata.status, 200, 'Receipt HTTP status must be 200');
    assert.equal(metadata.error, null);
    assert.equal(sha256(body), metadata.bodySha256, 'Receipt body SHA256 mismatch');
    assert.equal(parsed.has(metadata.name), false, 'Duplicate receipt name');
    const response = JSON.parse(body);
    assert.equal(response.id, metadata.request.id);
    assert.equal(response.error, undefined);
    parsed.set(metadata.name, { metadata, response });
  }
  const receipt = (name, method) => {
    const item = parsed.get(name);
    assert.ok(item, `Missing receipt ${name}`);
    assert.equal(item.metadata.request.method, method);
    return item;
  };
  const genesis = receipt(discovery.receipts.find(name => name.endsWith('-genesis')), 'getGenesisHash');
  assert.equal(genesis.response.result, GENESIS);
  const slots = receipt(discovery.receipts.find(name => name.endsWith('-pinned-finalized-slot')), 'getSlot');
  assert.equal(slots.response.result, signatures.pinnedSlot);
  let before, terminalEmptyPage = false;
  const rawSignatures = [];
  for (const page of signatures.pages) {
    const item = receipt(page.receipt, 'getSignaturesForAddress');
    assert.equal(item.metadata.request.params[0], PROGRAM);
    assert.equal(item.metadata.request.params[1].commitment, 'finalized');
    assert.equal(item.metadata.request.params[1].before, before);
    const rows = item.response.result;
    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, page.count);
    if (rows.length === 0) { terminalEmptyPage = true; break; }
    rawSignatures.push(...rows); before = rows.at(-1).signature;
  }
  const inScope = rawSignatures.filter(info => info.slot <= signatures.pinnedSlot);
  assert.equal(new Set(inScope.map(info => info.signature)).size, inScope.length, 'Duplicate indexed signature');
  assert.deepEqual(inScope, signatures.signatures, 'Raw signature pagination differs from decoded index');
  const decoded = [], decodedUnknown = [], decodedLoader = [], failed = [];
  let unavailable = 0;
  assert.equal(manifest.transactions.length, signatures.signatures.length);
  assert.equal(new Set(manifest.transactions.map(item => item.signature)).size, manifest.transactions.length);
  for (const record of manifest.transactions) {
    if (!record.available) { unavailable++; continue; }
    const item = receipt(record.receipt, 'getTransaction'), info = inScope.find(row => row.signature === record.signature);
    assert.ok(info);
    assert.equal(item.metadata.request.params[0], record.signature);
    assert.equal(item.metadata.request.params[1].commitment, 'finalized');
    assert.equal(item.response.result.slot, info.slot);
    assert.deepEqual(item.response.result.meta.err, info.err);
    const tx = decodeHistoricalFridge(item.response.result, record.signature, record.receipt);
    if (tx.failed) failed.push(record.signature);
    decoded.push(...tx.events); decodedUnknown.push(...tx.unknown); decodedLoader.push(...tx.loader);
  }
  assert.equal(manifest.available, manifest.transactions.length - unavailable);
  // Incomplete transaction retrieval must yield unavailable rates rather than an
  // apparently full rate from the remaining subset. Complete data must agree exactly.
  if (unavailable === 0) {
    assert.deepEqual(objectSort(decoded), objectSort(history.events), 'Decoded history differs from raw transactions');
    assert.deepEqual(objectSort(decodedUnknown), objectSort(history.unknownInstructions));
    assert.deepEqual(objectSort(decodedLoader), objectSort(history.loaderEvents));
    assert.deepEqual([...failed].sort(), history.failedTransactions.map(item => item.signature).sort());
  }
  const accountReceipt = receipt(snapshot.accountReceipt, 'getProgramAccounts');
  assert.equal(accountReceipt.metadata.request.params[0], PROGRAM);
  assert.equal(accountReceipt.metadata.request.params[1].commitment, 'finalized');
  assert.equal(accountReceipt.metadata.request.params[1].encoding, 'base64');
  assert.equal(accountReceipt.metadata.request.params[1].withContext, true);
  assert.deepEqual(accountReceipt.metadata.request.params[1].filters, [{ dataSize: 105 }]);
  const accounts = accountReceipt.response.result;
  assert.equal(accounts.context.slot, snapshot.slot);
  assert.equal(accounts.value.length, snapshot.locks.length);
  assert.equal(accountReceipt.metadata.finishedAt, snapshot.asOfUtc);
  assert.equal(new Set(snapshot.locks.map(lock => lock.address)).size, snapshot.locks.length);
  for (const row of accounts.value) {
    assert.equal(row.account.owner, PROGRAM);
    const bytes = Buffer.from(row.account.data[0], 'base64'), lock = snapshot.locks.find(record => record.address === row.pubkey);
    assert.ok(lock);
    assert.equal(bytes.length, 105);
    assert.deepEqual([...bytes.subarray(0, 8)], [8,255,36,202,210,22,57,137]);
    assert.equal(decodeBase58(lock.depositor).equals(bytes.subarray(8, 40)), true);
    assert.equal(decodeBase58(lock.mint).equals(bytes.subarray(40, 72)), true);
    assert.equal(bytes.readBigUInt64LE(72).toString(), lock.amount);
    assert.equal(Number(bytes.readBigInt64LE(80)), lock.createdAt);
    assert.equal(Number(bytes.readBigInt64LE(88)), lock.unlockAt);
    assert.equal(bytes.readBigUInt64LE(97).toString(), lock.lockId);
  }
  const gap = receipt(snapshot.gapReceipt, 'getSignaturesForAddress');
  assert.equal(gap.metadata.request.params[0], PROGRAM);
  assert.equal(gap.metadata.request.params[1].commitment, 'finalized');
  assert.equal(gap.metadata.request.params[1].until, signatures.signatures[0].signature);
  assert.equal(gap.metadata.request.params[1].minContextSlot, snapshot.slot);
  assert.deepEqual(gap.response.result, snapshot.gapSignatures);
  const reconciliation = reconcileFridgeHistory(history, snapshot, policy);
  const complete = reconciliation.canEstablishCompleteGameHistory && terminalEmptyPage && signatures.terminalEmptyPage && unavailable === 0;
  const coverage = complete ? {
    gameId: policy.gameId, complete: true, includesClosedAccounts: true, initialStateKnown: true,
    fromUtc: new Date(reconciliation.deployment.blockTime * 1000).toISOString(), throughUtc: snapshot.asOfUtc,
    sourceEvidence: `${parsed.size} archived RPC receipts revalidated by reproduce-world-metrics.mjs; initial zero-state deployment, exhaustive pagination, every indexed transaction, closed claim cycles and exact finalized game-account reconciliation.`
  } : null;
  const gameSnapshot = { ...snapshot, locks: reconciliation.gameLocks };
  return {
    schemaVersion: 1, chain: policy.chain, programId: PROGRAM, gameId: policy.gameId, policyId: policy.policyId,
    asOfUtc: snapshot.asOfUtc, finalizedAccountSlot: snapshot.slot, historyDiscoverySlot: signatures.pinnedSlot,
    inputArchive: './receipts/', calculator: '../measurement/metrics.mjs', policy: '../measurement/game-policy.json', policySha256: evidence.policySha256,
    historicalCoverage: { status: complete ? 'verified_archive_scope' : 'unavailable', coverage, resolvedScope: 'Accepted World mints under the current pinned policy, applied retrospectively', priorSnapshotOnlyResult: '../measurement/game-metrics.json', earlierFrozenResultChanged: false },
    provenance: { receiptCount: parsed.size, indexedTransactions: signatures.signatures.length, retrievedTransactions: manifest.available, missingTransactions: unavailable, failedTransactions: failed.length, terminalEmptyPage, initialZeroStateVerified: reconciliation.initialZeroStateVerified, successfulCreateIncarnations: reconciliation.successfulCreates, successfulClaimCycles: reconciliation.successfulClaims, reusedPhysicalAccountAddresses: reconciliation.reusedAccountAddresses, reconstructedOpenAccounts: reconciliation.currentOpenAccounts, currentAccountRecords: snapshot.locks.length, acceptedMintCreates: reconciliation.gameCreates, acceptedMintClaims: reconciliation.gameClaims, exactAcceptedMintTimestampRecords: reconciliation.gameExactTimestampRecords, newSignatureGapCount: snapshot.gapSignatures.length, reconciliationProblems: reconciliation.problems },
    adoption: perGameLockMetrics(snapshot, policy),
    renewal7Days: timelockRenewalMetrics(gameSnapshot, policy, { renewalWindowDays: 7, coverage }),
    renewal30Days: timelockRenewalMetrics(gameSnapshot, policy, { renewalWindowDays: 30, coverage }),
    interpretation: ['Current qualifying-wallet adoption is independent of played rounds.', 'The renewing cohort in this dated archive is one declared treasury wallet. Its 1/1 rate is internal n=1; excluding it leaves an empty external cohort and N/A, not 0%.', 'Full current-policy World coverage is established separately from the adoption helper’s generic snapshot-only unknown-history limitation.', 'This single-provider archive/state reconciliation does not establish historical game policy versions, independent people, program security, Android live gameplay or positive SKR execution.']
  };
}

async function main(args) {
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--out'), 'Usage: node reproduce-world-metrics.mjs [--out world-history-metrics.json]');
  const result = buildWorldHistoryMetrics(await loadWorldHistoryEvidence());
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args.length) { await writeFile(resolve(args[1]), json); console.log(`Wrote ${args[1]} from the verified frozen archive; no network requests.`); }
  else process.stdout.write(json);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
