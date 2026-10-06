import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const { Window } = require('happy-dom');
const code = await readFile(new URL('../mobile/adaptive-coach.js', import.meta.url), 'utf8');
const key = 'devfridge:mobile:sessions:v1';

function fixture({ saved, language = 'en-US', unavailable = false, native = true, mode, origin = 'https://world.devfridge.cool' } = {}) {
  const window = new Window({ url: `${origin}/world/game-v2/index.html` });
  if (native) window.__dfNativePort = {};
  Object.defineProperty(window.navigator, 'language', { value: language });
  if (mode) window.document.documentElement.dataset.devfridgeMode = mode;
  window.document.body.innerHTML = '<main id="app"><dialog id="dialog"><div id="dialog-content"></div></dialog></main>';
  if (saved !== undefined) window.localStorage.setItem(key, saved);
  const storage = unavailable ? { getItem: name => window.localStorage.getItem(name), setItem() { throw Error('Storage unavailable'); } } : window.localStorage;
  vm.runInNewContext(code, {
    window, document: window.document, navigator: window.navigator, location: window.location,
    localStorage: storage, MutationObserver: window.MutationObserver, Date,
  });
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return {
    window,
    content: window.document.getElementById('dialog-content'),
    rows: () => JSON.parse(window.localStorage.getItem(key) || '[]'),
    async flush() { await window.happyDOM.waitUntilComplete(); },
    close: () => window.happyDOM.abort(),
  };
}
async function menu(f) {
  f.content.innerHTML = '<div class="mobile-menu-grid"><button>How to play</button></div>';
  await f.flush();
}
async function result(f, score) {
  // Simulates the engine's completed-result DOM, not a production/demo session.
  f.content.innerHTML = `<div class="result-score">${score}<span> points</span></div><div class="share-grid">🍋⬛</div><button id="again">Play again</button>`;
  await f.flush();
}

test('a fresh mobile menu shows an honest empty state without inventing a session', async () => {
  const f = fixture(); await menu(f);
  assert.match(f.content.textContent, /No completed sessions/);
  assert.match(f.content.textContent, /not verified on-chain/);
  assert.equal(f.content.querySelectorAll('.native-session-list li').length, 0);
  assert.equal(f.rows().length, 0);
  assert.equal(f.window.localStorage.getItem(key), null);
  await f.close();
});

test('the native history hook opens outside the game, restores real saved rows, and creates no session', async () => {
  const saved = JSON.stringify([{ score: 1250, completedAt: Date.now() - 1000, mode: 'practice' }]);
  const f = fixture({ saved, mode: 'practice' });
  f.window.document.getElementById('app').remove();
  let pauses = 0; f.window.DevFridgeMobile = { pause() { pauses++; } };
  assert.equal(f.window.DevFridgeAdaptiveCoach.showHistory(), true);
  const dialog = f.window.document.querySelector('dialog[open]');
  assert.equal(dialog.className, 'native-session-dialog');
  assert.match(dialog.textContent, /1,250 points · Local practice/);
  assert.equal(dialog.querySelector('details').open, true);
  assert.equal(f.window.localStorage.getItem(key), saved);
  f.window.DevFridgeAdaptiveCoach.showHistory();
  assert.equal(f.window.document.querySelectorAll('.native-session-dialog').length, 1);
  assert.equal(dialog.querySelectorAll('.native-session-list li').length, 1);
  assert.equal(pauses, 2);
  dialog.querySelector('.dialog-close').click();
  assert.equal(dialog.open, false);
  assert.equal(f.window.localStorage.getItem(key), saved);
  await f.close();
});

test('a completed result is saved once despite later DOM updates and is restored after restart', async () => {
  const f = fixture(); await result(f, '1,250');
  const saved = f.window.localStorage.getItem(key);
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0].score, 1250);
  assert.ok(f.rows()[0].completedAt > 0);
  f.content.append(f.window.document.createElement('p')); await f.flush();
  f.content.querySelector('.native-adaptive-coach button').click(); await f.flush();
  assert.equal(f.window.localStorage.getItem(key), saved);
  assert.equal(f.content.querySelectorAll('[data-session-history]').length, 1);
  const g = fixture({ saved }); await menu(g);
  assert.match(g.content.textContent, /try to beat 1,250 points/);
  assert.equal(g.content.querySelectorAll('.native-session-list li').length, 1);
  assert.equal(g.rows().length, 1);
  await f.close(); await g.close();
});

