import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { fetchPracticeAssets } from '../../scripts/fetch-practice-assets.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function patchPracticeBundle(source) {
  if (sha256(source) !== '5d8ccc87855b55da282c50824068c42301339777d15bf9fd3d74de7d3b75363d') throw Error('Practice source hash differs from the reviewed distribution');
  let result = source;
  const replacements = [];
  function exact(before, after, count, reason) {
    const matches = result.split(before).length - 1;
    if (matches !== count) throw Error(`Practice patch mismatch: ${reason}, expected ${count}, found ${matches}`);
    result = result.split(before).join(after);
    replacements.push({ reason, occurrences: count, beforeSha256: sha256(before), afterSha256: sha256(after) });
  }
  exact('/world/game/', '/world/game-v2/', 1, 'Use the existing pinned model, portrait and audio files');
  exact('cold-storage:', 'devfridge:practice:', 11, 'Isolate all demo engine storage from ranked and browser sessions');
  const start = result.indexOf('function i(e,t,r=a(t))');
  const end = result.indexOf('function a(e)', start);
  if (start < 0 || end - start !== 819) throw Error('Unexpected original demo timer function');
  exact(result.slice(start, end), 'function i(e,t){return window.DevFridgePractice.createNotice(e,t)}', 1,
    'Replace destructive demo reset with an explicit local practice timer and completion');
  exact('let e=Q;q_(e),Rv()', 'let e=Q;Rv()', 1, 'Never call ranked finish from a practice result');
  exact('Ov(),t?.start(),sv=', 'Ov(),window.DevFridgePractice.attach({snapshot:()=>({status:Q.status,seed:Q.seed,score:Q.score}),finish:()=>{if(Q.status===`playing`){Q.status=`practice-complete`;fv=!0;vv.clear();pv=0;Ov();Bv()}}}),t?.start(),sv=', 1,
    'Expose actual engine score and local completion without a ranked ticket');
  exact('DEVFRIDGE WORLD / COLD STORAGE', 'DEVFRIDGE WORLD / PRACTICE', 1, 'Mark the exported score image as practice');
  exact('CAN YOU BEAT MY SCORE?', 'CAN YOU BEAT MY PRACTICE SCORE?', 1, 'Mark the score image replay invitation as practice');
  exact('points in Cold Storage on DevFridge World!', 'points in local practice on DevFridge World. No ranking or prizes.', 1,
    'Mark the sharing caption as an unranked local result');
  return { bundle: result, replacements };
}

export async function preparePractice() {
  const { manifest, destination: source } = await fetchPracticeAssets();
  const destination = join(root, 'app/src/main/assets/game/practice');
  const original = await readFile(join(source, manifest.files[0].path), 'utf8');
  const { bundle, replacements } = patchPracticeBundle(original);
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'practice-game.js'), bundle);
  await cp(join(source, manifest.files[1].path), join(destination, 'practice-base.css'));
  await cp(join(root, 'mobile/practice.js'), join(destination, 'practice.js'));
  const html = `<!doctype html>
<html lang="en" data-devfridge-mode="practice"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#171b18"><meta name="robots" content="noindex, nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob: data:; img-src 'self' blob: data:; media-src 'self' blob: data:; object-src 'none'; base-uri 'none'">
<title>DevFridge World · Local Practice</title>
<link rel="stylesheet" href="/world/game-v2/practice/practice-base.css"><link rel="stylesheet" href="/world/game-v2/android.css">
<style>
html[data-devfridge-mode="practice"] .demo-notice { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:4px 8px; min-height:0; max-width:100%; padding:6px 10px; position:static; box-sizing:border-box; font-size:11px; line-height:1.25; box-shadow:none; text-align:left; }
html[data-devfridge-mode="practice"] .demo-notice strong { grid-area:1/1; min-width:0; font-size:12px; overflow-wrap:anywhere; }
html[data-devfridge-mode="practice"] .demo-notice > span:nth-child(2) { grid-area:2/1/3/-1; order:0; min-width:0; max-width:none; font-size:11px; white-space:normal; overflow-wrap:anywhere; }
html[data-devfridge-mode="practice"] .demo-countdown { grid-area:1/2; padding:5px 7px; font-size:11px; }
html[data-devfridge-mode="practice"] .demo-notice button { grid-area:1/3; box-sizing:border-box; height:40px; min-height:40px; max-height:44px; max-width:112px; margin:0; padding:6px 8px; font-size:12px; line-height:1.2; }
html[data-devfridge-mode="practice"] #dialog[open] { position:fixed; inset:12px; width:calc(100vw - 24px); min-width:0; max-width:calc(100vw - 24px); max-height:calc(100dvh - 24px); height:fit-content; margin:auto; padding:20px; overflow:auto; transform:none; box-sizing:border-box; }
</style>
<script src="/world/game-v2/native-bridge.js"></script><script src="/world/game-v2/practice/practice.js"></script><script src="/world/game-v2/adaptive-coach.js"></script>
<script type="module" src="/world/game-v2/practice/practice-game.js"></script>
</head><body><div id="app"></div></body></html>\n`;
  await writeFile(join(destination, 'index.html'), html);
  const overrides = [
    { path: 'practice/practice-game.js', sha256: sha256(bundle), replacements },
    { path: 'practice/practice.js', sha256: sha256(await readFile(join(root, 'mobile/practice.js'))) },
    { path: 'practice/index.html', sha256: sha256(html) },
  ];
  await writeFile(join(root, 'practice-provenance.json'), JSON.stringify({ source: manifest, overrides,
    mode: 'Local practice only: no ranking, fee, prizes or timelock authorization',
    sharedAssets: 'The existing hash-pinned game-provenance.json files provide models, portraits and audio',
  }, null, 2) + '\n');
  console.log('Bundled hash-pinned local practice renderer and physics with isolated results.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await preparePractice();
