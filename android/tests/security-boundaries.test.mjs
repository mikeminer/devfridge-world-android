import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// These are hostile synthetic inputs, never live-wallet or player/demo evidence.
// Default receipts remain the exact published beta.2; never relabel them for a new APK.
// To test a local signed candidate, set ALL FOUR explicit absolute/working-directory paths:
// SECURITY_BOUNDARIES_RECEIPT, SECURITY_RELEASE_RECEIPT, SECURITY_ASSETS_DIR, SECURITY_SIGNED_APK.
// The candidate inspector must verify the publisher signature, compiled build bytes and assets.
const candidateNames = ['SECURITY_BOUNDARIES_RECEIPT', 'SECURITY_RELEASE_RECEIPT', 'SECURITY_ASSETS_DIR', 'SECURITY_SIGNED_APK'];
const candidateCount = candidateNames.filter(name => process.env[name]).length;
assert.ok(candidateCount === 0 || candidateCount === candidateNames.length, 'Candidate verification requires all four explicit paths; partial overrides are forbidden');
const candidate = candidateCount > 0;
const receiptPath = candidate ? resolve(process.env.SECURITY_BOUNDARIES_RECEIPT) : new URL('../../evidence/2026-10-07/audit/signed-beta2-boundaries.json', import.meta.url);
const releasePath = candidate ? resolve(process.env.SECURITY_RELEASE_RECEIPT) : new URL('../../evidence/2026-10-06/beta2-release.json', import.meta.url);
const assetsPath = candidate ? resolve(process.env.SECURITY_ASSETS_DIR) : fileURLToPath(new URL('../app/src/main/assets/game/', import.meta.url));
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const release = JSON.parse(await readFile(releasePath, 'utf8'));
assert.equal(release.packageName, 'cool.devfridge.world');
assert.equal(release.certificateSha256, '2acabfed1ae887ed90e650a4446e5ef747de096f0fd6ea75a8948b75b06071ca');
assert.equal(release.signatureVerifiedV3, true);
assert.equal(receipt.apkSha256, release.sha256);
assert.equal(receipt.apkBytes, release.bytes);
assert.ok(Object.keys(receipt.checks).length > 0, 'An empty inspection receipt is not verification');
assert.ok(Object.values(receipt.checks).every(value => value === true));
for (const name of ['expected_package_version', 'one_exported_launcher_activity', 'test_receipt_and_invoker_activities_absent',
  'providers_non_exported', 'share_provider_authority_and_scoped_permission', 'exported_receiver_has_dump_permission',
  'backup_disabled', 'application_cleartext_disabled', 'manifest_references_inspected_share_paths',
  'manifest_references_inspected_network_policy', 'only_share_cache_is_exposed', 'network_default_cleartext_disabled',
  'only_loopback_cleartext_exception', 'no_custom_release_trust_anchors']) {
  assert.equal(receipt.checks[name], true, 'Required signed APK boundary inspection: ' + name);
}
if (candidate) {
  assert.equal(receipt.artifactKind, 'local-signed-candidate');
  assert.equal(release.artifactKind, 'local-signed-candidate');
  assert.equal(receipt.versionCode, release.versionCode);
  assert.equal(receipt.versionName, release.versionName);
  assert.equal(receipt.checks.publisher_certificate_verified, true);
  assert.equal(receipt.checks.compiled_classes_match_build, true);
  const apk = await readFile(resolve(process.env.SECURITY_SIGNED_APK));
  assert.equal(apk.length, release.bytes, 'The supplied signed candidate must match the inspected APK size');
  assert.equal(createHash('sha256').update(apk).digest('hex'), release.sha256, 'The supplied signed candidate must match the inspected APK hash');
}
console.info('Signed APK boundary test binding:', JSON.stringify({ versionName: release.versionName,
  versionCode: release.versionCode, apkSha256: release.sha256, artifactKind: candidate ? 'local-signed-candidate' : 'published-beta.2' }));
async function packaged(path) {
  assert.equal(receipt.checks['asset_matches_signed_apk:' + path], true, 'Inspector must compare this exact packaged asset: ' + path);
  const bytes = await readFile(resolve(assetsPath, path));
  assert.equal(bytes.length, receipt.assets[path].bytes, 'Tested asset size must match the inspected signed APK: ' + path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.assets[path].sha256, 'Tested bytes must match the inspected signed APK: ' + path);
  return bytes.toString('utf8');
}
const handoff = await packaged('registration-handoff.js');
const native = await packaged('native-bridge.js');
const gate = await packaged('assets/gate-2.js');
const require = createRequire(new URL('../package.json', import.meta.url));
const { Window } = require('happy-dom');
const scoreKey = 'devfridge:mobile:scores:v1';
const runId = '0x' + 'ab'.repeat(32), handoffId = 'a'.repeat(43), requestId = 'b'.repeat(43);
const hostile = '<img id="injected" src="x" onerror="globalThis.pwned=true"><svg onload="globalThis.pwned=true"></svg>';
const savedRun = () => ({ ticket: 'synthetic-ticket', runId, id: handoffId, wallet: 'synthetic-wallet', score: 42, ticks: 500, season: 1, savedAt: Date.now() - 1000 });
const pending = () => ({ request: requestId, runId, wallet: 'synthetic-wallet', score: 42, season: 1, expires: Date.now() + 60000, message: 'Synthetic exact authorization bytes', signature: null });

