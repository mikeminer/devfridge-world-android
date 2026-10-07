import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const DAY_SECONDS = 86_400;
const U64_MAX = (1n << 64n) - 1n;
const ACCOUNT_LIMIT = 'Existing-account snapshots omit claimed/closed locks. Counts and reconstructed renewals describe observed accounts; a complete historical renewal rate requires an archive including closed accounts.';

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function text(value, name) {
  assert(typeof value === 'string' && value.trim().length > 0, `${name} must be a nonempty string`);
  return value;
}

function integer(value, name, minimum = 0) {
  assert(Number.isSafeInteger(value) && value >= minimum, `${name} must be a safe integer >= ${minimum}`);
  return value;
}

function rawAmount(value, name, maximum = null) {
  assert(typeof value === 'string' && /^\d+$/.test(value), `${name} must be an unsigned decimal string`);
  const amount = BigInt(value);
  assert(maximum === null || amount <= maximum, `${name} exceeds the supported range`);
  return amount;
}

function utc(value, name) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value), `${name} must be an ISO UTC timestamp ending in Z`);
  const ms = Date.parse(value);
  assert(Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value.slice(0, 10), `${name} is invalid`);
  return { ms, seconds: ms / 1000, iso: new Date(ms).toISOString() };
}

function iso(seconds) { return new Date(seconds * 1000).toISOString(); }
function ratio(numerator, denominator) {
  return { numerator, denominator, percentage: denominator ? Number((100 * numerator / denominator).toFixed(8)) : null, status: denominator ? 'available' : 'not_applicable' };
}
function excludedSet(policy) {
  assert(Array.isArray(policy.excludedWallets ?? []), 'excludedWallets must be an array');
  return new Set((policy.excludedWallets ?? []).map(item => text(item.wallet, 'excluded wallet')));
}

function validatePolicy(policy) {
  assert(policy && typeof policy === 'object', 'policy is required');
  text(policy.gameId, 'policy.gameId');
  assert(policy.aggregation === 'sum-per-wallet-per-mint', 'Only sum-per-wallet-per-mint aggregation is supported');
  integer(policy.minimumOriginalSeconds ?? 0, 'minimumOriginalSeconds');
  assert((policy.minimumRemainingSeconds ?? 0) === 0, 'This utility supports the current zero additional remaining-duration rule only');
  assert(Array.isArray(policy.acceptedMints) && policy.acceptedMints.length > 0, 'acceptedMints must be nonempty');
  const mints = new Map();
  for (const token of policy.acceptedMints) {
    text(token.mint, 'mint');
    assert(!mints.has(token.mint), `Duplicate policy mint ${token.mint}`);
    integer(token.decimals, 'decimals');
    assert(token.decimals <= 255, 'decimals must be <=255');
    assert(rawAmount(token.minimumRaw, 'minimumRaw') > 0n, 'minimumRaw must be positive');
    mints.set(token.mint, token);
  }
  excludedSet(policy);
  return mints;
}

function normalize(snapshot, policy) {
  const mints = validatePolicy(policy), time = utc(snapshot?.asOfUtc, 'asOfUtc');
  assert(Array.isArray(snapshot.locks), 'snapshot.locks must be an array');
  if (snapshot.slot !== undefined && snapshot.slot !== null) integer(snapshot.slot, 'slot');
  const unique = new Map();
  let ignoredUnacceptedRecords = 0, duplicateAcceptedRecords = 0;
  for (const input of snapshot.locks) {
    // Scope before counts: unrelated ecosystem mints cannot inflate this game.
    if (!mints.has(input?.mint)) { ignoredUnacceptedRecords++; continue; }
    const lock = {
      address: text(input.address, 'lock.address'), depositor: text(input.depositor, 'lock.depositor'),
      mint: input.mint, amount: rawAmount(input.amount, 'lock.amount', U64_MAX).toString(),
      createdAt: integer(input.createdAt, 'createdAt'), unlockAt: integer(input.unlockAt, 'unlockAt')
    };
    assert(BigInt(lock.amount) > 0n, 'lock.amount must be positive');
    assert(lock.unlockAt > lock.createdAt, 'unlockAt must be after createdAt');
    assert(lock.createdAt <= time.seconds, 'A lock cannot be created after asOfUtc');
    assert(Number.isFinite(new Date(lock.unlockAt * 1000).getTime()), 'unlockAt is outside the supported date range');
    const existing = unique.get(lock.address);
    if (existing) {
      assert(JSON.stringify(existing) === JSON.stringify(lock), `Conflicting duplicate lock address ${lock.address}`);
      duplicateAcceptedRecords++;
    } else unique.set(lock.address, lock);
  }
  return { locks: [...unique.values()], mints, time, ignoredUnacceptedRecords, duplicateAcceptedRecords };
}

