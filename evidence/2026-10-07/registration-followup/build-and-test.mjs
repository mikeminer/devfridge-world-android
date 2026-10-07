import { readFile, writeFile, mkdir, mkdtemp, copyFile, symlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

// Reuses the existing build script unchanged. No production output is targeted.
const out = dirname(fileURLToPath(import.meta.url));
const repo = resolve(out, '../../..');
const canonical = process.argv[2] && resolve(process.argv[2]);
if (!canonical) throw Error('Pass the original monorepo root containing cold-storage.');
const sha = data => createHash('sha256').update(data).digest('hex');
const stamp = new Date().toISOString().replaceAll(':', '-');
const summary = { startedAtUtc: new Date().toISOString(), attempt: stamp,
  scope: 'Generated external registration-page integration tests; API and Phantom fixtures, no live wallet or payment.',
  inputs: [], commands: [], unchangedOriginalEvidence: [] };
const originalPaths = [
  'SECURITY-VERIFICATION-2026-10-07.md',
  'evidence/2026-10-07/audit/javascript-tests.json',
  'evidence/2026-10-07/audit/node-full-suite.txt',
  'evidence/2026-10-07/audit/node-security-boundaries.txt',
];
for (const path of originalPaths) summary.unchangedOriginalEvidence.push({ path, beforeSha256: sha(await readFile(join(repo, path))) });
const stage = await mkdtemp(join(dirname(repo), 'registration-followup-stage-'));
summary.stagingDirectory = stage;
await mkdir(join(stage, 'android/scripts'), { recursive: true });
await mkdir(join(stage, 'android/mobile'), { recursive: true });
await mkdir(join(stage, 'cold-storage/src'), { recursive: true });
await mkdir(join(out, 'bundle'), { recursive: true });
const inputs = [
  [repo, 'android/scripts/build-registration-page.mjs'],
  [repo, 'android/mobile/registration-page.ts'],
  [repo, 'android/mobile/registration-page.html'],
  [repo, 'android/mobile/native-signing.ts'],
  [canonical, 'cold-storage/src/score-registration.ts'],
  [canonical, 'cold-storage/src/score-protocol.ts'],
  [canonical, 'cold-storage/package.json'],
];
for (const [base, path] of inputs) {
  const source = join(base, path), target = join(stage, path);
  await copyFile(source, target);
  const original = await readFile(source), copy = await readFile(target);
  if (!original.equals(copy)) throw Error(`Input copy differs: ${path}`);
  summary.inputs.push({ origin: base === repo ? 'focused repository' : 'original monorepo', path, bytes: copy.length, sha256: sha(copy) });
}
summary.inputs.push({ origin: 'original monorepo', path: 'cold-storage/package-lock.json',
  sha256: sha(await readFile(join(canonical, 'cold-storage/package-lock.json'))) });
await symlink(join(canonical, 'cold-storage/node_modules'), join(stage, 'cold-storage/node_modules'), 'junction');
const require = createRequire(join(canonical, 'cold-storage/package.json'));
summary.versions = { node: process.version, esbuild: require('esbuild').version, ethers: require('ethers').version,
  happyDom: createRequire(join(repo, 'android/package.json'))('happy-dom/package.json').version };
const revision = base => spawnSync('git', ['rev-parse', 'HEAD'], { cwd: base, encoding: 'utf8' }).stdout?.trim();
summary.focusedHead = revision(repo);
summary.monorepoHead = revision(canonical);

async function run(label, args, options = {}) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  const output = (result.stdout || '') + (result.stderr || '') + (result.error ? `\n${result.error.stack}\n` : '');
  const log = `${label}-${stamp}.txt`;
  await writeFile(join(out, log), output);
  const entry = { label, executable: 'node', args, cwd: options.cwd,
    env: options.env?.REGISTRATION_BUNDLE ? { REGISTRATION_BUNDLE: options.env.REGISTRATION_BUNDLE } : {},
    exitCode: result.status, error: result.error?.message, log, logSha256: sha(output) };
  summary.commands.push(entry);
  console.log(JSON.stringify({ label, exitCode: result.status, log }));
  if (result.status !== 0 || result.error) throw Error(`${label} did not pass; see ${log}`);
  return output;
}

try {
  await run('build', [join(stage, 'android/scripts/build-registration-page.mjs'), join(out, 'bundle')], { cwd: stage });
  summary.bundle = { path: 'bundle/registration.js', bytes: (await readFile(join(out, 'bundle/registration.js'))).length,
    sha256: sha(await readFile(join(out, 'bundle/registration.js'))) };
  const env = { ...process.env, REGISTRATION_BUNDLE: join(out, 'bundle/registration.js') };
  const targeted = await run('targeted-tests', ['--test', '--test-isolation=none', 'tests/registration-page.test.mjs'], { cwd: join(repo, 'android'), env });
  const full = await run('full-tests', ['--test', '--test-isolation=none', 'tests/*.test.mjs'], { cwd: join(repo, 'android'), env });
  const counts = text => Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, Number(text.match(new RegExp(`(?:^|\\n)[#ℹ] ${key} (\\d+)`))?.[1] ?? NaN)]));
  summary.targetedResult = counts(targeted);
  summary.fullResult = counts(full);
  if (summary.targetedResult.pass !== 3 || summary.targetedResult.skipped !== 0 || summary.targetedResult.fail !== 0)
    throw Error('Expected three genuinely executed targeted tests.');
  if (summary.fullResult.pass !== 52 || summary.fullResult.skipped !== 0 || summary.fullResult.fail !== 0)
    throw Error('Expected the complete 52-test suite with no skips.');
  summary.success = true;
} catch (error) {
  summary.success = false;
  summary.failure = error.stack;
  process.exitCode = 1;
} finally {
  for (const original of summary.unchangedOriginalEvidence) {
    original.afterSha256 = sha(await readFile(join(repo, original.path)));
    original.unchanged = original.beforeSha256 === original.afterSha256;
  }
  summary.finishedAtUtc = new Date().toISOString();
  await writeFile(join(out, `run-summary-${stamp}.json`), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ success: summary.success, targeted: summary.targetedResult, full: summary.fullResult,
    originalEvidenceUnchanged: summary.unchangedOriginalEvidence.every(x => x.unchanged) }));
}