function domFixture(rows = [savedRun()]) {
  const window = new Window({ url: 'https://world.devfridge.cool/world/game-v2/index.html' });
  window.localStorage.setItem(scoreKey, JSON.stringify(rows));
  const calls = { fetch: [], opens: [], signs: [] };
  let responder = () => Response.json({});
  window.fetch = async (url, options) => { calls.fetch.push({ url: String(url), options }); return responder(url, options); };
  window.DevFridgeMobile = {
    pause() {},
    async openRegistration(id) { calls.opens.push(id); },
    async signRegistration(wallet, message) { calls.signs.push({ wallet, message }); return 'synthetic-signature'; },
  };
  vm.runInNewContext(handoff, { window, document: window.document, location: window.location, localStorage: window.localStorage, URL, AbortSignal, Date, Map, console });
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { window, calls, respond: value => { responder = value; }, close: () => window.happyDOM.abort() };
}
function noExecutableNodes(window) {
  assert.equal(window.document.querySelector('img,svg,script,iframe,object,embed'), null, 'Untrusted text must not create executable/embedded elements');
  assert.equal(window.pwned, undefined);
}

test('packaged saved-score UI treats poisoned stored metadata as text, never HTML or automatic authorization', async () => {
  const row = savedRun(); row.season = hostile;
  const f = domFixture([row]);
  try {
    f.window.DevFridgeRegistration.show();
    assert.ok(f.window.document.body.textContent.includes(hostile));
    noExecutableNodes(f.window);
    assert.equal(f.calls.fetch.length + f.calls.opens.length + f.calls.signs.length, 0);
  } finally { await f.close(); }
});

test('packaged handoff refuses malformed stored run IDs rather than constructing active UI from them', async () => {
  for (const value of [runId + hostile, 'javascript:alert(1)', '__proto__', '', null]) {
    const row = savedRun(); row.runId = value;
    const f = domFixture([row]);
    try {
      f.window.DevFridgeRegistration.show();
      assert.equal(f.window.document.querySelectorAll('section').length, 0);
      noExecutableNodes(f.window);
      assert.equal(f.calls.fetch.length + f.calls.signs.length + f.calls.opens.length, 0);
    } finally { await f.close(); }
  }
});

test('packaged server-error rendering does not parse attacker markup or open a wallet', async () => {
  const f = domFixture();
  try {
    f.respond(() => Response.json({ error: hostile }, { status: 403 }));
    f.window.DevFridgeRegistration.show();
    await f.window.document.querySelector('section button').onclick();
    assert.ok(f.window.document.body.textContent.includes(hostile));
    noExecutableNodes(f.window);
    assert.equal(f.calls.signs.length + f.calls.opens.length, 0);
  } finally { await f.close(); }
});

test('packaged exact authorization message is literal text and requires separate button approval', async () => {
  const f = domFixture();
  try {
    f.respond(() => Response.json({ ...pending(), message: hostile }));
    await f.window.DevFridgeRegistration.receive(requestId, runId);
    assert.equal(f.window.document.querySelector('pre').textContent, hostile);
    noExecutableNodes(f.window);
    assert.equal(f.calls.signs.length + f.calls.opens.length, 0);
    assert.equal(f.calls.fetch.filter(call => call.options.method === 'POST').length, 0);
    assert.equal(f.window.document.querySelector('dialog button').disabled, false);
  } finally { await f.close(); }
});

test('packaged authorization rejects request/run/wallet/score/season/expiry/message tampering before signing', async () => {
  const mutations = [{ request: 'c'.repeat(43) }, { runId: '0x' + 'cd'.repeat(32) }, { wallet: 'attacker' }, { score: 43 }, { score: '42' }, { season: 2 }, { expires: 0 }, { message: 'x'.repeat(16385) }, { message: {} }];
  for (const mutation of mutations) {
    const f = domFixture();
    try {
      f.respond(() => Response.json({ ...pending(), ...mutation }));
      await f.window.DevFridgeRegistration.receive(requestId, runId);
      assert.equal(f.window.document.querySelector('dialog button').disabled, true, JSON.stringify(mutation));
      assert.equal(f.calls.signs.length + f.calls.opens.length, 0);
      assert.equal(f.calls.fetch.filter(call => call.options.method === 'POST').length, 0);
    } finally { await f.close(); }
  }
});