function qualifiesDuration(lock, policy) { return lock.unlockAt - lock.createdAt >= (policy.minimumOriginalSeconds ?? 0); }

/** Read only decoded evidence. This does not verify raw account owners or signatures. */
export function perGameLockMetrics(snapshot, policy) {
  const { locks, mints, time, ignoredUnacceptedRecords, duplicateAcceptedRecords } = normalize(snapshot, policy);
  const excluded = excludedSet(policy), eligible = new Map(), perMint = [];
  for (const token of mints.values()) {
    const records = locks.filter(lock => lock.mint === token.mint);
    const active = records.filter(lock => lock.unlockAt > time.seconds);
    const balances = new Map();
    for (const lock of active.filter(lock => qualifiesDuration(lock, policy))) {
      balances.set(lock.depositor, (balances.get(lock.depositor) ?? 0n) + BigInt(lock.amount));
    }
    const mintWallets = [...balances].filter(([, amount]) => amount >= BigInt(token.minimumRaw)).map(([wallet]) => wallet).sort();
    for (const wallet of mintWallets) {
      if (!eligible.has(wallet)) eligible.set(wallet, []);
      eligible.get(wallet).push(token.mint);
    }
    const sum = list => list.reduce((total, lock) => total + BigInt(lock.amount), 0n).toString();
    perMint.push({
      mint: token.mint, symbol: token.symbol ?? null, decimals: token.decimals, minimumRaw: token.minimumRaw,
      existingLockAccounts: records.length, activeLockAccounts: active.length, expiredUnclaimedLockAccounts: records.length - active.length,
      existingAmountRaw: sum(records), activeAmountRaw: sum(active), expiredUnclaimedAmountRaw: sum(records.filter(lock => lock.unlockAt <= time.seconds)),
      excludedWalletActiveAmountRaw: sum(active.filter(lock => excluded.has(lock.depositor))),
      activeAmountRawExcludingDeclaredWallets: sum(active.filter(lock => !excluded.has(lock.depositor))),
      eligibleWallets: mintWallets, eligibleWalletCount: mintWallets.length,
      excludedEligibleWalletCount: mintWallets.filter(wallet => excluded.has(wallet)).length
    });
  }
  const active = locks.filter(lock => lock.unlockAt > time.seconds);
  const eligibleWallets = [...eligible].sort(([a], [b]) => a.localeCompare(b)).map(([wallet, acceptedMints]) => ({ wallet, acceptedMints, excluded: excluded.has(wallet) }));
  const excludedLocks = locks.filter(lock => excluded.has(lock.depositor));
  return {
    gameId: policy.gameId, policyId: policy.policyId ?? null, asOfUtc: time.iso, slot: snapshot.slot ?? null,
    meaning: 'Token commitment and eligibility for game access; no gameplay or unique-human inference.',
    existingLockAccounts: locks.length, activeLockAccounts: active.length, expiredUnclaimedLockAccounts: locks.length - active.length,
    activeLockRatio: ratio(active.length, locks.length),
    excludedWalletAccountSubtotal: { existingLockAccounts: excludedLocks.length, activeLockAccounts: excludedLocks.filter(lock => lock.unlockAt > time.seconds).length },
    observedDepositorWallets: new Set(locks.map(lock => lock.depositor)).size,
    eligibleWalletCount: eligibleWallets.length,
    excludedEligibleWalletCount: eligibleWallets.filter(item => item.excluded).length,
    eligibleWalletCountExcludingDeclaredWallets: eligibleWallets.filter(item => !item.excluded).length,
    eligibleWallets, perMint, ignoredUnacceptedRecords, duplicateAcceptedRecords,
    historicalClosedAccountCoverage: 'unknown', limitations: [ACCOUNT_LIMIT, 'Current pinned access rules are applied uniformly; historical game policy versions are not reconstructed.', 'Different mint amounts are never added together. Wallets are deduplicated across character unlocks. Public wallet addresses are pseudonymous, not proof of independent people.']
  };
}

