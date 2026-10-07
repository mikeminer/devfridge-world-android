// Offline receipt integrity and history/state reconciliation. Does not audit program security.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { decodeHistoricalFridge } from './decode-history.mjs';
import { reconcileFridgeHistory } from './reconcile-history.mjs';
import { perGameLockMetrics, timelockRenewalMetrics } from '../measurement/metrics.mjs';
const out = resolve(process.argv[2] ?? fileURLToPath(new URL('./receipts/', import.meta.url)));
const read = async name => JSON.parse(await readFile(join(out, name), 'utf8'));
const allowedEndpoints = new Set(['https://scan.devfridge.cool/api/rpc', 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com']);
const allowedMethods = new Set(['getGenesisHash', 'getSlot', 'getSignaturesForAddress', 'getTransaction', 'getProgramAccounts']);
const receipts = (await readdir(out)).filter(name => name.endsWith('.receipt.json'));
for (const name of receipts) {
  const receipt = await read(name);
  assert.equal(allowedEndpoints.has(receipt.url), true);
  assert.equal(allowedMethods.has(receipt.request?.method), true);
  assert.equal(new URL(receipt.url).search, '');
  assert.equal(new URL(receipt.url).username, '');
  assert.equal(new URL(receipt.url).password, '');
  assert.equal(receipt.status, 200);
  assert.equal(receipt.error, null);
  assert.ok(Date.parse(receipt.startedAt) <= Date.parse(receipt.finishedAt));
  const body = await readFile(join(out, receipt.bodyFile));
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySha256);
  const json = JSON.parse(body.toString('utf8'));
  assert.equal(json.id, receipt.request.id);
  assert.equal(json.error, undefined);
}
const [signatures, manifest, history, snapshot, summary] = await Promise.all(['program-signatures.json', 'transactions-manifest.json', 'decoded-history.json', 'fresh-decoded-locks.json', 'history-summary.json'].map(read));
const policy = JSON.parse(await readFile(new URL('../measurement/game-policy.json', import.meta.url), 'utf8'));
assert.equal(signatures.terminalEmptyPage, true);
assert.equal(signatures.duplicateSignatures, 0);
assert.equal(manifest.available, signatures.signatures.length);
assert.equal(manifest.unavailable.length, 0);
assert.equal(new Set(signatures.signatures.map(item => item.signature)).size, signatures.signatures.length);
for (let index = 1; index < signatures.signatures.length; index++) assert.ok(signatures.signatures[index].slot <= signatures.signatures[index - 1].slot);
const decodedAgain = [];
for (const record of manifest.transactions) {
  const info = signatures.signatures.find(item => item.signature === record.signature);
  const transaction = (await read(`${record.receipt}.body.txt`)).result;
  assert.equal(transaction.slot, info.slot);
  assert.deepEqual(transaction.meta.err, info.err);
  const result = decodeHistoricalFridge(transaction, record.signature, record.receipt);
  assert.equal(result.unknown.length, 0);
  decodedAgain.push(...result.events);
}
const byEventId = new Map(history.events.map(event => [event.eventId, event]));
assert.equal(byEventId.size, history.events.length);
assert.equal(decodedAgain.length, history.events.length);
for (const event of decodedAgain) assert.deepEqual(event, byEventId.get(event.eventId));
const reconciled = reconcileFridgeHistory(history, snapshot, policy);
assert.deepEqual(reconciled, summary.reconciliation);
assert.equal(reconciled.canEstablishCompleteGameHistory, true);
assert.equal(reconciled.successfulCreates - reconciled.successfulClaims, snapshot.locks.length);
assert.equal(reconciled.problems.length, 0);
assert.equal(reconciled.gameClaims, 0);
assert.equal(reconciled.gameCreates, reconciled.gameExactTimestampRecords);
assert.equal(summary.genesisHash, '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
assert.equal(summary.completeGameHistoryUnderCurrentPolicy, true);
assert.equal(snapshot.gapSignatures.length, 0);
const rawSnapshot = (await read(`${snapshot.accountReceipt}.body.txt`)).result;
assert.equal(rawSnapshot.context.slot, snapshot.slot);
assert.equal(rawSnapshot.value.length, snapshot.locks.length);
for (const row of rawSnapshot.value) {
  assert.equal(row.account.owner, summary.programId);
  const account = snapshot.locks.find(item => item.address === row.pubkey), bytes = Buffer.from(row.account.data[0], 'base64');
  assert.equal(bytes.length, 105);
  assert.equal(bytes.readBigUInt64LE(72).toString(), account.amount);
  assert.equal(Number(bytes.readBigInt64LE(80)), account.createdAt);
  assert.equal(Number(bytes.readBigInt64LE(88)), account.unlockAt);
}
assert.deepEqual(perGameLockMetrics(snapshot, policy), summary.currentAdoption);
for (const days of [7,30]) {
  const result = timelockRenewalMetrics({ ...snapshot, locks: reconciled.gameLocks }, policy, { renewalWindowDays: days, coverage: summary.coverage });
  assert.deepEqual(result, summary[`historicalRenewal${days}Days`]);
  assert.equal(result.historicalRenewalRetention.excludingDeclaredWallets.status, 'not_applicable');
  assert.equal(result.historicalRenewalRetention.excludingDeclaredWallets.percentage, null);
}
console.log(JSON.stringify({ verified: true, receiptCount: receipts.length, transactionCount: manifest.available, creates: reconciled.successfulCreates, claims: reconciled.successfulClaims, currentAccounts: snapshot.locks.length, acceptedMintCreates: reconciled.gameCreates, acceptedMintClaims: reconciled.gameClaims, slot: snapshot.slot, currentEligibleWallets: summary.currentAdoption.eligibleWalletCount, eligibleWalletsExcludingTreasury: summary.currentAdoption.eligibleWalletCountExcludingDeclaredWallets, internalRenewalCohort: summary.historicalRenewal7Days.historicalRenewalRetention.allWallets.denominator, externalRenewalCohort: summary.historicalRenewal7Days.historicalRenewalRetention.excludingDeclaredWallets.denominator }));
