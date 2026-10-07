// Actual frozen archive integration plus explicitly synthetic in-memory tampering.
// Modified test copies are never written or counted as user/adoption evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildWorldHistoryMetrics, loadWorldHistoryEvidence } from './reproduce-world-metrics.mjs';

const archive = await loadWorldHistoryEvidence();
const copy = () => structuredClone(archive);

test('frozen finalized archive reproduces adoption and mature internal renewal cohorts', () => {
  const result = buildWorldHistoryMetrics(archive);
  assert.equal(result.historicalCoverage.status, 'verified_archive_scope');
  assert.equal(result.asOfUtc, '2026-10-07T11:28:22.564Z');
  assert.equal(result.finalizedAccountSlot, 454209595);
  assert.equal(result.historicalCoverage.coverage.fromUtc, '2026-08-18T00:01:52.000Z');
  assert.equal(result.adoption.eligibleWalletCount, 1);
  assert.equal(result.adoption.excludedEligibleWalletCount, 1);
  assert.equal(result.adoption.eligibleWalletCountExcludingDeclaredWallets, 0);
  assert.equal(result.adoption.activeLockAccounts, 13);
  assert.equal(result.adoption.existingLockAccounts, 19);
  for (const renewal of [result.renewal7Days, result.renewal30Days]) {
    assert.deepEqual(renewal.historicalRenewalRetention.allWallets, { numerator: 1, denominator: 1, percentage: 100, status: 'available' });
    assert.deepEqual(renewal.historicalRenewalRetention.excludingDeclaredWallets, { numerator: 0, denominator: 0, percentage: null, status: 'not_applicable' });
    assert.equal(renewal.cohorts[0].excluded, true);
    assert.equal(renewal.cohorts[0].windowMatured, true);
    assert.equal(renewal.cohorts[0].firstObservedAccessLossAt, '2026-08-19T08:26:00.000Z');
  }
  assert.equal(result.renewal7Days.observed.matchedAccessEpisodes, 1);
  assert.equal(result.renewal30Days.observed.matchedAccessEpisodes, 2);
});

test('claim cycles and reused PDAs reconcile incarnations without inflating wallet adoption', () => {
  const result = buildWorldHistoryMetrics(archive);
  assert.equal(result.provenance.successfulCreateIncarnations, 146);
  assert.equal(result.provenance.successfulClaimCycles, 7);
  assert.equal(result.provenance.reusedPhysicalAccountAddresses.length, 6);
  assert.equal(result.provenance.reconstructedOpenAccounts, 139);
  assert.equal(result.provenance.currentAccountRecords, 139);
  assert.equal(result.provenance.acceptedMintCreates, 19);
  assert.equal(result.provenance.acceptedMintClaims, 0);
  assert.equal(result.provenance.exactAcceptedMintTimestampRecords, 19);
  assert.deepEqual(result.provenance.reconciliationProblems, []);
});

test('historical closed-account result improves coverage without changing old snapshot result', async () => {
  const oldText = await readFile(new URL('../measurement/game-metrics.json', import.meta.url), 'utf8');
  assert.equal(createHash('sha256').update(oldText).digest('hex'), 'ec323e2cb3335a7d4aa731120ca811a8cdbe1e89ace6b71625052d6c5be57316');
  const old = JSON.parse(oldText);
  const result = buildWorldHistoryMetrics(archive);
  assert.equal(result.historicalCoverage.earlierFrozenResultChanged, false);
  assert.notEqual(old.tokenCommitment.asOfUtc, result.asOfUtc);
  assert.equal(old.tokenCommitment.asOfUtc, '2026-10-07T08:58:15.000Z');
  assert.equal(old.renewal7Days.historicalRenewalRetention.allWallets.percentage, null);
  assert.equal(result.renewal7Days.historicalRenewalRetention.allWallets.percentage, 100);
});