test('the history keeps at most 20 valid completed results and the replay goal uses that window', async () => {
  const completedAt = Date.now() - 10000;
  const saved = JSON.stringify([{ score: '9000', completedAt }, { score: 9000, completedAt: -1 }, ...Array.from({ length: 25 }, (_, index) => ({ score: index, completedAt: completedAt + index }))]);
  const f = fixture({ saved }); await result(f, 0);
  assert.equal(f.rows().length, 20);
  assert.equal(f.rows()[0].score, 6);
  assert.equal(f.rows().at(-1).score, 0);
  assert.match(f.content.textContent, /try to beat 24 points/);
  assert.equal(f.content.querySelectorAll('.native-session-list li').length, 20);
  await f.close();
});

test('clearing local history persists and does not reset the game or trigger wallet/network actions', async () => {
  const f = fixture({ language: 'it-IT' }); await result(f, 42);
  let restarts = 0; f.content.querySelector('#again').onclick = () => restarts++;
  f.content.querySelector('.native-session-history button').click(); await f.flush();
  assert.equal(f.rows().length, 0);
  assert.equal(restarts, 0);
  assert.match(f.content.textContent, /Non hai ancora completato/);
  const g = fixture({ saved: f.window.localStorage.getItem(key) }); await menu(g);
  assert.match(g.content.textContent, /No completed sessions/);
  await f.close(); await g.close();
});

test('unavailable storage is visible and never claims a result survived restart', async () => {
  const f = fixture({ unavailable: true }); await result(f, 42);
  assert.match(f.content.textContent, /Device storage is unavailable/);
  assert.match(f.content.textContent, /only while the app stays open/);
  assert.equal(f.rows().length, 0);
  assert.equal(f.content.querySelectorAll('.native-session-list li').length, 1);
  await menu(f);
  assert.equal(f.content.querySelectorAll('.native-session-list li').length, 1);
  const g = fixture(); await menu(g);
  assert.match(g.content.textContent, /No completed sessions/);
  await f.close(); await g.close();
});

test('malformed storage and non-result text create no phantom score', async () => {
  const f = fixture({ saved: '{broken' });
  f.window.localStorage.setItem('devfridge:coach:runs:v1', '{}');
  f.window.localStorage.setItem('devfridge:coach:feedback:v1', 'null');
  await result(f, 'No score'); assert.equal(f.window.localStorage.getItem(key), '{broken');
  await result(f, '-42'); assert.equal(f.window.localStorage.getItem(key), '{broken');
  await result(f, '9007199254740992'); assert.equal(f.window.localStorage.getItem(key), '{broken');
  await result(f, 42); assert.equal(f.rows()[0].score, 42);
  f.window.localStorage.setItem('devfridge:coach:feedback:v1', 'true');
  f.content.querySelector('.native-adaptive-coach button').click(); await f.flush();
  assert.equal(f.rows().length, 1);
  await f.close();
});

test('practice results remain labelled local and the personal goal never compares different modes', async () => {
  const saved = JSON.stringify([{ score: 9000, completedAt: Date.now() - 1000, mode: 'local' }]);
  const f = fixture({ saved, mode: 'practice' });
  f.content.innerHTML = '<div id="result-score">42<span> pts · World v2</span></div><button id="again">Play again</button>';
  await f.flush();
  assert.equal(f.rows().at(-1).score, 42);
  assert.equal(f.rows().at(-1).mode, 'practice');
  assert.match(f.content.textContent, /42 points · Local practice/);
  assert.match(f.content.textContent, /try to beat 42 points/);
  assert.doesNotMatch(f.content.querySelector('.native-session-goal').textContent, /9,000/);
  await f.close();
});

test('ordinary web pages and foreign origins do not record mobile session data', async () => {
  for (const options of [{ native: false }, { origin: 'https://foreign.test' }]) {
    const f = fixture(options); await result(f, 42);
    assert.equal(f.rows().length, 0);
    assert.equal(f.content.querySelector('[data-session-history]'), null);
    await f.close();
  }
});
