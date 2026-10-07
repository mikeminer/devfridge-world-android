// Read-only public evidence collector. Node.js 20+; no packages, signing or cookies.
// Run: node collect.mjs [output-directory]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, 'receipts'));
await fs.mkdir(out, {recursive:true});
const PROGRAM = '9RY54dNPYTzDyh3TfFqDdt2b2KMM56KW1tw9erRTGQo6';
const DISC = Buffer.from([8,255,36,202,210,22,57,137]);
const SOLANA_ENDPOINTS = ['https://scan.devfridge.cool/api/rpc','https://solana-rpc.publicnode.com','https://api.mainnet-beta.solana.com'];
const EVM_ENDPOINT = 'https://rpc.mainnet.chain.robinhood.com';
const base58Alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes){let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let s='';while(n){s=base58Alphabet[Number(n%58n)]+s;n/=58n;}for(const b of bytes){if(b!==0)break;s='1'+s;}return s;}
let sequence=0;
const receipts=[];
async function request(label,url,payload){
  const startedAt=new Date().toISOString(), name=String(++sequence).padStart(3,'0')+'-'+label;
  const method=payload===undefined?'GET':'POST';
  let body='',status=null,headers={},error=null;
  try{const response=await fetch(url,{method,headers:{Accept:'application/json',...(payload===undefined?{}:{'Content-Type':'application/json'})},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(35000)});status=response.status;headers=Object.fromEntries(response.headers.entries());body=await response.text();}catch(e){error=String(e);}
  const finishedAt=new Date().toISOString();
  await fs.writeFile(path.join(out,name+'.body.txt'),body);
  const receipt={name,startedAt,finishedAt,url,method,request:payload??null,status,headers,error,bodyFile:name+'.body.txt'};
  await fs.writeFile(path.join(out,name+'.receipt.json'),JSON.stringify(receipt,null,2)+'\n');receipts.push(receipt);
  let json=null;try{json=JSON.parse(body);}catch{}
  return {...receipt,json};
}
async function rpc(label,url,method,params){return request(label,url,{jsonrpc:'2.0',id:1,method,params});}
async function solana(label,method,params){
  for(const url of SOLANA_ENDPOINTS){const r=await rpc(label+'-'+new URL(url).host.replaceAll('.','-'),url,method,params);if(r.status===200&&r.json&&r.json.result!==undefined&&!r.json.error)return r;}
  return null;
}
const beganAt=new Date().toISOString();
const tokens=JSON.parse(await fs.readFile(path.join(here,'game-tokens.json'),'utf8'));
const [stats,topShelfApi,solanaGenesis,solanaAccounts,evmChain,evmLatest]=await Promise.all([
  request('public-protocol-stats','https://scan.devfridge.cool/api/stats'),
  request('public-topshelf','https://world.devfridge.cool/api/world/topshelf'),
  solana('solana-genesis','getGenesisHash',[]),
  solana('solana-program-locks','getProgramAccounts',[PROGRAM,{encoding:'base64',commitment:'confirmed',withContext:true,filters:[{dataSize:105}]}]),
  rpc('evm-chain',EVM_ENDPOINT,'eth_chainId',[]),
  rpc('evm-latest',EVM_ENDPOINT,'eth_getBlockByNumber',['latest',false]),
]);
const rows=solanaAccounts?.json?.result?.value;
let locks=null,invalidAccounts=null;
if(Array.isArray(rows)){
  locks=[];invalidAccounts=[];
  for(const row of rows){
    const b=Buffer.from(row.account?.data?.[0]||'','base64');
    if(row.account?.owner!==PROGRAM||b.length!==105||!b.subarray(0,8).equals(DISC)){invalidAccounts.push(row.pubkey);continue;}
    if(locks.some(l=>l.address===row.pubkey))throw Error('Duplicate lock account in RPC response; refusing inflated totals');
    locks.push({address:row.pubkey,depositor:base58(b.subarray(8,40)),mint:base58(b.subarray(40,72)),amount:b.readBigUInt64LE(72).toString(),createdAt:Number(b.readBigInt64LE(80)),unlockAt:Number(b.readBigInt64LE(88)),bump:b[96],lockId:b.readBigUInt64LE(97).toString()});
  }
}
const asOfSeconds=Math.floor(new Date(solanaAccounts?.finishedAt||beganAt).getTime()/1000);
const unique=a=>new Set(a).size;
let protocol=null,game=null;
if(locks){
  protocol={existingLockAccounts:locks.length,activeLockAccounts:locks.filter(l=>l.unlockAt>asOfSeconds).length,expiredUnclaimedLockAccounts:locks.filter(l=>l.unlockAt<=asOfSeconds).length,uniqueDepositorWallets:unique(locks.map(l=>l.depositor)),uniqueMints:unique(locks.map(l=>l.mint)),invalidOrUnrecognizedAccounts:invalidAccounts.length};
  const mints=new Set(tokens.map(t=>t.mint)),gameLocks=locks.filter(l=>mints.has(l.mint));
  const pairs=new Map();for(const l of gameLocks.filter(l=>l.unlockAt>asOfSeconds)){const k=l.depositor+':'+l.mint;pairs.set(k,(pairs.get(k)||0n)+BigInt(l.amount));}
  const perMint=tokens.map(t=>{const existing=gameLocks.filter(l=>l.mint===t.mint),active=existing.filter(l=>l.unlockAt>asOfSeconds),threshold=500000n*10n**BigInt(t.decimals),eligible=[...pairs].filter(([k,n])=>k.endsWith(':'+t.mint)&&n>=threshold).map(([k])=>k.split(':')[0]);return {...t,existingLockAccounts:existing.length,activeLockAccounts:active.length,uniqueDepositorWallets:unique(existing.map(l=>l.depositor)),activeUniqueDepositorWallets:unique(active.map(l=>l.depositor)),thresholdRaw:threshold.toString(),eligibleWallets:eligible,eligibleWalletCount:eligible.length,activeAmountRaw:active.reduce((n,l)=>n+BigInt(l.amount),0n).toString()};});
  const eligibleWallets=[...new Set(perMint.flatMap(t=>t.eligibleWallets))];
  const byWallet=new Map();for(const l of gameLocks){if(!byWallet.has(l.depositor))byWallet.set(l.depositor,[]);byWallet.get(l.depositor).push(l);}
  const repeated=[...byWallet].filter(([,ls])=>ls.length>1).map(([wallet,ls])=>({wallet,existingGameTokenLocks:ls.length,distinctCreationUtcDates:unique(ls.map(l=>new Date(l.createdAt*1000).toISOString().slice(0,10))),firstExistingLockAt:new Date(Math.min(...ls.map(l=>l.createdAt))*1000).toISOString(),lastExistingLockAt:new Date(Math.max(...ls.map(l=>l.createdAt))*1000).toISOString()}));
  game={existingGameTokenLockAccounts:gameLocks.length,activeGameTokenLockAccounts:gameLocks.filter(l=>l.unlockAt>asOfSeconds).length,uniqueGameTokenDepositorWallets:unique(gameLocks.map(l=>l.depositor)),activeUniqueGameTokenDepositorWallets:unique(gameLocks.filter(l=>l.unlockAt>asOfSeconds).map(l=>l.depositor)),eligibleWalletCount:eligibleWallets.length,eligibleWallets,perMint,repeatedExistingLockWalletCount:repeated.length,repeatExistingLocks:repeated,platformAttribution:'unavailable',gameplayAndReturnAttribution:'unavailable'};
  const sdkPairs=new Map();for(const l of gameLocks.filter(l=>l.unlockAt>asOfSeconds&&Math.floor((l.unlockAt-l.createdAt)/86400)>=1)){const k=l.depositor+':'+l.mint;sdkPairs.set(k,(sdkPairs.get(k)||0n)+BigInt(l.amount));}
  game.sdkClientRule={originalMinLockDays:1,renewalThresholdDays:0,source:'world-game-v2/src/wallet.js:32; scan/public/sdk/devfridge-sdk.js:147',eligibleWallets:[...new Set([...sdkPairs].filter(([k,n])=>{const t=tokens.find(t=>k.endsWith(':'+t.mint));return t&&n>=500000n*10n**BigInt(t.decimals);}).map(([k])=>k.split(':')[0]))]};
  game.sdkClientRule.eligibleWalletCount=game.sdkClientRule.eligibleWallets.length;
}
const address=topShelfApi.status===200&&topShelfApi.json?.configured?topShelfApi.json.address:null;
let addressInfo=null,contractCode=null;
if(address){[addressInfo,contractCode]=await Promise.all([request('blockscout-contract-address','https://robinhoodchain.blockscout.com/api/v2/addresses/'+address),rpc('evm-contract-code',EVM_ENDPOINT,'eth_getCode',[address,'latest'])]);}
const summary={schemaVersion:1,beganAt,completedAt:new Date().toISOString(),readOnly:true,cookiesUsed:false,signaturesRequested:false,walletsExcluded:[],source:{program:PROGRAM,accountSize:105,accountDiscriminator:[...DISC],sourceRepo:'https://github.com/mikeminer/devfridge',sourceCommit:'2e0064cc37f21187bd89c0e3768f3257000c3fdb',eligibilitySource:'scan/lib/topshelf/registration.ts:34',gameTokensSource:'scan/lib/topshelf/engine/tokens.json',eligibleRule:'At least 500000 token units summed across unique active lock accounts of the same game mint for a depositor, using the mint decimals; unlockAt > snapshot completion time.'},solana:{status:locks?'available':'unavailable',genesisHash:solanaGenesis?.json?.result??null,slot:solanaAccounts?.json?.result?.context?.slot??null,commitment:'confirmed',asOfUtc:new Date(asOfSeconds*1000).toISOString(),accountReceipt:solanaAccounts?.name??null,protocol,game},publicProtocolStats:{status:stats.status,httpReceipt:stats.name,data:stats.json,warning:'The source API catches program-account errors as an empty array, has a 60-second cache, and does not report slot; use independently captured withContext RPC accounts for counts.'},topshelf:{status:address?'api_available':'unavailable',apiReceipt:topShelfApi.name,api:topShelfApi.json,chainId:evmChain.json?.result?Number(BigInt(evmChain.json.result)):null,latestBlock:evmLatest.json?.result?.number?Number(BigInt(evmLatest.json.result.number)):null,latestBlockTimestamp:evmLatest.json?.result?.timestamp?new Date(Number(BigInt(evmLatest.json.result.timestamp))*1000).toISOString():null,address,addressInfoReceipt:addressInfo?.name??null,addressInfo:addressInfo?.json??null,contractCodeReceipt:contractCode?.name??null,historicalRegistrations:'not_yet_collected'},limits:['Wallet counts are not person counts.','Timelocks do not contain game or Android usage identifiers and may reflect ecosystem use outside gameplay.','Current lock accounts exclude accounts already closed on claim; not a complete historical cohort.','Multiple existing locks show lock activity only, not repeated play or retention.','Source labels and pinned owner receipts establish exclusions when available; unlabelled wallets are not assumed independent users.','No Android MAU, D1/D7 retention, session or sharing numbers are inferred.'],receipts:receipts.map(r=>r.name)};
await fs.writeFile(path.join(out,'decoded-locks.json'),JSON.stringify({slot:summary.solana.slot,asOfUtc:summary.solana.asOfUtc,locks,invalidAccounts},null,2)+'\n');
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({out,asOfUtc:summary.solana.asOfUtc,slot:summary.solana.slot,protocol,game:game?{existingGameTokenLockAccounts:game.existingGameTokenLockAccounts,activeGameTokenLockAccounts:game.activeGameTokenLockAccounts,uniqueGameTokenDepositorWallets:game.uniqueGameTokenDepositorWallets,eligibleWalletCount:game.eligibleWalletCount,repeatedExistingLockWalletCount:game.repeatedExistingLockWalletCount}:null,topshelf:summary.topshelf},null,2));