test('frozen canonical history summary matches newly recomputed adoption and renewal results', async () => {
  const canonicalText = await readFile(new URL('./receipts/history-summary.json', import.meta.url), 'utf8');
  assert.equal(createHash('sha256').update(canonicalText).digest('hex'), 'a63ef062e1e50c9696af1bdf5ac4ccc9794f12f974cd4b9f7533d0b489cfd8ca');
  const canonical = JSON.parse(canonicalText);
  const result = buildWorldHistoryMetrics(archive);
  assert.equal(canonical.completeGameHistoryUnderCurrentPolicy, true);
  assert.equal(canonical.asOfUtc, result.asOfUtc);
  assert.equal(canonical.accountSnapshotSlot, result.finalizedAccountSlot);
  assert.deepEqual(canonical.currentAdoption, result.adoption);
  for (const days of [7, 30]) {
    const previous = canonical[`historicalRenewal${days}Days`], current = result[`renewal${days}Days`];
    assert.deepEqual(previous.historicalRenewalRetention, current.historicalRenewalRetention);
    assert.deepEqual(previous.observed, current.observed);
    assert.deepEqual(previous.cohorts, current.cohorts);
    assert.deepEqual(previous.accessLossEpisodes, current.accessLossEpisodes);
  }
});

test('synthetic receipt-body tampering fails integrity checks', () => {
  const modified = copy();
  modified.receipts[0].body += '\n';
  assert.throws(() => buildWorldHistoryMetrics(modified), /Receipt body SHA256 mismatch/);
});

test('synthetic public endpoint, method and duplicate receipt changes are rejected', () => {
  for (const mutation of [
    data => { data.receipts[0].metadata.url = 'https://example.test/api/rpc?key=secret'; },
    data => { data.receipts[0].metadata.request.method = 'sendTransaction'; },
    data => { data.receipts.push(structuredClone(data.receipts[0])); }
  ]) {
    const modified = copy(); mutation(modified);
    assert.throws(() => buildWorldHistoryMetrics(modified));
  }
});

test('synthetic policy relabeling cannot change threshold while retaining the current source pin', () => {
  const modified = copy();
  modified.policy.acceptedMints[0].minimumRaw = '1';
  assert.throws(() => buildWorldHistoryMetrics(modified), /Parsed policy differs/);
  const changedArtifact = copy();
  changedArtifact.policyText += '\n';
  assert.throws(() => buildWorldHistoryMetrics(changedArtifact), /Current policy artifact SHA256/);
});

test('synthetic decoded-history and finalized-account tampering disagree with primary receipts', () => {
  const historyCopy = copy();
  const create = historyCopy.history.events.find(event => event.type === 'create_lock');
  create.amount = String(BigInt(create.amount) + 1n);
  assert.throws(() => buildWorldHistoryMetrics(historyCopy), /Decoded history differs/);
  const snapshotCopy = copy();
  snapshotCopy.snapshot.locks[0].amount = String(BigInt(snapshotCopy.snapshot.locks[0].amount) + 1n);
  assert.throws(() => buildWorldHistoryMetrics(snapshotCopy));
});

test('synthetic missing final pagination declaration makes full historical rates unavailable', () => {
  const modified = copy(); modified.signatures.terminalEmptyPage = false;
  const result = buildWorldHistoryMetrics(modified);
  assert.equal(result.historicalCoverage.status, 'unavailable');
  assert.equal(result.historicalCoverage.coverage, null);
  for (const renewal of [result.renewal7Days, result.renewal30Days]) {
    assert.equal(renewal.historicalRenewalRetention.allWallets.percentage, null);
    assert.equal(renewal.historicalRenewalRetention.allWallets.status, 'unavailable');
  }
});

test('synthetic missing indexed transaction makes full historical rates unavailable', () => {
  const modified = copy();
  modified.manifest.transactions[0].available = false;
  modified.manifest.available -= 1;
  const result = buildWorldHistoryMetrics(modified);
  assert.equal(result.provenance.missingTransactions, 1);
  assert.equal(result.historicalCoverage.status, 'unavailable');
  assert.equal(result.renewal7Days.historicalRenewalRetention.allWallets.percentage, null);
  assert.equal(result.renewal30Days.historicalRenewalRetention.allWallets.percentage, null);
});
