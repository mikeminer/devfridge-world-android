/* Separate local practice. These results cannot create an authorized ranked run. */
(() => {
  'use strict';
  if (window.top !== window || location.origin !== 'https://world.devfridge.cool' || document.documentElement.dataset.devfridgeMode !== 'practice') return;
  const fetchAsset = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = new URL(input?.url || String(input), location.href);
    const method = String(options.method || input?.method || 'GET').toUpperCase();
    const bundledFile = url.origin === location.origin && url.pathname.startsWith('/world/game-v2/');
    const inMemoryAsset = (url.protocol === 'blob:' && url.origin === location.origin) || /^data:(?:image\/|audio\/|application\/(?:wasm|octet-stream))/.test(url.href);
    if ((!bundledFile && !inMemoryAsset) || method !== 'GET') {
      throw new Error('Local practice cannot access wallet, ranking or registration services.');
    }
    return fetchAsset(input, options);
  };
  window.XMLHttpRequest = class { constructor() { throw Error('Network APIs are unavailable in local practice.'); } };
  window.WebSocket = class { constructor() { throw Error('Network APIs are unavailable in local practice.'); } };
  window.EventSource = class { constructor() { throw Error('Network APIs are unavailable in local practice.'); } };
  window.addEventListener('wallet-standard:app-ready', event => event.stopImmediatePropagation(), true);
  window.addEventListener('wallet-standard:register-wallet', event => event.stopImmediatePropagation(), true);
  if (window.DevFridgeMobile) {
    const native = window.DevFridgeMobile;
    window.DevFridgeMobile = Object.freeze({ pause: native.pause, back: native.back, setSkrPerk: native.setSkrPerk,
      openRegistration: () => Promise.reject(Error('Practice scores are not eligible for TopShelf.')),
      signRegistration: () => Promise.reject(Error('Practice scores are not eligible for ranked signing.')),
    });
  }
  let game, notice, lastTick = 0, remaining = 60000, completed = false, interval;
  const snapshot = () => game?.snapshot();
  function finish() {
    if (!game || completed) return;
    completed = true; clearInterval(interval); interval = undefined;
    game.finish();
    if (notice) notice.textContent = 'Complete · local score';
  }
  function start() {
    clearInterval(interval); remaining = 60000; completed = false; lastTick = Date.now();
    const tick = () => {
      const now = Date.now(), elapsed = Math.max(0, Math.min(now - lastTick, 1500)); lastTick = now;
      const state = snapshot();
      if (!state) return;
      if (state.status !== 'playing') { completed = true; clearInterval(interval); interval = undefined; notice.textContent = 'Complete · local score'; return; }
      const paused = document.getElementById('paused');
      if (!document.hidden && !document.getElementById('dialog')?.open && (!paused || paused.hidden)) remaining = Math.max(0, remaining - elapsed);
      notice.textContent = `${Math.ceil(remaining / 1000)}s practice`;
      if (!remaining) finish();
    };
    tick(); interval = window.setInterval(tick, 250);
  }
  window.DevFridgePractice = Object.freeze({
    attach(hooks) { if (typeof hooks?.snapshot !== 'function' || typeof hooks?.finish !== 'function') throw Error('Invalid practice engine hooks'); game = hooks; },
    finish,
    createNotice(app) {
      const banner = document.createElement('aside'); banner.className = 'demo-notice'; banner.setAttribute('role', 'status');
      const title = document.createElement('strong'); title.textContent = 'PRACTICE';
      const details = document.createElement('span'); details.textContent = 'Local play · no ranking or prizes. Practice scores stay on this device. 60 seconds of active play.';
      notice = document.createElement('span'); notice.className = 'demo-countdown'; notice.textContent = '60s practice';
      const end = document.createElement('button'); end.className = 'secondary-button'; end.textContent = 'Finish practice'; end.type = 'button'; end.onclick = finish;
      banner.append(title, details, notice, end); app.prepend(banner);
      return { start, dispose() { clearInterval(interval); banner.remove(); } };
    },
  });
  document.addEventListener('click', event => {
    const target = event.target.closest?.('#again, #restart');
    if (target && game) start(); // The engine's target handler starts the new local run first.
  });
  const markResult = () => {
    const content = document.getElementById('dialog-content');
    const title = content?.querySelector('.result-title') ||
      (content?.querySelector('#again') && content?.querySelector('.result-score') ? content.querySelector('h2') : null);
    if (title && title.textContent !== 'Practice complete') {
      title.textContent = 'Practice complete';
      let note = title.nextElementSibling;
      if (note?.tagName !== 'P') { note = document.createElement('p'); title.after(note); }
      note.textContent = 'Local practice result. No verified leaderboard entry, entry fee or prize claim.';
    }
    for (const element of document.querySelectorAll('#kitchen-leaderboard, #kitchen-topshelf, [data-menu="leaderboard"], .score-registration-entry')) { element.hidden = true; element.style.setProperty('display', 'none', 'important'); }
  };
  let watchingResults = false;
  function watchResults() {
    const root = document.getElementById('app') || document.body;
    if (watchingResults || !root) return;
    watchingResults = true;
    new MutationObserver(markResult).observe(root, { childList: true, subtree: true });
    markResult();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchResults, { once: true });
  else watchResults();
})();
