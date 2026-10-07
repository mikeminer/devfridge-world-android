// Offline parsing of archived successful Fridge instructions, including closed locks.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PROGRAM } from './collect-history.mjs';
const LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const discriminator = name => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
const CREATE = discriminator('create_lock'), CLAIM = discriminator('claim');
const OTHER = new Map(['boost', 'crank_buyback'].map(name => [discriminator(name).toString('hex'), name]));

export function decodeBase58(value) {
  if (typeof value !== 'string') throw Error('Instruction data must be base58 text');
  let n = 0n;
  for (const char of value) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw Error('Invalid base58 character');
    n = n * 58n + BigInt(index);
  }
  const bytes = [];
  while (n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  for (const char of value) { if (char !== '1') break; bytes.unshift(0); }
  return Buffer.from(bytes);
}

export function decodeHistoricalFridge(tx, signature, receipt = null) {
  if (!tx || !tx.meta || !Number.isSafeInteger(tx.slot)) throw Error('Missing transaction metadata/slot');
  if (tx.transaction?.signatures?.[0] !== signature) throw Error('Transaction signature differs from requested signature');
  if (tx.meta.err !== null) return { failed: true, events: [], unknown: [], loader: [] };
  const message = tx.transaction.message;
  if (!Array.isArray(message.accountKeys) || !Array.isArray(message.instructions)) throw Error('Unsupported transaction message shape');
  const keys = [...message.accountKeys.map(key => typeof key === 'string' ? key : key.pubkey), ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const instructions = message.instructions.flatMap((ix, index) => [{ ix, location: `outer:${index}` }, ...(tx.meta.innerInstructions ?? []).filter(group => group.index === index).flatMap(group => group.instructions.map((inner, j) => ({ ix: inner, location: `inner:${index}:${j}` })))]);
  const events = [], unknown = [], loader = [];
  for (const { ix, location } of instructions) {
    const program = keys[ix.programIdIndex] ?? ix.programId;
    if (program !== PROGRAM && program !== LOADER) continue;
    const data = decodeBase58(ix.data);
    const accounts = (ix.accounts ?? []).map(index => typeof index === 'number' ? keys[index] : index);
    if (program === LOADER) {
      // Preserved chain data use bincode's four-byte little-endian enum tag.
      const tag = data.length >= 4 ? data.readUInt32LE(0) : null;
      if (tag === 2 && accounts[2] === PROGRAM) {
        const programIndex = keys.indexOf(PROGRAM);
        const createdInSameTransaction = instructions.some(({ ix: candidate }) => {
          if (keys[candidate.programIdIndex] !== '11111111111111111111111111111111' || keys[candidate.accounts?.[1]] !== PROGRAM) return false;
          const raw = decodeBase58(candidate.data);
          return raw.length === 52 && raw.readUInt32LE(0) === 0 && raw.subarray(20, 52).equals(decodeBase58(LOADER));
        });
        loader.push({ type: 'deploy', signature, receipt, location, slot: tx.slot, blockTime: tx.blockTime, programData: accounts[1], authority: accounts[7], dataHex: data.toString('hex'), programPreLamports: tx.meta.preBalances?.[programIndex] ?? null, programPostLamports: tx.meta.postBalances?.[programIndex] ?? null, createdInSameTransaction });
      }
      else if (tag === 3 && accounts[1] === PROGRAM) loader.push({ type: 'upgrade', signature, receipt, location, slot: tx.slot, blockTime: tx.blockTime, programData: accounts[0], authority: accounts[6], dataHex: data.toString('hex') });
      else if (accounts.includes(PROGRAM)) loader.push({ type: 'other-loader', signature, receipt, location, slot: tx.slot, blockTime: tx.blockTime, tag, accounts, dataHex: data.toString('hex') });
      continue;
    }
    const common = { eventId: `${signature}:${location}`, signature, receipt, location, slot: tx.slot, blockTime: tx.blockTime };
    if (data.subarray(0, 8).equals(CREATE)) {
      if (data.length !== 32 || accounts.length < 8) throw Error('Unsupported create_lock shape');
      if (accounts[5] !== TOKEN_2022) throw Error('Unexpected token program');
      const vaultIndex = keys.indexOf(accounts[4]);
      const vault = (tx.meta.postTokenBalances ?? []).find(balance => balance.accountIndex === vaultIndex && balance.mint === accounts[1] && balance.owner === accounts[3]);
      const amount = vault?.uiTokenAmount?.amount;
      const timestamp = tx.blockTime;
      if (typeof amount !== 'string' || !/^\d+$/.test(amount) || BigInt(amount) <= 0n) throw Error('Missing or invalid actual post-transfer vault amount');
      if (vault.programId !== TOKEN_2022) throw Error('Unexpected vault balance token program');
      if (!Number.isSafeInteger(timestamp)) throw Error('Missing transaction blockTime');
      events.push({ ...common, type: 'create_lock', address: accounts[3], depositor: accounts[0], mint: accounts[1], vault: accounts[4], amount,
        requestedAmount: data.readBigUInt64LE(8).toString(), unlockAt: Number(data.readBigInt64LE(16)), lockId: data.readBigUInt64LE(24).toString(),
        createdAt: timestamp, createdAtOrigin: 'transaction.blockTime; exact Clock timestamp must be reconciled where account data survive', decimals: vault.uiTokenAmount.decimals });
    } else if (data.subarray(0, 8).equals(CLAIM)) {
      if (accounts.length < 9 || data.length < 20) throw Error('Unsupported claim shape');
      const lockIndex = keys.indexOf(accounts[3]), vaultIndex = keys.indexOf(accounts[4]);
      events.push({ ...common, type: 'claim', address: accounts[3], depositor: accounts[0], mint: accounts[1], vault: accounts[4], closedLockAccount: tx.meta.postBalances?.[lockIndex] === 0, closedVaultAccount: tx.meta.postBalances?.[vaultIndex] === 0 });
    } else if (OTHER.has(data.subarray(0, 8).toString('hex'))) {
      events.push({ ...common, type: OTHER.get(data.subarray(0, 8).toString('hex')) });
    } else unknown.push({ ...common, discriminatorHex: data.subarray(0, 8).toString('hex'), accounts, dataHex: data.toString('hex') });
  }
  return { failed: false, events, unknown, loader };
}

async function main(directory) {
  const out = resolve(directory ?? fileURLToPath(new URL('./receipts/', import.meta.url)));
  const [manifest, discovery] = await Promise.all(['transactions-manifest.json', 'program-signatures.json'].map(name => readFile(join(out, name), 'utf8').then(JSON.parse)));
  const signatureInfo = new Map(discovery.signatures.map(info => [info.signature, info]));
  const events = [], unknown = [], loader = [], failures = [], errors = [];
  for (const record of manifest.transactions) {
    if (!record.available) { errors.push({ signature: record.signature, reason: 'Transaction unavailable' }); continue; }
    try {
      const response = JSON.parse(await readFile(join(out, `${record.receipt}.body.txt`), 'utf8'));
      if (response.result.slot !== signatureInfo.get(record.signature)?.slot) throw Error('Signature-list/transaction slot mismatch');
      if (JSON.stringify(response.result.meta.err) !== JSON.stringify(signatureInfo.get(record.signature)?.err)) throw Error('Signature-list/transaction error mismatch');
      const decoded = decodeHistoricalFridge(response.result, record.signature, record.receipt);
      if (decoded.failed) failures.push({ signature: record.signature, slot: response.result.slot, error: response.result.meta.err });
      events.push(...decoded.events); unknown.push(...decoded.unknown); loader.push(...decoded.loader);
    } catch (error) { errors.push({ signature: record.signature, receipt: record.receipt, reason: error.message }); }
  }
  events.sort((a, b) => a.slot - b.slot || (signatureInfo.get(a.signature)?.transactionIndex ?? 0) - (signatureInfo.get(b.signature)?.transactionIndex ?? 0) || a.location.localeCompare(b.location));
  const data = { schemaVersion: 1, programId: PROGRAM, pinnedSlot: manifest.pinnedSlot, events, unknownInstructions: unknown, loaderEvents: loader, failedTransactions: failures, decodeErrors: errors };
  await writeFile(join(out, 'decoded-history.json'), `${JSON.stringify(data, null, 2)}\n`);
  const counts = events.reduce((result, event) => { result[event.type] = (result[event.type] ?? 0) + 1; return result; }, {});
  process.stdout.write(`${JSON.stringify({ counts, failedTransactions: failures.length, decodeErrors: errors, unknownInstructions: unknown.length, loader }, null, 2)}\n`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv[2]).catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
