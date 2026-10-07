import { highestValueLockedMint, rawAmount, type VerifiedMarketPrice, type VerifiedTimelock } from './economy';
import { assetUrl } from './paths';

export const DEVFRIDGE_SDK_SOURCE = 'https://sdk.devfridge.cool/sdk/devfridge-sdk.js';
export const DEVFRIDGE_LOCK_SOURCE = 'https://devfridge.cool';
export const DEVFRIDGE_SCANNER = 'https://scan.devfridge.cool';
export const REQUIRED_TOKEN_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export interface EligibleToken { mint: string; decimals: number; programId: string }
interface SDKLock { address: string; depositor: string; mint: string; amount: string; createdAt: number; unlockAt: number }
export interface SDKStatus { wallet: string; activeLocks: SDKLock[]; active?: boolean; bestLock?: SDKLock | null }
export interface SDKConfig {
  tokenMint: string; plans: { game: { minLockDays: number; renewalThresholdDays: number } };
  scannerUrl: string; fridgeUrl: string; cacheTTL: number;
}
export interface SDKConstructor { new (config: SDKConfig): { checkSubscription(wallet: string): Promise<SDKStatus> } }
let sdkLoading: Promise<SDKConstructor> | undefined;

/** Pinned published SDK, bundled locally so gameplay itself remains offline-capable. */
export function loadDevFridgeSDK(): Promise<SDKConstructor> {
  return sdkLoading ??= new Promise<SDKConstructor>((resolve, reject) => {
    const script = document.createElement('script'); script.src = assetUrl('vendor/devfridge-sdk.js'); script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error('DevFridge SDK loading timed out.')); }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      const Constructor = (globalThis as typeof globalThis & { DevFridgeSDK?: SDKConstructor }).DevFridgeSDK;
      if (typeof Constructor !== 'function') { reject(new Error('DevFridge SDK did not initialize.')); return; }
      resolve(Constructor);
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('DevFridge SDK could not load.')); };
    document.head.append(script);
  }).catch(error => { sdkLoading = undefined; throw error; });
}

export async function readDevFridgeActiveLocks(wallet: string, tokens: EligibleToken[], SDK: SDKConstructor, now = Date.now()): Promise<VerifiedTimelock[]> {
  if (!wallet || !Number.isSafeInteger(now) || now < 0) throw new Error('A wallet and valid timestamp are required.');
  if (!tokens.length) throw new Error('Configure the eligible token mints and on-chain decimals before checking locks.');
  const mints = new Set<string>();
  for (const token of tokens) {
    if (token.programId !== REQUIRED_TOKEN_PROGRAM) throw new Error('Only verified Token-2022 mints are eligible. Replace legacy SPL token mints first.');
    if (!token.mint || mints.has(token.mint) || !Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 255) throw new Error('Invalid eligible token configuration.');
    mints.add(token.mint);
  }
  const results = await Promise.all(tokens.map(async token => {
    // Read via the SDK's public API. Its subscription plan result is not a market-value ranking.
    const sdk = new SDK({ tokenMint: token.mint, plans: { game: { minLockDays: 1, renewalThresholdDays: 0 } }, scannerUrl: DEVFRIDGE_SCANNER, fridgeUrl: DEVFRIDGE_LOCK_SOURCE, cacheTTL: 1 });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let status: SDKStatus;
    try {
      status = await Promise.race([sdk.checkSubscription(wallet), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('DevFridge lock lookup timed out.')), 15000); })]);
    } finally { clearTimeout(timeout); }
    if (!status || status.wallet !== wallet || !Array.isArray(status.activeLocks)) throw new Error('Invalid DevFridge SDK response.');
    const locks: VerifiedTimelock[] = [];
    for (const lock of status.activeLocks) {
      if (!lock || !lock.address || lock.depositor !== wallet || lock.mint !== token.mint || !Number.isSafeInteger(lock.createdAt) || !Number.isSafeInteger(lock.unlockAt) || lock.createdAt < 0 || lock.unlockAt <= lock.createdAt || !Number.isSafeInteger(lock.unlockAt * 1000)) throw new Error('DevFridge returned inconsistent lock data.');
      const amount = rawAmount(lock.amount);
      // Scanner timestamps are Unix seconds. The game's valuation clock is milliseconds.
      if (lock.unlockAt * 1000 <= now || amount === 0n) continue;
      locks.push({ id: lock.address, wallet, mint: token.mint, amount: lock.amount, decimals: token.decimals, unlockAt: lock.unlockAt * 1000 });
    }
    return locks;
  }));
  const locks = results.flat(), ids = new Set<string>();
  for (const lock of locks) { if (ids.has(lock.id)) throw new Error('Duplicate lock returned by DevFridge.'); ids.add(lock.id); }
  return locks;
}

/** Read-only integration helper. No wallet signing, entry authorization or token transfers. */
export async function determineDevFridgePaymentToken(wallet: string, tokens: EligibleToken[], priceReader: (mints: string[]) => Promise<VerifiedMarketPrice[]>, maxPriceAgeMs: number, SDK?: SDKConstructor) {
  const locks = await readDevFridgeActiveLocks(wallet, tokens, SDK ?? await loadDevFridgeSDK());
  const prices = await priceReader([...new Set(locks.map(lock => lock.mint))]);
  return { mint: highestValueLockedMint(wallet, locks, prices, Date.now(), maxPriceAgeMs), locks };
}