test('packaged authorization changed after review is rejected at approval without signing or delivery', async () => {
  const f = domFixture(); let reads = 0;
  try {
    f.respond(() => Response.json({ ...pending(), message: ++reads === 1 ? 'Original exact message' : hostile }));
    await f.window.DevFridgeRegistration.receive(requestId, runId);
    await f.window.document.querySelector('dialog button').onclick();
    assert.match(f.window.document.querySelector('dialog').textContent, /Authorization changed/);
    noExecutableNodes(f.window);
    assert.equal(f.calls.signs.length + f.calls.opens.length, 0);
    assert.equal(f.calls.fetch.filter(call => call.options.method === 'POST').length, 0);
  } finally { await f.close(); }
});

test('packaged unsolicited registration returns cannot trigger an RPC or signature without a matching saved run', async () => {
  for (const [request, run] of [[hostile, runId], [requestId, '0x' + 'cd'.repeat(32)], [requestId, runId + hostile]]) {
    const f = domFixture();
    try {
      await f.window.DevFridgeRegistration.receive(request, run);
      assert.equal(f.calls.fetch.length + f.calls.signs.length + f.calls.opens.length, 0);
      noExecutableNodes(f.window);
    } finally { await f.close(); }
  }
});

function nativeFixture({ iframe = false, origin = 'https://world.devfridge.cool' } = {}) {
  const messages = []; let wallet;
  const port = { postMessage: raw => messages.push(JSON.parse(raw)) };
  const window = {
    __dfNativePort: port, addEventListener() {},
    dispatchEvent(event) { if (event.type === 'wallet-standard:register-wallet') event.detail({ register: value => { wallet = value; } }); },
  };
  window.top = iframe ? {} : window;
  const context = { window, location: { origin }, navigator: {}, crypto: webcrypto, Uint8Array,
    document: { readyState: 'loading', addEventListener() {} },
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    btoa: value => Buffer.from(value, 'binary').toString('base64'), atob: value => Buffer.from(value, 'base64').toString('binary'), setTimeout, clearTimeout,
  };
  vm.runInNewContext(native, context);
  return { wallet, messages, port, context };
}

test('packaged wallet adapter is absent in iframes and lookalike/non-HTTPS origins', () => {
  for (const options of [{ iframe: true }, { origin: 'https://world.devfridge.cool.evil.test' }, { origin: 'http://world.devfridge.cool' }, { origin: 'https://evil.test' }]) {
    const f = nativeFixture(options);
    assert.equal(f.wallet, undefined);
    assert.equal(f.context.window.DevFridgeMobile, undefined);
    assert.equal(f.messages.length, 0);
  }
});

test('packaged native reply ignores malformed/unknown/replayed IDs instead of inventing a wallet account', async () => {
  const f = nativeFixture();
  const promise = f.wallet.features['standard:connect'].connect();
  const request = f.messages.shift();
  const result = { address: '11111111111111111111111111111111', publicKey: Buffer.alloc(32).toString('base64') };
  f.port.onmessage({ data: '{broken' });
  f.port.onmessage({ data: JSON.stringify({ id: 'unknown', result }) });
  assert.equal(f.wallet.accounts.length, 0);
  f.port.onmessage({ data: JSON.stringify({ id: request.id, result }) });
  await promise;
  f.port.onmessage({ data: JSON.stringify({ id: request.id, result: { address: 'attacker' } }) });
  assert.equal(f.wallet.accounts[0].address, result.address);
});

test('packaged share rejects oversized, non-PNG and multiple files before invoking native sharing', async () => {
  const f = nativeFixture();
  for (const files of [[{ type: 'image/png', size: 4000001 }], [{ type: 'text/html', size: 10 }], [{ type: 'image/png', size: 1 }, { type: 'image/png', size: 1 }]]) {
    await assert.rejects(f.context.navigator.share({ text: hostile, files }), /one PNG/);
    assert.equal(f.messages.length, 0);
  }
});

test('packaged compliance gate displays hostile server refusal as text without entering the game', async () => {
  const window = new Window({ url: 'https://world.devfridge.cool/world/game-v2/index.html' });
  window.document.body.innerHTML = '<div id="world-gate"></div><main id="app" hidden></main><input id="g-y" value="1990"><input id="g-m" value="1"><input id="g-d" value="15"><input id="g-ok" type="checkbox" checked><p id="g-err"></p><button id="g-enter"></button>';
  const timerIds = new Set(); let postCount = 0;
  try {
    await vm.runInNewContext(`(async()=>{${gate}\n})()`, {
      document: window.document, navigator: { language: 'en' }, sessionStorage: window.sessionStorage, AbortController,
      setTimeout: fn => { timerIds.add(fn); return fn; }, clearTimeout: fn => timerIds.delete(fn),
      fetch: async (_url, options) => options.method === 'POST' ? (postCount++, Response.json({ error: hostile }, { status: 403 })) : Response.json({}),
    });
    await window.document.getElementById('g-enter').onclick();
    assert.equal(window.document.getElementById('g-err').textContent, hostile);
    noExecutableNodes(window);
    assert.equal(window.document.getElementById('app').hidden, true);
    assert.equal(window.sessionStorage.length, 0);
    assert.equal(postCount, 1);
    assert.equal(timerIds.size, 0);
  } finally { await window.happyDOM.abort(); }
});
