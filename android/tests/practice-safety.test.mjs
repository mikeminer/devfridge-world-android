import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { patchPracticeBundle } from '../scripts/prepare-practice.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const { Window } = require('happy-dom');
const source = await readFile(new URL('../mobile/practice.js', import.meta.url), 'utf8');

function fixture({ headOnly = false } = {}) {
  const window = new Window({ url: 'https://world.devfridge.cool/world/game-v2/index.html?mode=practice' });
  const requests = [], native = [];
  window.document.documentElement.dataset.devfridgeMode = 'practice';
  window.document.body.innerHTML = '<main id="app"></main>';
  if (headOnly) {
    window.document.body.remove();
    Object.defineProperty(window.document, 'readyState', { value: 'loading', configurable: true });
  }
  window.fetch = async (...args) => { requests.push(args); return { ok: true }; };
  window.DevFridgeMobile = { pause() {}, back() {}, setSkrPerk() {},
    openRegistration: () => native.push('openRegistration'), signRegistration: () => native.push('signRegistration') };
  vm.runInNewContext(source, { window, document: window.document, location: window.location, URL,
    MutationObserver: window.MutationObserver, Date, clearInterval, Error });
  if (!headOnly) window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { window, requests, native, close: () => window.happyDOM.abort() };
}

test('practice can fetch actual local model/blob assets but cannot send a ranked start, finish or fee request', async () => {
  const f = fixture();
  await f.window.fetch('/world/game-v2/models/rugarugo.glb');
  await f.window.fetch('blob:https://world.devfridge.cool/asset-image');
  await f.window.fetch('data:image/png;base64,iVBORw0KGgo=');
  assert.equal(f.requests.length, 3);
  for (const [url, options] of [
    ['/api/world/topshelf/register', { method: 'POST', body: JSON.stringify({ action: 'start' }) }],
    ['/api/world/topshelf/register', { method: 'POST', body: JSON.stringify({ action: 'finish', score: 1234 }) }],
    ['/api/world/topshelf', {}],
    ['https://api.mainnet.solana.com', { method: 'POST' }],
    ['/world/game-v2/models/rugarugo.glb', { method: 'POST' }],
    ['https://evil.test/world/game-v2/model.glb', {}],
    ['blob:https://evil.test/asset-image', {}],
    ['data:application/json,{"ranked":true}', {}],
  ]) await assert.rejects(f.window.fetch(url, options), /cannot access wallet, ranking or registration/);
  await assert.rejects(f.window.DevFridgeMobile.openRegistration('run'), /not eligible/);
  await assert.rejects(f.window.DevFridgeMobile.signRegistration('wallet', 'run'), /not eligible/);
  assert.equal(f.requests.length, 3, 'Forbidden calls must never reach network transport');
  assert.deepEqual(f.native, [], 'Forbidden calls must never reach registration transport');
  await f.close();
});

test('the head-loaded adapter waits for a body and labels an existing result after DOMContentLoaded', async () => {
  const f = fixture({ headOnly: true });
  assert.ok(f.window.DevFridgePractice, 'The practice engine API must initialize before the body exists');
  assert.equal(f.window.document.body, null);
  const body = f.window.document.createElement('body');
  body.innerHTML = '<main id="app"><dialog id="dialog"><div id="dialog-content"><h2>Gone off</h2><p>Full fridge</p><div class="result-score">20<span>points</span></div><button id="again">Again</button></div></dialog></main>';
  f.window.document.documentElement.append(body);
  f.window.document.dispatchEvent(new f.window.Event('DOMContentLoaded'));
  assert.equal(f.window.document.querySelector('h2').textContent, 'Practice complete');
  assert.match(f.window.document.querySelector('#dialog-content p').textContent, /No verified leaderboard entry/);
  f.window.document.getElementById('dialog-content').innerHTML = '<h2>Another run</h2><div class="result-score">40<span>points</span></div><button id="again">Again</button>';
  await f.window.happyDOM.waitUntilComplete();
  assert.equal(f.window.document.querySelector('h2').textContent, 'Practice complete');
  assert.equal(f.window.document.querySelector('.result-score').firstChild.textContent, '40');
  await f.close();
});

test('generated CSP permits in-memory texture fetches without permitting remote connections', async () => {
  const html = await readFile(new URL('../app/src/main/assets/game/practice/index.html', import.meta.url), 'utf8');
  const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
  assert.ok(policy, 'The generated practice page must include its CSP');
  const sources = policy.split(';').find(directive => directive.trim().startsWith('connect-src ')).trim().split(/\s+/).slice(1);
  assert.deepEqual(sources, ["'self'", 'blob:', 'data:'], 'Texture fetches require blob/data sources, never unrestricted HTTPS');
  assert.ok(!sources.includes('*') && !sources.includes('https:'));
  const f = fixture();
  await f.window.fetch('blob:https://world.devfridge.cool/decoded-texture');
  await assert.rejects(f.window.fetch('https://remote.test/decoded-texture'), /cannot access/);
  assert.equal(f.requests.length, 1);
  await f.close();
});

test('practice relabels actual engine results without changing a game-menu heading', async () => {
  const f = fixture();
  f.window.document.getElementById('app').innerHTML = '<dialog id="dialog"><div id="dialog-content"><h2>Game menu</h2></div></dialog>';
  await f.window.happyDOM.waitUntilComplete();
  assert.equal(f.window.document.querySelector('h2').textContent, 'Game menu');
  f.window.document.getElementById('dialog-content').innerHTML = '<h2>Game over</h2><p>Full fridge</p><div class="result-score">20<span>points</span></div><button id="again">Again</button>';
  await f.window.happyDOM.waitUntilComplete();
  assert.equal(f.window.document.querySelector('h2').textContent, 'Practice complete');
  assert.match(f.window.document.querySelector('#dialog-content p').textContent, /No verified leaderboard entry/);
  assert.equal(f.window.document.querySelector('.result-score').firstChild.textContent, '20');
  await f.close();
});

test('practice refuses a modified renderer instead of silently patching unknown code', () => {
  assert.throws(() => patchPracticeBundle('different renderer'), /source hash differs/);
});

test('finishing practice uses the actual engine callback once and keeps existing stored results', async () => {
  const f = fixture(); let finishes = 0;
  f.window.localStorage.setItem('devfridge:practice:demo:best', '900');
  const api = f.window.DevFridgePractice;
  api.attach({ snapshot: () => ({ score: 25, status: 'playing' }), finish: () => finishes++ });
  api.createNotice(f.window.document.getElementById('app'));
  api.finish(); api.finish();
  assert.equal(finishes, 1);
  assert.equal(f.window.localStorage.getItem('devfridge:practice:demo:best'), '900');
  assert.match(f.window.document.body.textContent, /no ranking or prizes/);
  assert.match(f.window.document.body.textContent, /Complete/);
  assert.equal(f.requests.length, 0);
  await f.close();
});
