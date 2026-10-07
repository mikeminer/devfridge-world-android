// All fixtures here are SYNTHETIC and are not adopter/player evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase58, decodeHistoricalFridge } from './decode-history.mjs';
import { reconcileFridgeHistory } from './reconcile-history.mjs';
import { PROGRAM } from './collect-history.mjs';
const TOKEN = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
const SYSTEM = '11111111111111111111111111111111';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode(bytes) {
  let n = 0n; for (const byte of bytes) n = n * 256n + BigInt(byte);
  let result = ''; while (n) { result = alphabet[Number(n % 58n)] + result; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = `1${result}`; }
  return result;
}
function createTx() {
  const raw = Buffer.alloc(32); Buffer.from([171,216,92,167,165,8,153,90]).copy(raw);
  raw.writeBigUInt64LE(9007199254740993n, 8); raw.writeBigInt64LE(2000n, 16); raw.writeBigUInt64LE(123n, 24);
  return { slot: 100, blockTime: 1000, transaction: { signatures: ['synthetic-signature'], message: { accountKeys: ['wallet', 'mint-a', 'ata', 'lock-a', 'vault-a', TOKEN, 'associated', SYSTEM, PROGRAM], instructions: [{ programIdIndex: 8, accounts: [0,1,2,3,4,5,6,7], data: encode(raw) }] } }, meta: { err: null, loadedAddresses: { writable: [], readonly: [] }, postTokenBalances: [{ accountIndex: 4, mint: 'mint-a', owner: 'lock-a', programId: TOKEN, uiTokenAmount: { amount: '9007199254740992', decimals: 6 } }] } };
}
function createEvent(address = 'lock-a', mint = 'mint-a', slot = 102) {
  return { type: 'create_lock', address, depositor: 'wallet', mint, vault: `vault-${address}`, amount: '500000000000', requestedAmount: '500000000000', createdAt: 1000, unlockAt: 2000, lockId: String(slot), decimals: 6, eventId: `synthetic-${slot}`, slot, blockTime: 1000 };
}
function claimEvent(created, slot = 103) {
  return { type: 'claim', address: created.address, depositor: created.depositor, mint: created.mint, vault: created.vault, eventId: `synthetic-claim-${slot}`, slot, blockTime: 2100, closedLockAccount: true, closedVaultAccount: true };
}
const policy = { acceptedMints: [{ mint: 'mint-a', decimals: 6 }] };
function history(events) {
  return { events, unknownInstructions: [], decodeErrors: [], loaderEvents: [{ type: 'deploy', slot: 100, blockTime: 900, programPreLamports: 0, programPostLamports: 1000, createdInSameTransaction: true }] };
}
function snapshot(events) { return { locks: events.map(event => ({ ...event })), gapSignatures: [] }; }

test('base58 preserves leading zero bytes and rejects invalid alphabet', () => {
  assert.deepEqual([...decodeBase58('1112')], [0,0,0,1]);
  assert.throws(() => decodeBase58('0'), /Invalid base58/);
});

test('create parser preserves raw precision and uses actual net vault amount', () => {
  const event = decodeHistoricalFridge(createTx(), 'synthetic-signature').events[0];
  assert.equal(event.requestedAmount, '9007199254740993');
  assert.equal(event.amount, '9007199254740992');
  assert.equal(event.unlockAt, 2000);
  assert.equal(event.lockId, '123');
  assert.equal(event.createdAtOrigin.includes('blockTime'), true);
});

test('versioned loaded addresses resolve program instruction correctly', () => {
  const tx = createTx(); tx.transaction.message.accountKeys.pop(); tx.meta.loadedAddresses.readonly.push(PROGRAM);
  assert.equal(decodeHistoricalFridge(tx, 'synthetic-signature').events[0].address, 'lock-a');
});

test('inner CPI create instruction is recovered rather than omitted', () => {
  const tx = createTx(), create = tx.transaction.message.instructions[0];
  tx.transaction.message.accountKeys.push('synthetic-wrapper');
  tx.transaction.message.instructions = [{ programIdIndex: 9, accounts: [], data: '' }];
  tx.meta.innerInstructions = [{ index: 0, instructions: [create] }];
  assert.equal(decodeHistoricalFridge(tx, 'synthetic-signature').events[0].location, 'inner:0:0');
});

test('failed transactions never become deposit evidence', () => {
  const tx = createTx(); tx.meta.err = { InstructionError: [0, 'Custom'] };
  const result = decodeHistoricalFridge(tx, 'synthetic-signature');
  assert.equal(result.failed, true); assert.equal(result.events.length, 0);
});

test('transaction must match the requested signature', () => {
  assert.throws(() => decodeHistoricalFridge(createTx(), 'different-signature'), /signature differs/);
});

test('missing vault balance, owner mismatch or token-program mismatch blocks create decoding', () => {
  const missing = createTx(); missing.meta.postTokenBalances = [];
  assert.throws(() => decodeHistoricalFridge(missing, 'synthetic-signature'), /vault amount/);
  const wrongOwner = createTx(); wrongOwner.meta.postTokenBalances[0].owner = 'wrong-lock';
  assert.throws(() => decodeHistoricalFridge(wrongOwner, 'synthetic-signature'), /vault amount/);
  const wrongProgram = createTx(); wrongProgram.meta.postTokenBalances[0].programId = 'wrong-program';
  assert.throws(() => decodeHistoricalFridge(wrongProgram, 'synthetic-signature'), /token program/);
});

