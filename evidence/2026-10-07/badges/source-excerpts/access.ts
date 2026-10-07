import nacl from 'tweetnacl';
import bs58 from 'bs58';
import type { CastMember } from './core';
import type { VerifiedTimelock } from './economy';
import { REQUIRED_TOKEN_PROGRAM, type EligibleToken } from './devfridge-locks';

export const MINIMUM_TIMELOCK_TOKENS = 500_000n;

export function characterTokens(cast: CastMember[]): EligibleToken[] {
  if (cast.length !== 10 || cast.some(c => !c.token || c.token.program !== 'token-2022')) throw new Error('The ten Token-2022 character mints must be configured.');
  return cast.map(c => ({ mint: c.token!.mint, decimals: c.token!.decimals, programId: REQUIRED_TOKEN_PROGRAM }));
}

/** Sum active locks of each mint independently, using raw integer balances. */
export function unlockedCharacters(wallet: string, cast: CastMember[], locks: VerifiedTimelock[], now = Date.now()): number[] {
  const totals = new Map<string, bigint>(), seen = new Set<string>();
  for (const lock of locks) {
    const token = cast.find(c => c.token?.mint === lock.mint)?.token;
    if (!token || token.program !== 'token-2022' || lock.decimals !== token.decimals || lock.wallet !== wallet || !lock.id || seen.has(lock.id) || !Number.isSafeInteger(lock.unlockAt) || lock.unlockAt <= now || !/^\d+$/.test(lock.amount)) continue;
    seen.add(lock.id);
    totals.set(lock.mint, (totals.get(lock.mint) ?? 0n) + BigInt(lock.amount));
  }
  return cast.filter(c => c.token?.program === 'token-2022' && Number.isInteger(c.token.decimals) && c.token.decimals >= 0 && c.token.decimals <= 255 && (totals.get(c.token.mint) ?? 0n) >= MINIMUM_TIMELOCK_TOKENS * 10n ** BigInt(c.token.decimals)).map(c => c.tier);
}

export function accessMessage(address: string, origin: string, nonce: string, issuedAt: number): Uint8Array {
  return new TextEncoder().encode(`${new URL(origin).host} wants you to sign in with your Solana account:\n${address}\n\nEnter DevFridge Cold Storage with your timelocked meme. This message does not authorize any transaction.\n\nURI: ${origin}/world/game/index.html\nVersion: 1\nChain ID: solana:mainnet\nNonce: ${nonce}\nIssued At: ${new Date(issuedAt).toISOString()}`);
}

export function verifyAccessSignature(address: string, message: Uint8Array, signature: Uint8Array, signedMessage: Uint8Array = message): boolean {
  try {
    return message.length === signedMessage.length && message.every((v, i) => v === signedMessage[i]) && nacl.sign.detached.verify(message, signature, bs58.decode(address));
  } catch { return false; }
}
