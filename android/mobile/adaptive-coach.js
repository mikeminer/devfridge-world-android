/* On-device gameplay coach and recent local sessions. Nothing is sent to a server. */
(() => {
  'use strict';
  if (!window.__dfNativePort || window.top !== window || location.origin !== 'https://world.devfridge.cool') return;
  const historyKey = 'devfridge:coach:runs:v1';
  const feedbackKey = 'devfridge:coach:feedback:v1';
  const sessionsKey = 'devfridge:mobile:sessions:v1';
  const maxSessions = 20;
  const italian = /^it(?:-|$)/i.test(navigator.language || document.documentElement.lang || '');
  const read = (key, fallback) => {
    try { const parsed = JSON.parse(localStorage.getItem(key)); return parsed ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const validScore = value => Number.isSafeInteger(value) && value >= 0;
  const currentMode = () => document.documentElement.dataset?.devfridgeMode === 'practice' ? 'practice' : 'local';
  const modeLabel = mode => mode === 'practice' ? (italian ? 'Pratica locale' : 'Local practice') : (italian ? 'Partita locale' : 'Local session');
  function readSessions() {
    const rows = read(sessionsKey, []);
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => row && validScore(row.score) && Number.isSafeInteger(row.completedAt) && row.completedAt > 0 && row.completedAt <= Date.now() + 86400000)
      .slice(-maxSessions).map(row => ({ score: row.score, completedAt: row.completedAt, mode: row.mode === 'practice' ? 'practice' : 'local' }));
  }
  let sessions = readSessions(), storageWarning = false, historyDialog;
  function sessionHistory(content) {
    if (content.querySelector('[data-session-history]')) return;
    const card = document.createElement('details'); card.className = 'native-session-history'; card.dataset.sessionHistory = 'true';
    const summary = document.createElement('summary'); summary.textContent = italian ? 'Partite recenti' : 'Recent sessions';
    const body = document.createElement('div'); card.append(summary, body);
    function render() {
      body.replaceChildren();
      const note = document.createElement('p');
      note.textContent = italian ? 'Solo su questo dispositivo. Risultati locali, non verificati on-chain. Vengono conservate al massimo 20 partite completate.' : 'Only on this device. Local results, not verified on-chain. Up to 20 completed sessions are kept.';
      body.append(note);
      if (!sessions.length) {
        const empty = document.createElement('p'); empty.className = 'native-session-empty';
        empty.textContent = italian ? 'Non hai ancora completato una partita su questo dispositivo. Il risultato comparirà qui dopo la fine della partita.' : 'No completed sessions on this device yet. Your result will appear here after the run ends.';
        body.append(empty);
      } else {
        const comparable = sessions.filter(row => row.mode === currentMode()), goal = document.createElement('p'); goal.className = 'native-session-goal';
        if (comparable.length) {
          const formatted = Math.max(...comparable.map(row => row.score)).toLocaleString(italian ? 'it-IT' : 'en-US');
          goal.textContent = italian ? `Prossima partita: prova a superare ${formatted} punti, il tuo record tra queste partite nella stessa modalità.` : `Next run: try to beat ${formatted} points, your best among these sessions in the same mode.`;
        } else goal.textContent = italian ? 'Completa una partita in questa modalità per iniziare il tuo record locale.' : 'Complete a run in this mode to start your local personal best.';
        const list = document.createElement('ol'); list.className = 'native-session-list';
        for (const row of [...sessions].reverse()) {
          const item = document.createElement('li'), score = document.createElement('strong'), when = document.createElement('time');
          score.textContent = `${row.score.toLocaleString(italian ? 'it-IT' : 'en-US')} ${italian ? 'punti' : 'points'} · ${modeLabel(row.mode)}`;
          when.dateTime = new Date(row.completedAt).toISOString();
          when.textContent = new Date(row.completedAt).toLocaleString(italian ? 'it-IT' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
          item.append(score, when); list.append(item);
        }
        const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = italian ? 'Cancella partite recenti' : 'Clear recent sessions';
        clear.addEventListener('click', () => {
          if (write(sessionsKey, [])) { sessions = []; storageWarning = false; }
          else storageWarning = true;
          render();
        });
        body.append(goal, list, clear);
      }
      if (storageWarning) {
        const warning = document.createElement('p'); warning.setAttribute('role', 'status');
        warning.textContent = italian ? 'Memoria del dispositivo non disponibile: la cronologia non è stata aggiornata. I nuovi risultati rimangono visibili solo finché l’app resta aperta.' : 'Device storage is unavailable: saved history was not updated. New results remain visible only while the app stays open.';
        body.append(warning);
      }
    }
    render(); content.append(card);
  }
  function showHistory() {
    if (!document.body) return false;
    window.DevFridgeMobile?.pause();
    if (!historyDialog) {
      historyDialog = document.createElement('dialog'); historyDialog.className = 'native-session-dialog';
      historyDialog.setAttribute('aria-label', italian ? 'Partite recenti' : 'Recent sessions');
      // The existing native Back handler closes the first open dialog in DOM order.
      document.body.prepend(historyDialog);
    }
    historyDialog.replaceChildren();
    const title = document.createElement('h2'); title.textContent = italian ? 'Partite recenti' : 'Recent sessions';
    const content = document.createElement('div'), close = document.createElement('button');
    close.type = 'button'; close.className = 'dialog-close'; close.textContent = italian ? 'Chiudi' : 'Close';
    close.addEventListener('click', () => historyDialog.close());
    historyDialog.append(title, content, close); sessionHistory(content);
    content.querySelector('details').open = true;
    if (!historyDialog.open) historyDialog.showModal();
    return true;
  }
  const tips = [
    { id: 'discover', text: ['Try a few low-risk merges first; discovering more tiers gives you room to learn the fridge’s merge rhythm.', 'Prova alcune fusioni a basso rischio: scoprire più livelli ti aiuta a capire il ritmo delle fusioni.'] },
    { id: 'spacing', text: ['Leave a clear landing lane and use the shelves to keep matching pieces close without crowding the centre.', 'Lascia libera una corsia di atterraggio e usa i ripiani per avvicinare i pezzi uguali senza affollare il centro.'] },
    { id: 'pace', text: ['Your recent score trend is rising. Keep the spacing that worked and take a moment to read the next piece before each drop.', 'La tua media recente sta salendo. Mantieni le distanze che funzionano e osserva il prossimo pezzo prima di ogni lancio.'] },
    { id: 'reset', text: ['This run was below your recent average. Slow down for one move and aim the next piece beside its matching tier.', 'Questa partita è sotto la tua media recente. Rallenta per un lancio e mira accanto al livello uguale.'] },
  ];
  function readRatings() {
    const saved = read(feedbackKey, {}), ratings = {};
    for (const item of tips) {
      const value = saved?.[item.id];
      if (value && validScore(value.helpful) && value.helpful <= 1000 && validScore(value.unhelpful) && value.unhelpful <= 1000) ratings[item.id] = value;
    }
    return ratings;
  }
  function choose(score, discovered, history, ratings) {
    const recent = history.slice(-5).map(Number).filter(Number.isFinite);
    const average = recent.length >= 2 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const eligible = discovered < 6 ? ['discover', 'spacing'] : average && score < average * .8 ? ['reset', 'spacing'] : average && score > average * 1.2 ? ['pace', 'spacing'] : ['spacing', 'discover'];
    const total = Object.values(ratings).reduce((sum, item) => sum + item.helpful + item.unhelpful, 0);
    return eligible.map(id => {
      const rating = ratings[id] || { helpful: 0, unhelpful: 0 }, trials = rating.helpful + rating.unhelpful;
      const value = (rating.helpful + 1) / (trials + 2) + .3 * Math.sqrt(Math.log(total + 2) / (trials + 1));
      return { tip: tips.find(item => item.id === id), value };
    }).sort((a, b) => b.value - a.value || a.tip.id.localeCompare(b.tip.id))[0].tip;
  }
  function mount() {
    const content = document.getElementById('dialog-content');
    if (!content) return;
    if (content.querySelector('.mobile-menu-grid')) sessionHistory(content);
    if (!document.getElementById('again') || content.querySelector('[data-adaptive-coach]')) return;
    const scoreNode = content.querySelector('.result-score, #result-score');
    if (!scoreNode) return;
    const rawScore = [...scoreNode.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim();
    if (!/^\d[\d\s,.\u00a0\u202f]*$/.test(rawScore)) return;
    const digits = rawScore.replace(/[^0-9]/g, '');
    if (!digits) return;
    const score = Number(digits);
    if (!validScore(score)) return;
    const discovered = [...(content.querySelector('.share-grid')?.textContent || '')].filter(char => char !== '⬛' && !/\s/.test(char)).length;
    const savedScores = read(historyKey, []), history = Array.isArray(savedScores) ? savedScores.filter(validScore) : [];
    const tip = choose(score, discovered, history, readRatings());
    const card = document.createElement('section'); card.className = 'native-adaptive-coach'; card.dataset.adaptiveCoach = 'true';
    const heading = document.createElement('strong'); heading.textContent = italian ? 'COACH DI GIOCO · ADATTIVO E LOCALE' : 'ADAPTIVE GAME COACH · ON-DEVICE';
    const copy = document.createElement('p'); copy.textContent = tip.text[italian ? 1 : 0];
    const prompt = document.createElement('span'); prompt.textContent = italian ? 'Ti è stato utile?' : 'Was this useful?';
    const thanks = document.createElement('small'); thanks.hidden = true; thanks.textContent = italian ? 'Grazie: i prossimi consigli si adatteranno.' : 'Thanks — future tips will adapt.';
    card.append(heading, copy, prompt);
    for (const [label, helpful] of [[italian ? 'Sì' : 'Yes', true], [italian ? 'No' : 'No', false]]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', () => {
        const current = readRatings(), prior = current[tip.id] || { helpful: 0, unhelpful: 0 };
        current[tip.id] = { helpful: Math.min(1000, prior.helpful + Number(helpful)), unhelpful: Math.min(1000, prior.unhelpful + Number(!helpful)) };
        write(feedbackKey, current); card.querySelectorAll('button').forEach(item => { item.disabled = true; }); thanks.hidden = false;
      }, { once: true });
      card.append(button);
    }
    card.append(thanks); content.append(card);
    write(historyKey, [...history.filter(Number.isFinite), score].slice(-8));
    sessions = [...sessions, { score, completedAt: Date.now(), mode: currentMode() }].slice(-maxSessions);
    storageWarning = !write(sessionsKey, sessions);
    sessionHistory(content);
  }
  const start = () => {
    const root = document.getElementById('app') || document.body;
    if (!root) return;
    const observer = new MutationObserver(mount);
    observer.observe(root, { childList: true, subtree: true });
    mount();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.DevFridgeAdaptiveCoach = Object.freeze({ chooseTip: choose, showHistory });
})();