function accessEpisodes(locks, token, policy, asOfSeconds) {
  const valid = locks.filter(lock => qualifiesDuration(lock, policy));
  const times = [...new Set(valid.flatMap(lock => [lock.createdAt, lock.unlockAt]).filter(at => at <= asOfSeconds))].sort((a, b) => a - b);
  const active = new Map(), episodes = [];
  const total = () => [...active.values()].reduce((sum, lock) => sum + BigInt(lock.amount), 0n);
  const threshold = BigInt(token.minimumRaw);
  let pending = null;
  for (const at of times) {
    const wasEligible = total() >= threshold;
    const expiring = [...active.values()].filter(lock => lock.unlockAt === at).sort((a, b) => a.address.localeCompare(b.address));
    for (const lock of expiring) active.delete(lock.address);
    if (wasEligible && total() < threshold) {
      pending = { wallet: locks[0].depositor, mint: token.mint, expiredAt: at, expiredLockIds: expiring.map(lock => lock.address), renewedAt: null, newLockIds: [], beforeNewAmountRaw: null, afterNewAmountRaw: null };
      episodes.push(pending);
    }
    const beforeNew = total();
    const created = valid.filter(lock => lock.createdAt === at).sort((a, b) => a.address.localeCompare(b.address));
    for (const lock of created) active.set(lock.address, lock);
    const afterNew = total();
    if (pending && created.length && beforeNew < threshold && afterNew >= threshold && at >= pending.expiredAt) {
      Object.assign(pending, { renewedAt: at, newLockIds: created.map(lock => lock.address), beforeNewAmountRaw: beforeNew.toString(), afterNewAmountRaw: afterNew.toString() });
      pending = null;
    }
  }
  return episodes;
}

function historicalCoverage(coverage, policy, asOfSeconds) {
  if (!coverage || coverage.complete !== true || coverage.includesClosedAccounts !== true || coverage.initialStateKnown !== true || coverage.gameId !== policy.gameId || !coverage.sourceEvidence) {
    return { status: 'unavailable', reason: 'No complete game-scoped archive including closed accounts and known initial state is supplied.' };
  }
  const from = utc(coverage.fromUtc, 'coverage.fromUtc').seconds, through = utc(coverage.throughUtc, 'coverage.throughUtc').seconds;
  assert(from <= through && through <= asOfSeconds, 'Coverage bounds must be ordered and cannot extend beyond asOfUtc');
  return { status: 'complete_declared', from, through, sourceEvidence: coverage.sourceEvidence };
}

