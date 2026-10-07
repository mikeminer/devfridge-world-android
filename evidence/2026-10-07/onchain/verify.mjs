// Offline checks of the dated receipt package. Node.js20+, no dependencies.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(process.argv[2]||path.join(here,'receipts'));
const read=async f=>JSON.parse(await fs.readFile(path.join(out,f),'utf8'));
const s=await read('summary.json'),d=await read('decoded-locks.json'),e=await read('topshelf-score-events.json');
const raw=await read(s.solana.accountReceipt+'.body.txt');
assert.equal(raw.result.context.slot,s.solana.slot);
assert.equal(new Set(d.locks.map(l=>l.address)).size,d.locks.length);
assert.equal(d.locks.length,s.solana.protocol.existingLockAccounts);
assert.equal(new Set(d.locks.map(l=>l.depositor)).size,s.solana.protocol.uniqueDepositorWallets);
const h=s.topshelf.historicalRegistrations;
assert.equal(h.coverageComplete,true);
assert.equal(e.events.length,h.eventCount);
assert.equal(new Set(e.events.map(e=>e.runId)).size,e.events.length);
assert.equal(new Set(e.events.map(e=>e.transactionHash+':'+e.logIndex)).size,e.events.length);
assert.equal(new Set(e.events.map(e=>e.player)).size,h.uniqueRegisteredWallets);
assert.equal(e.intervals[0].fromBlock,e.fromBlock);
assert.equal(e.intervals.at(-1).toBlock,e.toBlock);
for(let i=1;i<e.intervals.length;i++)assert.equal(e.intervals[i].fromBlock,e.intervals[i-1].toBlock+1);
const currentSeason=Math.max(...h.seasons.map(s=>s.season));
for(const p of h.participants){assert.equal(e.events.filter(e=>e.player===p.player&&e.season===currentSeason).length,Number(p.currentSeasonState.decoded.runs));assert.equal(p.distinctUtcRegistrationDates,new Set(e.events.filter(e=>e.player===p.player).map(e=>e.timestamp.slice(0,10))).size);}
assert.equal(h.eventCount,h.seasons.reduce((n,s)=>n+Number(s.decoded.registrations),0));
for(const season of h.seasons)assert.equal(new Set(e.events.filter(e=>e.season===season.season).map(e=>e.player)).size,Number(season.decoded.playerCount));
for(const name of s.receipts){const r=await read(name+'.receipt.json');assert.ok(r.url.startsWith('https://'));assert.equal(new URL(r.url).search,'');assert.equal(r.request?.method==='sendTransaction',false);assert.equal(r.request?.method==='eth_sendTransaction',false);assert.equal(r.request?.method==='eth_sendRawTransaction',false);await fs.access(path.join(out,r.bodyFile));}
console.log(JSON.stringify({verified:true,slot:s.solana.slot,lockAccounts:d.locks.length,scoreEvents:e.events.length,registeredWallets:h.uniqueRegisteredWallets,registrationDates:h.participants[0].distinctUtcRegistrationDates,nonownerRegisteredWallets:h.uniqueRegisteredWalletsExcludingOwner,receiptCount:s.receipts.length}));
