// Every fixture in this file is SYNTHETIC. No fixture is a real wallet/player record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { perGameLockMetrics, timelockRenewalMetrics } from './metrics.mjs';

const START = Date.parse('2026-01-01T00:00:00Z') / 1000;
const DAY = 86_400;
const policy = {
  gameId: 'synthetic-test-game', policyId: 'synthetic-current-policy', aggregation: 'sum-per-wallet-per-mint',
  minimumOriginalSeconds: 0, minimumRemainingSeconds: 0,
  acceptedMints: [
    { mint: 'synthetic-mint-a', decimals: 6, minimumRaw: '500000000000' },
    { mint: 'synthetic-mint-b', decimals: 6, minimumRaw: '500000000000' }
  ],
  excludedWallets: [{ wallet: 'synthetic-treasury', label: 'Synthetic excluded wallet' }]
};
const at = (days, seconds = 0) => START + days * DAY + seconds;
const stamp = seconds => new Date(seconds * 1000).toISOString();
function lock(address, { wallet = 'synthetic-wallet', mint = 'synthetic-mint-a', tokens = 500000, created = at(0), expires = at(60) } = {}) {
  return { address, depositor: wallet, mint, amount: (BigInt(tokens) * 1000000n).toString(), createdAt: created, unlockAt: expires };
}
function snapshot(locks, time = at(40)) { return { locks, asOfUtc: stamp(time), slot: 123 }; }
const metrics = locks => perGameLockMetrics(snapshot(locks), policy);
const renew = (locks, days = 7, time = at(40), coverage = null) => timelockRenewalMetrics(snapshot(locks, time), policy, { renewalWindowDays: days, coverage });
const completeCoverage = { gameId: policy.gameId, complete: true, includesClosedAccounts: true, initialStateKnown: true, fromUtc: stamp(at(0)), throughUtc: stamp(at(40)), sourceEvidence: 'SYNTHETIC complete history for testing only' };

test('split locks reach exact same-mint threshold using BigInt', () => {
  const result = metrics([lock('a', { tokens: 300000 }), lock('b', { tokens: 200000 })]);
  assert.equal(result.eligibleWalletCount, 1);
  assert.equal(result.perMint[0].activeAmountRaw, '500000000000');
});

test('no cross-mint bridge, even when raw totals would reach threshold', () => {
  assert.equal(metrics([lock('a', { tokens: 300000 }), lock('b', { mint: 'synthetic-mint-b', tokens: 200000 })]).eligibleWalletCount, 0);
});

test('unaccepted ecosystem mint is filtered before game account/ratio/amount counts', () => {
  const result = metrics([lock('a'), lock('unrelated', { mint: 'synthetic-other-mint', tokens: 1000000 })]);
  assert.equal(result.existingLockAccounts, 1);
  assert.equal(result.observedDepositorWallets, 1);
  assert.equal(result.ignoredUnacceptedRecords, 1);
  assert.equal(result.activeLockRatio.percentage, 100);
});

test('exact expiry boundary is expired, including fractional as-of time', () => {
  const records = [lock('a', { expires: at(40) }), lock('b', { expires: at(40, 1), tokens: 100000 })];
  const result = perGameLockMetrics(snapshot(records, at(40) + 0.5), policy);
  assert.equal(result.activeLockAccounts, 1);
  assert.equal(result.expiredUnclaimedLockAccounts, 1);
  assert.equal(result.eligibleWalletCount, 0);
  assert.equal(result.activeLockRatio.percentage, 50);
});

test('one wallet unlocking multiple characters is counted once', () => {
  const result = metrics([lock('a'), lock('b', { mint: 'synthetic-mint-b' })]);
  assert.equal(result.eligibleWalletCount, 1);
  assert.equal(result.eligibleWallets[0].acceptedMints.length, 2);
});

test('identical account duplicates are ignored; conflicts are rejected', () => {
  const a = lock('a');
  assert.equal(metrics([a, { ...a }]).existingLockAccounts, 1);
  assert.equal(metrics([a, { ...a }]).duplicateAcceptedRecords, 1);
  assert.throws(() => metrics([a, { ...a, amount: '1' }]), /Conflicting duplicate/);
  assert.throws(() => metrics([a, { ...a, mint: 'synthetic-mint-b' }]), /Conflicting duplicate/);
});

test('numeric amounts must be unsigned integer strings within U64; dates cannot be future', () => {
  for (const amount of [500000000000, '-1', '1.5', '1e12', '0', '18446744073709551616']) {
    assert.throws(() => metrics([{ ...lock('a'), amount }]), /amount|range/);
  }
  assert.throws(() => metrics([lock('a', { created: at(41), expires: at(60) })]), /after asOfUtc/);
  assert.throws(() => metrics([lock('a', { created: at(1), expires: at(1) })]), /after createdAt/);
});

