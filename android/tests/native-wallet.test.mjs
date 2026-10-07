import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

const code = await readFile(new URL('../mobile/native-bridge.js', import.meta.url), 'utf8');
function fixture({ iframe = false, origin = 'https://world.devfridge.cool', timers = { setTimeout, clearTimeout } } = {}) {
  const messages = [], events = new Map(), classes = new Set(); let wallet;
  const port = { postMessage: raw => messages.push(JSON.parse(raw)) };
  const window = {
    __dfNativePort: port,
    addEventListener: (name, fn) => events.set(name, fn),
    dispatchEvent: event => { if (event.type === 'wallet-standard:register-wallet') event.detail({ register: value => { wallet = value; } }); },
  };
  window.top = iframe ? {} : window;
  const context = { window, location: { origin }, navigator: {}, crypto: webcrypto, Uint8Array,
    document: { readyState: 'loading', addEventListener() {}, documentElement: { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } } },
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'), setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
  };
  vm.runInNewContext(code, context);
  const reply = (result, error) => {
    const message = messages.shift(); assert.ok(message, 'a native request must exist');
    port.onmessage({ data: JSON.stringify({ id: message.id, result, error }) });
    return message;
  };
  return { wallet, messages, reply, port, context, classes };
}
const identity = { address: '11111111111111111111111111111111', publicKey: Buffer.alloc(32).toString('base64') };

function fakeClock() {
  let now = 0, nextId = 0;
  const jobs = new Map();
  return {
    setTimeout: (callback, delay) => { const id = ++nextId; jobs.set(id, { callback, deadline: now + delay }); return id; },
    clearTimeout: id => jobs.delete(id),
    get size() { return jobs.size; },
    advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const due = [...jobs].filter(([, job]) => job.deadline <= target).sort((a, b) => a[1].deadline - b[1].deadline)[0];
        if (!due) break;
        now = due[1].deadline; jobs.delete(due[0]); due[1].callback();
      }
      now = target;
    },
  };
}

test('registers only in the main frame on the first-party origin', () => {
  assert.ok(fixture().wallet);
  assert.equal(fixture({ iframe: true }).wallet, undefined);
  assert.equal(fixture({ origin: 'https://evil.test' }).wallet, undefined);
});

test('silent connection never opens a wallet or invents an account', async () => {
  const f = fixture();
  assert.equal((await f.wallet.features['standard:connect'].connect({ silent: true })).accounts.length, 0);
  assert.equal(f.messages.length, 0);
});

test('signing preserves exact bytes, rejects the wrong account, and clears on disconnect', async () => {
  const f = fixture(), features = f.wallet.features, changes = [];
  features['standard:events'].on('change', value => changes.push(value.accounts));
  const connecting = features['standard:connect'].connect(); f.reply(identity);
  const { accounts: [account] } = await connecting;
  assert.equal(account.address, identity.address);
  assert.equal(account.publicKey.length, 32);
  const message = Uint8Array.from([0, 127, 128, 255, 10]);
  const signing = features['solana:signMessage'].signMessage({ account, message });
  const sent = f.reply({ signature: Buffer.alloc(64, 7).toString('base64') });
  assert.equal(sent.method, 'signMessage');
  assert.deepEqual(Buffer.from(sent.params.message, 'base64'), Buffer.from(message));
  const [signed] = await signing;
  assert.deepEqual(signed.signedMessage, message);
  assert.equal(signed.signature.length, 64);
  await assert.rejects(features['solana:signMessage'].signMessage({ account: { address: 'wrong' }, message }), /same wallet/);
  const disconnecting = features['standard:disconnect'].disconnect(); f.reply({}); await disconnecting;
  assert.equal(f.wallet.accounts.length, 0);
  assert.equal(changes.length, 2);
});

test('wallet refusal propagates and never grants access', async () => {
  const f = fixture();
  const connecting = f.wallet.features['standard:connect'].connect();
  f.reply(null, 'User rejected the request');
  await assert.rejects(connecting, /User rejected/);
  assert.equal(f.wallet.accounts.length, 0);
});

test('invalid signatures and oversized payloads fail instead of returning success', async () => {
  const f = fixture(), features = f.wallet.features;
  const connecting = features['standard:connect'].connect(); f.reply(identity);
  const { accounts: [account] } = await connecting;
  await assert.rejects(features['solana:signMessage'].signMessage({ account, message: new Uint8Array(16385) }), /length/);
  const signing = features['solana:signMessage'].signMessage({ account, message: new Uint8Array([1]) });
  f.reply({ signature: Buffer.alloc(63).toString('base64') });
  await assert.rejects(signing, /Invalid wallet signature/);
  assert.equal(f.messages.length, 0);
});

