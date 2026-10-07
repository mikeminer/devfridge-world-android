import type { CastMember } from './core';
import type { VerifiedTimelock } from './economy';
import { loadDevFridgeSDK, readDevFridgeActiveLocks } from './devfridge-locks';
import { MINIMUM_TIMELOCK_TOKENS, accessMessage, characterTokens, unlockedCharacters, verifyAccessSignature } from './access';
import { availableWallets, watchWalletRegistration, type GameWallet } from './wallet';

export interface GameAccess {
  address: string;
  favourite: number;
  allowed(): number[];
  valid(tier?: number): boolean;
  signRegistration(message: Uint8Array): Promise<Uint8Array>;
  refresh?(): Promise<void>;
  createTimelock?(mint: string, amount: string, unlockAt: number): Promise<{ signature: string; lockAddress: string }>;
  disconnect(): Promise<void>;
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export type TimelockAccess = Pick<GameAccess, 'address' | 'allowed' | 'refresh' | 'createTimelock'>;
export interface TimelockSession {
  current(): TimelockAccess | undefined;
  connect(choice: GameWallet): Promise<void>;
}
let timelockSession: TimelockSession | undefined;
export const getTimelockSession = () => timelockSession;

/** Message-only access gate; the optional timelock action separately requests wallet transaction approval. */
export async function requireTimelockAccess(root: HTMLElement, cast: CastMember[]): Promise<GameAccess> {
  const tokens = characterTokens(cast);
  const minimumLabel = MINIMUM_TIMELOCK_TOKENS.toLocaleString('en-US');
  let wallet: GameWallet | undefined, address = '', authenticated = false, busy = false, entered = false;
  let locks: VerifiedTimelock[] = [], checkedAt = 0, offAccount = () => {}, selectedTier = 0;
  root.innerHTML = `<main class="access-page"><a class="access-brand" href="https://world.devfridge.cool/" target="_top">❄ devfridge / world</a><div class="access-heading"><span class="eyebrow">COLD STORAGE · THE MEME KITCHEN</span><h1>Your meme.<br><em>In the fridge.</em></h1><p>Connect your Solana wallet. Lock at least ${minimumLabel} of any one of these 10 tokens in DevFridge to unlock its character.</p></div><section class="access-panel" aria-label="Wallet access"><h2 id="access-title">Connect your wallet</h2><p class="access-minimum"><strong>Minimum timelock: ${minimumLabel} tokens of the same type.</strong><br>Your active timelocks of the same token are added together. Different tokens do not combine. Keep at least this amount locked while you play.</p><p id="access-status" role="status" aria-live="polite">Connect to check your active timelocks.</p><div id="access-wallets" class="access-wallets"></div><div class="access-actions"><a class="secondary-button" href="https://docs.devfridge.cool/world" target="_blank" rel="noopener noreferrer">Game guide ↗</a><button id="access-check" class="secondary-button" hidden>Check my timelocks again</button><button id="access-disconnect" class="small-link" hidden>Disconnect wallet</button></div><p class="access-note">Sign a message to confirm your wallet. Playing is free. Your locked tokens stay in DevFridge.</p></section><div id="access-buy-invite" class="access-buy-invite" hidden><span class="eyebrow">UNLOCK YOUR CHARACTER</span><h2>Get your meme. Make it playable.</h2><p>Choose a token below and buy it on Pump.fun. Then lock at least ${minimumLabel} of that token in DevFridge and check again to unlock your character.</p><p>Already own the token? Go straight to <strong>Lock in DevFridge</strong>.</p></div><div class="access-collection-title"><h2>Choose your meme</h2><span>10 characters · Solana</span></div><div id="access-cast" class="access-cast"></div><p class="access-footer">Already locked a token? Recheck after the transaction confirms. <a href="https://devfridge.cool/" target="_blank" rel="noopener">Open DevFridge ↗</a></p></main>`;
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const status = (text: string) => { element('access-status').textContent = text; };
  const current = () => authenticated && wallet?.address() === address;
  const allowed = () => current() ? unlockedCharacters(address, cast, locks) : [];
  const valid = (tier = selectedTier) => current() && Date.now() - checkedAt < 120000 && allowed().includes(tier);
  const createTimelock = async (mint: string, amount: string, unlockAt: number) => {
    if (!current() || !wallet?.sendTransaction) throw Error('Reconnect a Solana wallet that supports transactions.');
    const signer = wallet, owner = address;
    const { prepareTimelock, timelockConnection } = await import('./devfridge-timelock');
    const prepared = await prepareTimelock(timelockConnection(), owner, cast, mint, amount, unlockAt);
    if (!current() || signer !== wallet || owner !== address) throw Error('Wallet changed. Reconnect before locking.');
    const signature = await signer.sendTransaction!(prepared.transaction.serialize({ requireAllSignatures: false, verifySignatures: false }));
    return { signature, lockAddress: prepared.lockAddress };
  };
  let finish: (access: GameAccess) => void;
  const ready = new Promise<GameAccess>(resolve => { finish = resolve; });
  const renderCast = () => {
    if (entered) return;
    const tiers = allowed();
    element('access-buy-invite').hidden = !authenticated || busy || checkedAt === 0 || tiers.length > 0;
    element('access-cast').innerHTML = cast.map(c => {
      const mint = encodeURIComponent(c.token!.mint), symbol = escape(c.token!.symbol);
      const badge = `<a class="access-lock-badge" href="https://scan.devfridge.cool/t/${mint}" target="_blank" rel="noopener" aria-label="Open the live ${symbol} timelock scan"><img src="https://scan.devfridge.cool/api/badge?mint=${mint}&amp;theme=dark&amp;style=full" width="420" height="90" loading="lazy" decoding="async" alt="Live ${symbol} badge showing the percentage of total supply locked in DevFridge"/></a>`;
      return `<article class="access-character ${tiers.includes(c.tier) ? 'unlocked' : ''}"><img src="${escape(c.png)}" alt=""/><div><span class="eyebrow">${symbol}</span><h3>${escape(c.name)}</h3><p>${tiers.includes(c.tier) ? 'Active timelock · unlocked' : authenticated ? 'Active timelock required' : 'Connect to check your lock'}</p><p class="access-minimum-token">Minimum lock: <strong>${minimumLabel} ${symbol}</strong></p></div>${badge}${tiers.includes(c.tier) ? `<button class="primary-button" data-enter="${c.tier}">Play as ${escape(c.name)} ↗</button>` : `<div class="access-token-actions"><a class="primary-button" href="https://pump.fun/coin/${mint}" target="_blank" rel="noopener">Buy ${symbol} ↗</a><div class="access-ca"><label for="ca-${c.tier}">Solana CA</label><input id="ca-${c.tier}" value="${escape(c.token!.mint)}" readonly spellcheck="false" aria-label="${symbol} contract address"/><button class="secondary-button" data-copy-ca="${c.tier}" aria-label="Copy ${symbol} contract address">Copy CA</button><span id="ca-status-${c.tier}" role="status" aria-live="polite"></span></div><a class="secondary-button" href="https://devfridge.cool/?mint=${mint}" target="_blank" rel="noopener">Lock in DevFridge ↗</a></div>`}</article>`;
    }).join('');
    element('access-cast').querySelectorAll<HTMLInputElement>('.access-ca input').forEach(input => { input.onclick = () => input.select(); });
    element('access-cast').querySelectorAll<HTMLButtonElement>('[data-copy-ca]').forEach(button => {
      button.onclick = async () => {
        const tier = Number(button.dataset.copyCa), member = cast.find(c => c.tier === tier);
        if (!member?.token) return;
        const input = element<HTMLInputElement>(`ca-${tier}`), feedback = element(`ca-status-${tier}`);
        try {
          await navigator.clipboard.writeText(member.token.mint);
          button.textContent = 'Copied!'; feedback.textContent = 'Contract address copied.';
        } catch {
          input.focus(); input.select(); feedback.textContent = 'Select and copy the address above.';
        }
      };
    });
    element('access-cast').querySelectorAll<HTMLButtonElement>('[data-enter]').forEach(button => {
      button.disabled = busy;
      button.onclick = () => {
        selectedTier = Number(button.dataset.enter);
        if (!valid() || busy) { status('Recheck your timelocks before entering.'); return; }
        entered = true; offRegistration();
        finish({ address, favourite: selectedTier, allowed, valid, refresh, createTimelock,
          async signRegistration(message) {
            if (!wallet || !current() || !valid()) throw Error('Reconnect your Solana wallet and recheck your timelock.');
            const signed = await wallet.sign(message);
            if (!current() || !verifyAccessSignature(address, message, signed.signature, signed.signedMessage)) throw Error('Score authorization was not signed by the connected Solana wallet.');
            return signed.signature;
          },
          async disconnect() { authenticated = false; offAccount(); try { await wallet?.disconnect(); } finally { location.reload(); } } });
      };
    });
  };
  const refresh = async () => {
    if (busy || !current()) return;
    busy = true;
    if (!entered) { status('Checking your active timelocks on DevFridge…'); element<HTMLButtonElement>('access-check').disabled = true; renderCast(); }
    const checkingAddress = address;
    try {
      const result = await readDevFridgeActiveLocks(checkingAddress, tokens, await loadDevFridgeSDK());
      if (!current() || checkingAddress !== address) return;
      locks = result; checkedAt = Date.now();
      if (!entered) status(allowed().length ? `${allowed().length} meme${allowed().length === 1 ? '' : 's'} unlocked. Choose your character below.` : 'No active character timelock meets the 500,000-token minimum. Buy or lock more of your chosen token, then check again.');
    } catch {
      locks = []; checkedAt = 0;
      if (!entered) status('DevFridge could not verify your timelocks. Check your connection and try again.');
    } finally {
      busy = false;
      if (!entered) { element<HTMLButtonElement>('access-check').disabled = false; renderCast(); }
    }
  };
  const connect = async (choice: GameWallet) => {
    if (busy || entered) return;
    busy = true; authenticated = false; locks = []; offAccount(); wallet = choice;
    renderWallets(); renderCast(); status(`Connecting to ${choice.name}…`);
    try {
      address = await choice.connect();
      let changed = false;
      offAccount = choice.watch(() => {
        if (choice.address() !== address) {
          changed = true; authenticated = false; locks = [];
          if (!entered) { status('Wallet changed or disconnected. Connect and sign in again.'); renderCast(); renderWallets(); }
        }
      });
      status('Confirm the sign-in message in your wallet.');
      const issuedAt = Date.now();
      const message = accessMessage(address, location.origin, crypto.randomUUID().replaceAll('-', ''), issuedAt);
      const signed = await choice.sign(message);
      if (changed || choice.address() !== address || Date.now() - issuedAt > 300000 || !verifyAccessSignature(address, message, signed.signature, signed.signedMessage)) throw new Error('Wallet verification failed. Please reconnect and try again.');
      authenticated = true;
      element('access-title').textContent = `${address.slice(0, 6)}…${address.slice(-4)} connected`;
      element('access-check').hidden = false; element('access-disconnect').hidden = false;
    } catch {
      authenticated = false;
      status('Connection or signature was not completed. Unlock your wallet, select a Solana account, and try again.');
    } finally { busy = false; renderWallets(); }
    if (authenticated) await refresh();
  };
  const renderWallets = () => {
    if (entered) return;
    const choices = availableWallets();
    const container = element('access-wallets'); container.replaceChildren();
    if (authenticated) return;
    if (!choices.length) {
      container.innerHTML = '<p>No Solana wallet detected. Open this page in your wallet’s browser, or enable your wallet extension in Chrome.</p><a class="secondary-button" href="https://phantom.com/" target="_blank" rel="noopener">Get Phantom ↗</a>';
    }
    for (const choice of choices) {
      const button = document.createElement('button'); button.className = 'primary-button'; button.textContent = `Connect ${choice.name}`; button.disabled = busy;
      button.onclick = () => { void connect(choice); }; container.append(button);
    }
  };
  timelockSession = {
    current: () => current() ? { address, allowed, refresh, createTimelock } : undefined,
    async connect(choice) {
      await connect(choice);
      if (!current()) throw Error('Wallet connection or sign-in was not completed. Please try again.');
    },
  };
  element('access-check').onclick = () => { void refresh(); };
  element('access-disconnect').onclick = async () => { authenticated = false; offAccount(); try { await wallet?.disconnect(); } finally { location.reload(); } };
  const offRegistration = watchWalletRegistration(renderWallets);
  renderWallets(); renderCast();
  // Extensions may inject after document startup. No connection is requested automatically.
  setTimeout(renderWallets, 1000);
  const timer = window.setInterval(() => { if (current()) void refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current()) void refresh(); });
  window.addEventListener('pagehide', () => { clearInterval(timer); offAccount(); offRegistration(); }, { once: true });
  return ready;
}