/** Economic access recommitment, not gameplay/session retention or proof of recycling old funds. */
export function timelockRenewalMetrics(snapshot, policy, { renewalWindowDays, coverage = null } = {}) {
  integer(renewalWindowDays, 'renewalWindowDays', 1);
  const windowSeconds = renewalWindowDays * DAY_SECONDS;
  assert(Number.isSafeInteger(windowSeconds), 'Renewal window is outside the supported range');
  const { locks, mints, time } = normalize(snapshot, policy), excluded = excludedSet(policy);
  const grouped = new Map();
  for (const lock of locks) {
    const key = `${lock.depositor}\u0000${lock.mint}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(lock);
  }
  const episodes = [...grouped.values()].flatMap(records => accessEpisodes(records, mints.get(records[0].mint), policy, time.seconds));
  episodes.sort((a, b) => a.expiredAt - b.expiredAt || a.wallet.localeCompare(b.wallet) || a.mint.localeCompare(b.mint));
  const firstExpiry = new Map();
  for (const episode of episodes) {
    if (!firstExpiry.has(episode.wallet)) firstExpiry.set(episode.wallet, episode.expiredAt);
  }
  const cohorts = [...firstExpiry].map(([wallet, expiredAt]) => {
    const first = episodes.filter(episode => episode.wallet === wallet && episode.expiredAt === expiredAt);
    const renewed = first.some(episode => episode.renewedAt !== null && episode.renewedAt <= expiredAt + windowSeconds);
    return { wallet, firstObservedAccessLossAt: iso(expiredAt), acceptedMintsAtLoss: first.map(episode => episode.mint), deadlineUtc: iso(expiredAt + windowSeconds), windowMatured: expiredAt + windowSeconds <= time.seconds, renewedWithinWindow: renewed, excluded: excluded.has(wallet) };
  });
  const mature = cohorts.filter(item => item.windowMatured);
  const counts = list => ({ walletDenominator: list.length, renewedWallets: list.filter(item => item.renewedWithinWindow).length });
  const matches = episodes.filter(episode => episode.renewedAt !== null && episode.renewedAt <= episode.expiredAt + windowSeconds);
  // Each new deposit participates only in its own reacquisition event. For lock-level
  // reporting match one expired account to one new account; do not fan out one new
  // lock into several purported renewals. Eligibility itself uses the aggregate.
  const lockPairs = matches.flatMap(episode => episode.expiredLockIds.slice(0, episode.newLockIds.length).map((oldLock, index) => ({ wallet: episode.wallet, mint: episode.mint, expiredLock: oldLock, newLock: episode.newLockIds[index], expiredAt: iso(episode.expiredAt), renewedAt: iso(episode.renewedAt), excluded: excluded.has(episode.wallet) })));
  const history = historicalCoverage(coverage, policy, time.seconds);
  const covered = history.status === 'complete_declared' ? mature.filter(item => Date.parse(item.firstObservedAccessLossAt) / 1000 >= history.from && Date.parse(item.deadlineUtc) / 1000 <= history.through) : [];
  const trueRate = list => {
    if (history.status !== 'complete_declared') return { status: 'unavailable', percentage: null, numerator: null, denominator: null, reason: history.reason };
    const { walletDenominator, renewedWallets } = counts(list);
    return ratio(renewedWallets, walletDenominator);
  };
  return {
    gameId: policy.gameId, policyId: policy.policyId ?? null, asOfUtc: time.iso, slot: snapshot.slot ?? null, renewalWindowDays,
    meaning: 'Same-wallet, same-mint economic commitment reacquisition caused by new locks at/after an observed expiry. A loss concerns one accepted mint/character and need not remove access via other mints. Not gameplay retention and not proof that the expired funds were reused.',
    cohortRule: 'Fixed first observed loss of qualifying commitment for an accepted mint per wallet; expiry must reduce summed active same-mint amount below threshold. Other character access may remain. At an identical timestamp, expiries are processed before deposits. A renewal must reacquire a mint from that first loss within the inclusive window. Only fully elapsed windows enter the wallet denominator.',
    observed: {
      walletsWithAccessLoss: cohorts.length, fullyElapsedWindowWallets: mature.length,
      ...counts(mature), excludedWalletSubtotal: counts(mature.filter(item => item.excluded)),
      excludingDeclaredWallets: counts(mature.filter(item => !item.excluded)),
      matchedAccessEpisodes: matches.length, oneToOneLockPairCount: lockPairs.length,
      uniqueObservedRenewingWalletsAcrossEpisodes: new Set(matches.map(item => item.wallet)).size
    },
    historicalRenewalRetention: { allWallets: trueRate(covered), excludedWalletSubtotal: trueRate(covered.filter(item => item.excluded)), excludingDeclaredWallets: trueRate(covered.filter(item => !item.excluded)) },
    coverage: history, cohorts,
    accessLossEpisodes: episodes.map(episode => ({ ...episode, expiredAt: iso(episode.expiredAt), renewedAt: episode.renewedAt === null ? null : iso(episode.renewedAt), excluded: excluded.has(episode.wallet), qualifiesWithinWindow: episode.renewedAt !== null && episode.renewedAt <= episode.expiredAt + windowSeconds })),
    oneToOneLockPairs: lockPairs,
    limitations: [ACCOUNT_LIMIT, 'Current pinned access rules are applied retrospectively. This does not establish the game eligibility policy in force on the historical creation/expiry dates.', 'Expiry/redeposit relationships are inferred, because the program exposes create_lock and claim, not a renew/extend instruction. One wallet may control many addresses and need not have played. Declaring complete coverage does not independently verify its provenance.']
  };
}

async function main(args) {
  assert(args.length === 0 || (args.length === 2 && args[0] === '--out'), 'Usage: node metrics.mjs [--out game-metrics.json]');
  const input = new URL('../onchain/receipts/decoded-locks.json', import.meta.url);
  const policyUrl = new URL('./game-policy.json', import.meta.url);
  const [snapshot, policy] = await Promise.all([readFile(input, 'utf8').then(JSON.parse), readFile(policyUrl, 'utf8').then(JSON.parse)]);
  const result = {
    schemaVersion: 1, evidenceDate: '2026-10-07', input: '../onchain/receipts/decoded-locks.json', policy: './game-policy.json',
    chain: policy.chain, programId: policy.programId, policyId: policy.policyId,
    policyReconstruction: policy.historicalInterpretation,
    tokenCommitment: perGameLockMetrics(snapshot, policy),
    renewal7Days: timelockRenewalMetrics(snapshot, policy, { renewalWindowDays: 7 }),
    renewal30Days: timelockRenewalMetrics(snapshot, policy, { renewalWindowDays: 30 })
  };
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (args.length) {
    const outputPath = resolve(args[1]);
    // This standalone CLI writes only the explicitly requested result file.
    await writeFile(outputPath, output, { flag: 'w' });
    process.stdout.write(`Wrote ${args[1]} from archived evidence; no network requests.\n`);
  } else process.stdout.write(output);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