test('unknown instruction is recorded as missing coverage, not silently discarded', () => {
  const tx = createTx(); tx.transaction.message.instructions[0].data = encode(Buffer.alloc(8, 7));
  const result = decodeHistoricalFridge(tx, 'synthetic-signature');
  assert.equal(result.events.length, 0); assert.equal(result.unknown.length, 1);
});

test('deployment origin requires program creation in the same successful transaction', () => {
  const create = Buffer.alloc(52); create.writeUInt32LE(0); decodeBase58(LOADER).copy(create, 20);
  const deploy = Buffer.alloc(12); deploy.writeUInt32LE(2); deploy.writeBigUInt64LE(4096n, 4);
  const tx = { slot: 100, blockTime: 1000, transaction: { signatures: ['synthetic-deploy'], message: { accountKeys: ['payer', PROGRAM, 'program-data', 'buffer', 'rent', 'clock', SYSTEM, 'authority', LOADER], instructions: [{ programIdIndex: 6, accounts: [0,1], data: encode(create) }, { programIdIndex: 8, accounts: [0,2,1,3,4,5,6,7], data: encode(deploy) }] } }, meta: { err: null, preBalances: [1,0], postBalances: [1,1000] } };
  const event = decodeHistoricalFridge(tx, 'synthetic-deploy').loader[0];
  assert.equal(event.type, 'deploy'); assert.equal(event.createdInSameTransaction, true); assert.equal(event.programPreLamports, 0);
});

test('exact surviving account state and verified origin enable game history coverage', () => {
  const created = createEvent(), result = reconcileFridgeHistory(history([created]), snapshot([created]), policy);
  assert.equal(result.canEstablishCompleteGameHistory, true); assert.equal(result.gameExactTimestampRecords, 1);
});

test('current account field mismatch or missing current account blocks coverage', () => {
  const created = createEvent(), bad = snapshot([created]); bad.locks[0].amount = '1';
  assert.equal(reconcileFridgeHistory(history([created]), bad, policy).canEstablishCompleteGameHistory, false);
  assert.equal(reconcileFridgeHistory(history([created]), snapshot([]), policy).canEstablishCompleteGameHistory, false);
});

test('claim without a historical create or without confirmed account closures blocks coverage', () => {
  const other = createEvent('other', 'other-mint');
  assert.equal(reconcileFridgeHistory(history([claimEvent(other)]), snapshot([]), policy).canEstablishCompleteGameHistory, false);
  const claim = claimEvent(other); claim.closedVaultAccount = false;
  assert.equal(reconcileFridgeHistory(history([other, claim]), snapshot([]), policy).canEstablishCompleteGameHistory, false);
});

test('closed non-game locks do not invalidate exact fully surviving game history', () => {
  const game = createEvent(), other = createEvent('other', 'other-mint', 104);
  const result = reconcileFridgeHistory(history([game, other, claimEvent(other, 105)]), snapshot([game]), policy);
  assert.equal(result.successfulClaims, 1); assert.equal(result.gameClaims, 0); assert.equal(result.canEstablishCompleteGameHistory, true);
});

test('claimed game lock exact Clock creation is unavailable, so full game rate remains unavailable', () => {
  const game = createEvent(), result = reconcileFridgeHistory(history([game, claimEvent(game)]), snapshot([]), policy);
  assert.equal(result.gameClaims, 1); assert.equal(result.canEstablishCompleteGameHistory, false);
});

test('reused PDA after a real claim counts separate incarnations and reconstructs the new open one', () => {
  const first = createEvent('same-address', 'other-mint', 102), second = createEvent('same-address', 'other-mint', 104);
  const result = reconcileFridgeHistory(history([first, claimEvent(first, 103), second]), snapshot([second]), policy);
  assert.equal(result.successfulCreates, 2); assert.equal(result.successfulClaims, 1); assert.equal(result.currentOpenAccounts, 1); assert.equal(result.historicalUniqueAccountAddresses, 1); assert.deepEqual(result.reusedAccountAddresses, ['same-address']);
});

test('new signature gap, unknown instructions or unverified initial zero state prevent full coverage', () => {
  const game = createEvent();
  const gap = snapshot([game]); gap.gapSignatures.push({ signature: 'new-uncollected' });
  assert.equal(reconcileFridgeHistory(history([game]), gap, policy).canEstablishCompleteGameHistory, false);
  const unknown = history([game]); unknown.unknownInstructions.push({ discriminator: 'unknown' });
  assert.equal(reconcileFridgeHistory(unknown, snapshot([game]), policy).canEstablishCompleteGameHistory, false);
  const reusedProgram = history([game]); reusedProgram.loaderEvents[0].programPreLamports = 1000;
  assert.equal(reconcileFridgeHistory(reusedProgram, snapshot([game]), policy).canEstablishCompleteGameHistory, false);
});