test('duration filter is per lock before aggregation; current policy has no extra minimum', () => {
  const short = lock('short', { created: at(39, 86340), expires: at(40, 60) });
  assert.equal(perGameLockMetrics(snapshot([short]), policy).eligibleWalletCount, 1);
  const stricter = { ...policy, minimumOriginalSeconds: DAY };
  assert.equal(perGameLockMetrics(snapshot([short]), stricter).eligibleWalletCount, 0);
  assert.equal(perGameLockMetrics(snapshot([short]), stricter).activeLockAccounts, 1);
});

test('declared wallet exclusion preserves all totals and a visible excluded subtotal', () => {
  const result = metrics([lock('a', { wallet: 'synthetic-treasury' }), lock('b')]);
  assert.equal(result.eligibleWalletCount, 2);
  assert.equal(result.excludedEligibleWalletCount, 1);
  assert.equal(result.eligibleWalletCountExcludingDeclaredWallets, 1);
  assert.equal(result.perMint[0].excludedWalletActiveAmountRaw, '500000000000');
});

test('empty lock archive is N/A rather than a fabricated zero percent', () => {
  const result = metrics([]);
  assert.equal(result.activeLockRatio.percentage, null);
  assert.equal(result.activeLockRatio.status, 'not_applicable');
  assert.equal(result.historicalClosedAccountCoverage, 'unknown');
});

test('post-expiry same-mint redeposit causes a qualifying access renewal', () => {
  const result = renew([lock('old', { expires: at(1) }), lock('new', { created: at(2), expires: at(60) })]);
  assert.equal(result.observed.renewedWallets, 1);
  assert.equal(result.observed.oneToOneLockPairCount, 1);
  assert.deepEqual(result.oneToOneLockPairs.map(pair => [pair.expiredLock, pair.newLock]), [['old', 'new']]);
  assert.equal(result.historicalRenewalRetention.allWallets.status, 'unavailable');
  assert.equal(result.historicalRenewalRetention.allWallets.percentage, null);
});

test('a new active lock created before the old expiry is not a renewal', () => {
  const result = renew([lock('old', { expires: at(3) }), lock('overlap', { created: at(2), expires: at(60) })]);
  assert.equal(result.observed.walletsWithAccessLoss, 0);
  assert.equal(result.observed.matchedAccessEpisodes, 0);
});

test('cross-mint deposit and below-threshold same-mint deposit do not renew', () => {
  const result = renew([lock('old', { expires: at(1) }), lock('other', { mint: 'synthetic-mint-b', created: at(2) }), lock('small', { created: at(3), tokens: 100000 })]);
  assert.equal(result.observed.walletDenominator, 1);
  assert.equal(result.observed.renewedWallets, 0);
  assert.equal(result.observed.matchedAccessEpisodes, 0);
});

test('another wallet same-mint deposit cannot renew the expired wallet position', () => {
  const result = renew([lock('old', { expires: at(1) }), lock('other-wallet', { created: at(2), wallet: 'synthetic-other-wallet' })]);
  assert.equal(result.observed.walletDenominator, 1);
  assert.equal(result.observed.renewedWallets, 0);
});

test('specific mint commitment can expire and renew while other character access remains', () => {
  const records = [lock('old-a', { expires: at(1) }), lock('new-a', { created: at(2) }), lock('still-b', { mint: 'synthetic-mint-b' })];
  const result = renew(records);
  assert.equal(result.observed.renewedWallets, 1);
  assert.deepEqual(result.cohorts[0].acceptedMintsAtLoss, ['synthetic-mint-a']);
  const beforeNewDeposit = records.filter(record => record.createdAt <= at(1, 1));
  assert.equal(perGameLockMetrics(snapshot(beforeNewDeposit, at(1, 1)), policy).eligibleWalletCount, 1);
});

test('aggregated redeposits qualify only at the threshold-crossing deposit', () => {
  const result = renew([lock('old', { expires: at(1) }), lock('new-a', { created: at(2), tokens: 300000 }), lock('new-b', { created: at(3), tokens: 200000 })]);
  assert.equal(result.accessLossEpisodes[0].renewedAt, stamp(at(3)));
  assert.equal(result.accessLossEpisodes[0].beforeNewAmountRaw, '300000000000');
  assert.equal(result.accessLossEpisodes[0].afterNewAmountRaw, '500000000000');
  assert.equal(result.observed.renewedWallets, 1);
});

