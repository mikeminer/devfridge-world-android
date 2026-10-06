import { readFile, writeFile } from 'node:fs/promises';
import { createPublicKey, verify, createHash } from 'node:crypto';

const [input, output] = process.argv.slice(2);
if (!input) throw Error('Usage: node scripts/verify-mwa-evidence.mjs evidence.json [verification.json]');
const evidenceBytes = await readFile(input);
const evidence = JSON.parse(evidenceBytes);
const signed = evidence.signature;
if (!signed || evidence.productionAuthorization !== false || evidence.financialTransactionRequested !== false) throw Error('Expected public test-wallet diagnostic, not production authorization');
const publicKey = Buffer.from(signed.publicKeyBase64, 'base64');
const signature = Buffer.from(signed.signatureBase64, 'base64');
const message = Buffer.from(signed.messageBase64, 'base64');
if (publicKey.length !== 32 || signature.length !== 64 || message.toString('utf8') !== signed.message) throw Error('Invalid diagnostic byte lengths or message');
const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), publicKey]), format: 'der', type: 'spki' });
const valid = verify(null, message, key, signature);
if (!valid) throw Error('Ed25519 signature verification failed');
const report = { algorithm: 'Ed25519', signatureValid: valid, evidenceSha256: createHash('sha256').update(evidenceBytes).digest('hex'), messageSha256: createHash('sha256').update(message).digest('hex'), publicKeyBytes: publicKey.length, signatureBytes: signature.length, scope: 'Actual MWA signature from an unfunded official SDK test wallet. This does not verify game eligibility, ranked score authorization or a payment.' };
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