test('share capability reports actual native support', () => {
  const { navigator } = fixture().context;
  assert.equal(navigator.canShare({ files: [{ type: 'image/png', size: 5000 }] }), true);
  assert.equal(navigator.canShare({ files: [{ type: 'image/png', size: 5000000 }] }), false);
  assert.equal(navigator.canShare({ files: [{ type: 'image/jpeg', size: 5000 }] }), false);
});

test('SKR cosmetic benefit only changes local styling and accepts booleans', () => {
  const f = fixture();
  assert.equal(f.context.window.DevFridgeMobile.setSkrPerk(true), true);
  assert.equal(f.classes.has('skr-perk-active'), true);
  assert.equal(f.context.window.DevFridgeMobile.setSkrPerk('yes'), false);
  assert.equal(f.messages.length, 0);
  f.context.window.DevFridgeMobile.setSkrPerk(false);
  assert.equal(f.classes.has('skr-perk-active'), false);
});

test('slow wallet approval and sequential reauthorization/signing remain pending until their native reply', async () => {
  const timers = fakeClock(), f = fixture({ timers }), features = f.wallet.features;
  let settled = false;
  const connecting = features['standard:connect'].connect();
  connecting.then(() => { settled = true; }, () => { settled = true; });
  timers.advance(300000); await Promise.resolve();
  assert.equal(settled, false, 'approval can outlast the old 120-second bridge deadline');
  assert.equal(f.wallet.accounts.length, 0);
  f.reply(identity);
  const { accounts: [account] } = await connecting;
  assert.equal(timers.size, 0, 'a native reply clears the deadline');

  settled = false;
  const message = new Uint8Array([1, 2, 3]);
  const signing = features['solana:signMessage'].signMessage({ account, message });
  signing.then(() => { settled = true; }, () => { settled = true; });
  timers.advance(300000); await Promise.resolve();
  assert.equal(settled, false, 'reauthorization may consume the first RPC budget');
  timers.advance(300000); await Promise.resolve();
  assert.equal(settled, false, 'signing may consume the second RPC budget');
  f.reply({ signature: Buffer.alloc(64, 7).toString('base64') });
  assert.deepEqual((await signing)[0].signedMessage, message);
  assert.equal(timers.size, 0);

  settled = false;
  const disconnecting = features['standard:disconnect'].disconnect();
  disconnecting.then(() => { settled = true; }, () => { settled = true; });
  timers.advance(300000); await Promise.resolve();
  assert.equal(settled, false);
  f.reply({}); await disconnecting;
  assert.equal(f.wallet.accounts.length, 0);
  assert.equal(timers.size, 0);
});

test('wallet timeout frees pending capacity, ignores late approval and permits a fresh request', async () => {
  const timers = fakeClock(), f = fixture({ timers });
  const requests = Array.from({ length: 8 }, () => f.wallet.features['standard:connect'].connect());
  const expired = Promise.all(requests.map(request => assert.rejects(request, /timed out/)));
  await assert.rejects(f.wallet.features['standard:connect'].connect(), /current action/);
  const lateMessages = f.messages.splice(0);
  timers.advance(329999); await Promise.resolve();
  assert.equal(timers.size, 8);
  timers.advance(1); await expired;
  assert.equal(timers.size, 0);
  for (const message of lateMessages) f.port.onmessage({ data: JSON.stringify({ id: message.id, result: identity }) });
  assert.equal(f.wallet.accounts.length, 0, 'expired approvals cannot grant an account');
  const retry = f.wallet.features['standard:connect'].connect(); f.reply(identity);
  assert.equal((await retry).accounts.length, 1);
  assert.equal(timers.size, 0);
});

test('non-wallet sharing keeps its shorter timeout and a timed-out signing request can be retried', async () => {
  const timers = fakeClock(), f = fixture({ timers });
  const sharing = f.context.navigator.share({ text: 'Local score' });
  const shareExpired = assert.rejects(sharing, /timed out/);
  f.messages.shift();
  timers.advance(119999); await Promise.resolve(); assert.equal(timers.size, 1);
  timers.advance(1); await shareExpired; assert.equal(timers.size, 0);

  const connecting = f.wallet.features['standard:connect'].connect(); f.reply(identity);
  const { accounts: [account] } = await connecting;
  const input = { account, message: new Uint8Array([4, 5]) };
  const signing = f.wallet.features['solana:signMessage'].signMessage(input);
  const signExpired = assert.rejects(signing, /timed out/);
  const late = f.messages.shift();
  timers.advance(629999); await Promise.resolve(); assert.equal(timers.size, 1);
  timers.advance(1); await signExpired; assert.equal(timers.size, 0);
  f.port.onmessage({ data: JSON.stringify({ id: late.id, result: { signature: Buffer.alloc(64, 7).toString('base64') } }) });
  const retry = f.wallet.features['solana:signMessage'].signMessage(input);
  f.reply({ signature: Buffer.alloc(64, 9).toString('base64') });
  assert.equal((await retry)[0].signature[0], 9);
  assert.equal(timers.size, 0);
});