test('one new qualifying lock cannot inflate several expired accounts into several renewed locks', () => {
  const result = renew([lock('old-a', { expires: at(1), tokens: 300000 }), lock('old-b', { expires: at(1), tokens: 200000 }), lock('new', { created: at(2) })]);
  assert.equal(result.accessLossEpisodes[0].expiredLockIds.length, 2);
  assert.equal(result.observed.matchedAccessEpisodes, 1);
  assert.equal(result.observed.oneToOneLockPairCount, 1);
  assert.equal(result.observed.renewedWallets, 1);
});

test('wallet cohort stays fixed at first access loss across repeated renewal episodes', () => {
  const records = [lock('old', { expires: at(1) }), lock('middle', { created: at(2), expires: at(3) }), lock('last', { created: at(4) })];
  const result = renew(records);
  assert.equal(result.cohorts.length, 1);
  assert.equal(result.cohorts[0].firstObservedAccessLossAt, stamp(at(1)));
  assert.equal(result.observed.matchedAccessEpisodes, 2);
  assert.equal(result.observed.renewedWallets, 1);
  assert.equal(new Set(result.oneToOneLockPairs.map(pair => pair.newLock)).size, 2);
});

test('partial renewal window does not enter denominator, even if renewal already observed', () => {
  const records = [lock('old', { expires: at(1) }), lock('new', { created: at(2) })];
  const partial = renew(records, 7, at(7, 86399));
  assert.equal(partial.observed.matchedAccessEpisodes, 1);
  assert.equal(partial.observed.walletDenominator, 0);
  assert.equal(renew(records, 7, at(8)).observed.walletDenominator, 1);
});

test('renewal window inclusive boundary accepts exact deadline and rejects one second later', () => {
  const old = lock('old', { expires: at(1) });
  assert.equal(renew([old, lock('new', { created: at(8) })]).observed.renewedWallets, 1);
  assert.equal(renew([old, lock('new', { created: at(8, 1) })]).observed.renewedWallets, 0);
});

test('7 and30 day windows are explicit and produce different observed outcomes', () => {
  const records = [lock('old', { expires: at(1) }), lock('new', { created: at(20) })];
  assert.equal(renew(records, 7).observed.renewedWallets, 0);
  assert.equal(renew(records, 30).observed.renewedWallets, 1);
  assert.throws(() => timelockRenewalMetrics(snapshot(records), policy), /renewalWindowDays/);
});

test('unknown/closed-account/mismatched coverage cannot yield a historical retention rate', () => {
  const records = [lock('old', { expires: at(1) }), lock('new', { created: at(2) })];
  for (const coverage of [null, { ...completeCoverage, includesClosedAccounts: false }, { ...completeCoverage, gameId: 'different-game' }, { ...completeCoverage, initialStateKnown: false }]) {
    assert.equal(renew(records, 7, at(40), coverage).historicalRenewalRetention.allWallets.percentage, null);
  }
});

test('explicit complete synthetic coverage permits a historical rate with preserved exclusion', () => {
  const records = [lock('old', { expires: at(1), wallet: 'synthetic-treasury' }), lock('new', { created: at(2), wallet: 'synthetic-treasury' }), lock('other-old', { expires: at(1), wallet: 'synthetic-other-wallet' })];
  const result = renew(records, 7, at(40), completeCoverage);
  assert.equal(result.historicalRenewalRetention.allWallets.percentage, 50);
  assert.equal(result.historicalRenewalRetention.excludedWalletSubtotal.percentage, 100);
  assert.equal(result.historicalRenewalRetention.excludingDeclaredWallets.percentage, 0);
  assert.equal(result.observed.excludedWalletSubtotal.renewedWallets, 1);
});

test('empty complete history has N/A rate; empty unknown snapshot stays unavailable', () => {
  assert.equal(renew([], 7, at(40), completeCoverage).historicalRenewalRetention.allWallets.status, 'not_applicable');
  assert.equal(renew([], 7).historicalRenewalRetention.allWallets.status, 'unavailable');
});

test('coverage cannot claim a future observation period', () => {
  assert.throws(() => renew([], 7, at(40), { ...completeCoverage, throughUtc: stamp(at(41)) }), /cannot extend beyond/);
});

test('UTC timestamps reject impossible calendar dates,24-hour rollover and ambiguous zones', () => {
  for (const asOfUtc of ['2026-02-30T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T00:00:00+01:00']) {
    assert.throws(() => perGameLockMetrics({ locks: [], asOfUtc }, policy), /invalid|UTC/);
  }
});

test('expiration and creation at same second qualify as expiry-then-new-deposit renewal', () => {
  const result = renew([lock('old', { expires: at(1) }), lock('new', { created: at(1) })]);
  assert.equal(result.observed.renewedWallets, 1);
  assert.equal(result.accessLossEpisodes[0].expiredAt, result.accessLossEpisodes[0].renewedAt);
});
