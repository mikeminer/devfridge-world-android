import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROGRAM } from './collect-history.mjs';
import { perGameLockMetrics, timelockRenewalMetrics } from '../measurement/metrics.mjs';
const ENDPOINT = 'https://scan.devfridge.cool/api/rpc';
const DISC = Buffer.from([8,255,36,202,210,22,57,137]);
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const stamp = seconds => new Date(seconds * 1000).toISOString();
function encodeBase58(bytes) {
  let n = 0n; for (const byte of bytes) n = n * 256n + BigInt(byte);
  let result = ''; while (n) { result = alphabet[Number(n % 58n)] + result; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = `1${result}`; }
  return result;
}

export async function collectFreshAccountSnapshot(directory) {
  const out = resolve(directory);
  let sequence = (await readdir(out)).reduce((max, name) => Math.max(max, Number(name.match(/^(\d+)-/)?.[1] ?? 0)), 0);
  async function request(method, params, label) {
    if (!['getProgramAccounts', 'getSignaturesForAddress'].includes(method)) throw Error('Read-only method required');
    const name = `${String(++sequence).padStart(4, '0')}-${label}`, startedAt = new Date().toISOString();
    const payload = { jsonrpc: '2.0', id: sequence, method, params };
    let status = null, body = '', error = null, headers = {};
    try {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
      status = response.status; headers = Object.fromEntries(response.headers.entries()); body = await response.text();
    } catch (e) { error = String(e); }
    const receipt = { name, url: ENDPOINT, method: 'POST', request: payload, startedAt, finishedAt: new Date().toISOString(), status, headers, error, bodyFile: `${name}.body.txt`, bodySha256: createHash('sha256').update(body).digest('hex') };
    await writeFile(join(out, receipt.bodyFile), body, { flag: 'wx' });
    await writeFile(join(out, `${name}.receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    if (status !== 200) throw Error(`Public RPC HTTP status ${status}`);
    const json = JSON.parse(body);
    if (json.error || !('result' in json)) throw Error(`Public RPC failed: ${JSON.stringify(json.error)}`);
    return { ...receipt, result: json.result };
  }
  const accounts = await request('getProgramAccounts', [PROGRAM, { commitment: 'finalized', encoding: 'base64', withContext: true, filters: [{ dataSize: 105 }] }], 'fresh-finalized-lock-accounts');
  if (!Array.isArray(accounts.result?.value) || !Number.isSafeInteger(accounts.result?.context?.slot)) throw Error('Missing account response context');
  const seen = new Set(), locks = [];
  for (const row of accounts.result.value) {
    const bytes = Buffer.from(row.account?.data?.[0] ?? '', 'base64');
    if (row.account?.owner !== PROGRAM || bytes.length !== 105 || !bytes.subarray(0, 8).equals(DISC)) throw Error('Unrecognized account in lock-only response');
    if (seen.has(row.pubkey)) throw Error('Duplicate lock account');
    seen.add(row.pubkey);
    locks.push({ address: row.pubkey, depositor: encodeBase58(bytes.subarray(8, 40)), mint: encodeBase58(bytes.subarray(40, 72)), amount: bytes.readBigUInt64LE(72).toString(), createdAt: Number(bytes.readBigInt64LE(80)), unlockAt: Number(bytes.readBigInt64LE(88)), bump: bytes[96], lockId: bytes.readBigUInt64LE(97).toString() });
  }
  const signatures = JSON.parse(await readFile(join(out, 'program-signatures.json'), 'utf8'));
  const gap = await request('getSignaturesForAddress', [PROGRAM, { commitment: 'finalized', minContextSlot: accounts.result.context.slot, until: signatures.signatures[0].signature, limit: 1000 }], 'post-discovery-signature-gap');
  if (!Array.isArray(gap.result)) throw Error('Missing final signature gap response');
  const snapshot = { slot: accounts.result.context.slot, asOfUtc: accounts.finishedAt, locks, invalidAccounts: [], accountReceipt: accounts.name, gapReceipt: gap.name, gapSignatures: gap.result, historyPinnedSlot: signatures.pinnedSlot };
  await writeFile(join(out, 'fresh-decoded-locks.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

export function reconcileFridgeHistory(history, snapshot, policy) {
  const open = new Map(), generations = [], claims = [], problems = [];
  for (const event of history.events) {
    if (event.type === 'create_lock') {
      if (open.has(event.address)) problems.push({ type: 'create-without-prior-claim', eventId: event.eventId });
      const generation = { ...event, claimed: false };
      generations.push(generation); open.set(event.address, generation);
    } else if (event.type === 'claim') {
      const generation = open.get(event.address);
      if (!generation) problems.push({ type: 'claim-without-create', eventId: event.eventId });
      else {
        if (generation.depositor !== event.depositor || generation.mint !== event.mint || generation.vault !== event.vault) problems.push({ type: 'claim-identity-mismatch', eventId: event.eventId });
        if (!event.closedLockAccount || !event.closedVaultAccount) problems.push({ type: 'claim-close-unproved', eventId: event.eventId });
        generation.claimed = true; generation.claimEventId = event.eventId; generation.claimedAt = event.blockTime;
        claims.push(generation); open.delete(event.address);
      }
    }
  }
  const accountFields = ['depositor', 'mint', 'amount', 'unlockAt', 'lockId'];
  const clockDeltas = [], reconciled = [];
  for (const account of snapshot.locks) {
    const event = open.get(account.address);
    if (!event) { problems.push({ type: 'current-account-without-historical-create', address: account.address }); continue; }
    for (const field of accountFields) if (account[field] !== event[field]) problems.push({ type: 'current-account-field-mismatch', address: account.address, field, account: account[field], history: event[field] });
    clockDeltas.push({ address: account.address, deltaSeconds: account.createdAt - event.createdAt });
    reconciled.push({ ...event, createdAt: account.createdAt, createdAtOrigin: 'Exact surviving Lock.created_at, corroborated by historical transaction', blockTimeDeltaSeconds: account.createdAt - event.createdAt });
  }
  const surviving = new Set(snapshot.locks.map(lock => lock.address));
  for (const address of open.keys()) if (!surviving.has(address)) problems.push({ type: 'historical-open-account-missing-from-current-snapshot', address });
  const mints = new Map(policy.acceptedMints.map(token => [token.mint, token]));
  const gameCreates = generations.filter(event => mints.has(event.mint));
  const gameClaims = claims.filter(event => mints.has(event.mint));
  for (const event of gameCreates) if (event.decimals !== mints.get(event.mint).decimals) problems.push({ type: 'game-mint-decimal-mismatch', eventId: event.eventId });
  const gameReconciled = reconciled.filter(event => mints.has(event.mint));
  const deployment = history.loaderEvents.filter(event => event.type === 'deploy').sort((a, b) => a.slot - b.slot)[0] ?? null;
  const beforeDeploymentCalls = history.events.filter(event => deployment && event.slot < deployment.slot);
  const initialZeroStateVerified = Boolean(deployment && deployment.programPreLamports === 0 && deployment.programPostLamports > 0 && deployment.createdInSameTransaction);
  const canEstablishCompleteGameHistory = Boolean(initialZeroStateVerified && !beforeDeploymentCalls.length && !problems.length && !history.decodeErrors.length && !history.unknownInstructions.length && !snapshot.gapSignatures.length && gameClaims.length === 0 && gameCreates.length === gameReconciled.length);
  return {
    deployment, initialZeroStateVerified, successfulCreates: generations.length, successfulClaims: claims.length, historicalUniqueAccountAddresses: new Set(generations.map(event => event.address)).size,
    reusedAccountAddresses: [...new Set(generations.filter((event, index) => generations.findIndex(other => other.address === event.address) !== index).map(event => event.address))],
    currentOpenAccounts: open.size, currentSnapshotAccounts: snapshot.locks.length, problems, clockDeltas,
    gameCreates: gameCreates.length, gameClaims: gameClaims.length, gameExactTimestampRecords: gameReconciled.length,
    canEstablishCompleteGameHistory, gameLocks: gameReconciled,
    historicalProtocolDepositorWallets: new Set(generations.map(event => event.depositor)).size,
    historicalAcceptedMintDepositorWallets: new Set(gameCreates.map(event => event.depositor)).size
  };
}

async function main(directory, offline) {
  const out = resolve(directory ?? fileURLToPath(new URL('./receipts/', import.meta.url)));
  const [history, signatures, manifest, policy, discovery] = await Promise.all([
    readFile(join(out, 'decoded-history.json'), 'utf8').then(JSON.parse),
    readFile(join(out, 'program-signatures.json'), 'utf8').then(JSON.parse),
    readFile(join(out, 'transactions-manifest.json'), 'utf8').then(JSON.parse),
    readFile(new URL('../measurement/game-policy.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(join(out, 'discovery-summary.json'), 'utf8').then(JSON.parse)
  ]);
  const snapshot = offline ? JSON.parse(await readFile(join(out, 'fresh-decoded-locks.json'), 'utf8')) : await collectFreshAccountSnapshot(out);
  const reconciled = reconcileFridgeHistory(history, snapshot, policy);
  const availableTransactionsComplete = manifest.available === signatures.signatures.length && !manifest.unavailable.length;
  const historyComplete = reconciled.canEstablishCompleteGameHistory && signatures.terminalEmptyPage && availableTransactionsComplete && discovery.genesisHash === '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
  const coverage = historyComplete ? {
    gameId: policy.gameId, complete: true, includesClosedAccounts: true, initialStateKnown: true,
    fromUtc: stamp(reconciled.deployment.blockTime), throughUtc: snapshot.asOfUtc,
    sourceEvidence: 'Same-package program-signatures/transactions-manifest/decoded-history plus initial loader deployment and exact surviving game lock accounts. All closed claims recovered; none concern an accepted World mint.'
  } : null;
  const completeGameSnapshot = { ...snapshot, locks: reconciled.gameLocks };
  const summary = {
    schemaVersion: 1, chain: policy.chain, programId: PROGRAM, policyId: policy.policyId, genesisHash: discovery.genesisHash,
    historyDiscoverySlot: signatures.pinnedSlot, accountSnapshotSlot: snapshot.slot, asOfUtc: snapshot.asOfUtc,
    completeGameHistoryUnderCurrentPolicy: historyComplete, coverage,
    signatureCoverage: { total: signatures.signatures.length, terminalEmptyPage: signatures.terminalEmptyPage, available: manifest.available, unavailable: manifest.unavailable.length, oldestSlot: signatures.signatures.at(-1)?.slot, latestSlot: signatures.signatures[0]?.slot, newSignatureGapCount: snapshot.gapSignatures.length },
    reconciliation: reconciled,
    currentAdoption: perGameLockMetrics(snapshot, policy),
    historicalRenewal7Days: timelockRenewalMetrics(completeGameSnapshot, policy, { renewalWindowDays: 7, coverage }),
    historicalRenewal30Days: timelockRenewalMetrics(completeGameSnapshot, policy, { renewalWindowDays: 30, coverage }),
    limitations: ['Current pinned access rules are applied retrospectively; historical policy versions are not reconstructed.', 'History completion is supported by a single public RPC archive, initial deployment, exhaustive pagination and state reconciliation. It is not an independent security audit or proof of human identity.', 'Protocol closed-account creation uses transaction blockTime where exact Lock.created_at did not survive. No accepted World-mint lock was claimed: all game creation timestamps are instead verified against surviving account data.', 'Treasury-labelled adoption and renewal are not independent market demand; overlapping game-policy wallet counts are not additive.', 'No Android platform, gameplay, wallet-consent or positive-SKR execution is inferred.']
  };
  await writeFile(join(out, 'history-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ completeGameHistoryUnderCurrentPolicy: historyComplete, slot: snapshot.slot, asOfUtc: snapshot.asOfUtc, protocolCreates: reconciled.successfulCreates, protocolClaims: reconciled.successfulClaims, currentAccounts: reconciled.currentSnapshotAccounts, historyWallets: reconciled.historicalProtocolDepositorWallets, gameCreates: reconciled.gameCreates, gameClaims: reconciled.gameClaims, problems: reconciled.problems, nonzeroClockDeltas: reconciled.clockDeltas.filter(item => item.deltaSeconds !== 0), eligible: summary.currentAdoption.eligibleWalletCount, eligibleExcludingTreasury: summary.currentAdoption.eligibleWalletCountExcludingDeclaredWallets, renewal7: summary.historicalRenewal7Days.historicalRenewalRetention, renewal30: summary.historicalRenewal30Days.historicalRenewalRetention, deployment: reconciled.deployment }, null, 2)}\n`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv[2] === '--offline' ? undefined : process.argv[2], process.argv.includes('--offline')).catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
