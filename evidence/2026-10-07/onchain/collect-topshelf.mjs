// Read-only TopShelf event/state receipts. Node.js20+, no packages or cookies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(process.argv[2]||path.join(here,'receipts'));
const summary=JSON.parse(await fs.readFile(path.join(out,'summary.json'),'utf8'));
const abi=JSON.parse(await fs.readFile(path.join(here,'abi-descriptor.json'),'utf8'));
const endpoint='https://rpc.mainnet.chain.robinhood.com',address=summary.topshelf.address;
if(!address)throw Error('No configured public contract address; leave metrics unavailable.');
let sequence=300,receipts=[];
const hex=n=>'0x'+BigInt(n).toString(16), word=n=>BigInt(n).toString(16).padStart(64,'0');
const addressWord=a=>a.toLowerCase().slice(2).padStart(64,'0');
const b58alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(s){let n=0n;for(const c of s){const i=b58alphabet.indexOf(c);if(i<0)throw Error('base58');n=n*58n+BigInt(i);}let h=n.toString(16);if(h.length%2)h='0'+h;let b=n?Buffer.from(h,'hex'):Buffer.alloc(0);for(const c of s){if(c!=='1')break;b=Buffer.concat([Buffer.alloc(1),b]);}return b;}
function base58(bytes){let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let s='';while(n){s=b58alphabet[Number(n%58n)]+s;n/=58n;}for(const b of bytes){if(b!==0)break;s='1'+s;}return s;}
async function rpc(label,method,params){const name=String(++sequence).padStart(3,'0')+'-'+label,startedAt=new Date().toISOString(),payload={jsonrpc:'2.0',id:1,method,params};let status=null,body='',error=null,headers={};try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)});status=response.status;headers=Object.fromEntries(response.headers.entries());body=await response.text();}catch(e){error=String(e);}const finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,name+'.body.txt'),body);const meta={name,startedAt,finishedAt,url:endpoint,method:'POST',request:payload,status,headers,error,bodyFile:name+'.body.txt'};await fs.writeFile(path.join(out,name+'.receipt.json'),JSON.stringify(meta,null,2)+'\n');receipts.push(name);let json=null;try{json=JSON.parse(body);}catch{}return {...meta,json};}
const good=r=>r.status===200&&r.json&&r.json.result!==undefined&&!r.json.error;
const f=name=>abi.functions.find(x=>x.name===name);
function decodeWords(r,outputs){if(!good(r)||typeof r.json.result!=='string'||!r.json.result.startsWith('0x')||r.json.result.length!==2+64*outputs.length)return null;return Object.fromEntries(outputs.map((o,i)=>{const w=r.json.result.slice(2+i*64,2+(i+1)*64);return [o.name||String(i),o.type==='address'?'0x'+w.slice(24):o.type==='bytes32'?'0x'+w:BigInt('0x'+w).toString()];}));}
async function call(name,args,block){const fn=f(name);const r=await rpc('call-'+name,'eth_call',[{to:address,data:fn.selector+args.join('')},hex(block)]);return {receipt:r.name,decoded:decodeWords(r,fn.outputs)};}
const latest=await rpc('historical-snapshot-block','eth_getBlockByNumber',['latest',false]);
if(!good(latest)||!latest.json.result?.number)throw Error('Latest block unavailable; no historical zero assumed.');
const toBlock=Number(BigInt(latest.json.result.number));
const owner=await call('owner',[],toBlock),current=await call('currentSeason',[],toBlock);
const ownerAddress=owner.decoded?.['0']??null,currentSeason=current.decoded?.['0']?Number(current.decoded['0']):null;
const trackedWallets=summary.solana.game?.eligibleWallets??[];
const links=[];
for(const wallet of trackedWallets){const encoded=base58Decode(wallet);if(encoded.length!==32)throw Error('Expected32byteSolanaaddress');const link=await call('solanaPlayer',[encoded.toString('hex')],toBlock);links.push({solanaWallet:wallet,evmPlayer:link.decoded?.['0']??null,receipt:link.receipt});}
const seasons=[];
for(let season=1;season<=(currentSeason??0);season++){if(season>100)throw Error('Unexpected season count; collection capped100');const state=await call('seasons',[word(season)],toBlock);seasons.push({season,...state});}
// Find and prove direct contract creation: neighboring historical code states,
// deployment block with full transactions, and creation transaction receipt.
let deployment=null;
const code0=await rpc('code-block-zero','eth_getCode',[address,'0x0']);
const codeNow=await rpc('code-at-snapshot','eth_getCode',[address,hex(toBlock)]);
if(good(code0)&&good(codeNow)&&code0.json.result==='0x'&&codeNow.json.result!=='0x'){
  let lo=0,hi=toBlock,available=true;
  while(hi-lo>1){const mid=Math.floor((lo+hi)/2),r=await rpc('code-binary-'+mid,'eth_getCode',[address,hex(mid)]);if(!good(r)){available=false;break;}if(r.json.result==='0x')lo=mid;else hi=mid;}
  if(available){const adjacent=[await rpc('code-before-deploy','eth_getCode',[address,hex(hi-1)]),await rpc('code-first-present','eth_getCode',[address,hex(hi)])];const block=await rpc('deployment-block','eth_getBlockByNumber',[hex(hi),true]);let creation=null;if(good(block)){for(const tx of block.json.result?.transactions??[]){if(tx.to!==null)continue;const tr=await rpc('creation-receipt-'+tx.hash.slice(2,12),'eth_getTransactionReceipt',[tx.hash]);if(good(tr)&&tr.json.result?.contractAddress?.toLowerCase()===address.toLowerCase()){creation={transactionHash:tx.hash,block:hi,receipt:tr.name,status:tr.json.result.status};break;}}}deployment={firstCodeBlock:hi,previousNoCodeBlock:hi-1,adjacentCodeReceipts:adjacent.map(r=>r.name),blockReceipt:block.name,creation,verifiedDirectCreation:Boolean(creation&&creation.status==='0x1'),note:'Binary search assumes contiguous code presence; direct creation receipt, when found, establishes deployment independently.'};}
}
// Pruned historical state need not block proof: constructor ownership events
// locate creation receipts without relying on historical eth_getCode.
if(!deployment?.verifiedDirectCreation){
  const ownershipLogs=[],ownershipIntervals=[];let ownershipComplete=true;
  for(let start=0;start<=toBlock;start+=10000000){const end=Math.min(start+9999999,toBlock),r=await rpc('ownership-events-'+start+'-'+end,'eth_getLogs',[{address,fromBlock:hex(start),toBlock:hex(end),topics:[abi.ownershipEvent.topic]}]);const ok=good(r)&&Array.isArray(r.json.result);ownershipIntervals.push({fromBlock:start,toBlock:end,receipt:r.name,status:ok?'complete':'unavailable'});if(ok)ownershipLogs.push(...r.json.result);else ownershipComplete=false;}
  ownershipLogs.sort((a,b)=>Number(BigInt(a.blockNumber)-BigInt(b.blockNumber)));
  const first=ownershipLogs[0];
  if(first){const tr=await rpc('ownership-first-transaction-receipt','eth_getTransactionReceipt',[first.transactionHash]);const verified=good(tr)&&tr.json.result?.contractAddress?.toLowerCase()===address.toLowerCase()&&tr.json.result.status==='0x1';if(verified){deployment={firstCodeBlock:Number(BigInt(first.blockNumber)),creation:{transactionHash:first.transactionHash,block:Number(BigInt(first.blockNumber)),receipt:tr.name,status:tr.json.result.status},verifiedDirectCreation:true,method:'Constructor OwnershipTransferred log with creation transaction receipt',ownershipCoverageComplete:ownershipComplete,ownershipIntervals};}}
}
const fromBlock=deployment?.verifiedDirectCreation?deployment.firstCodeBlock:0;
const full=await rpc('score-events-full-range','eth_getLogs',[{address,fromBlock:hex(fromBlock),toBlock:hex(toBlock),topics:[abi.event.topic]}]);
let logs=good(full)&&Array.isArray(full.json.result)?full.json.result:null,coverageComplete=logs!==null,intervals=[];
intervals.push({fromBlock,toBlock,receipt:full.name,status:coverageComplete?'complete':'unavailable'});
// Retry the provider's documented-in-error maximum interval (10m blocks).
// Every interval is recorded; any missing interval keeps totals unavailable.
if(logs===null){logs=[];intervals=[];coverageComplete=true;for(let start=fromBlock;start<=toBlock;start+=10000000){const end=Math.min(start+9999999,toBlock),r=await rpc('score-events-'+start+'-'+end,'eth_getLogs',[{address,fromBlock:hex(start),toBlock:hex(end),topics:[abi.event.topic]}]);const ok=good(r)&&Array.isArray(r.json.result);intervals.push({fromBlock:start,toBlock:end,receipt:r.name,status:ok?'complete':'unavailable'});if(ok)logs.push(...r.json.result);else coverageComplete=false;}}
const events=[];let rejectedLogs=0;
for(const l of logs??[]){if(l.removed||l.address.toLowerCase()!==address.toLowerCase()||l.topics?.length!==4||l.topics[0]!==abi.event.topic||!/^0x[0-9a-fA-F]{256}$/.test(l.data)){rejectedLogs++;continue;}const w=l.data.slice(2).match(/.{64}/g);events.push({runId:l.topics[1],player:'0x'+l.topics[2].slice(-40),season:Number(BigInt(l.topics[3])),token:'0x'+w[0].slice(-40),score:BigInt('0x'+w[1]).toString(),amountRaw:BigInt('0x'+w[2]).toString(),replayHash:'0x'+w[3],block:Number(BigInt(l.blockNumber)),transactionHash:l.transactionHash,logIndex:Number(BigInt(l.logIndex))});}
const blockTimes=new Map();
for(const block of [...new Set(events.map(e=>e.block))]){const r=await rpc('event-block-'+block,'eth_getBlockByNumber',[hex(block),false]);const t=good(r)&&r.json.result?.timestamp?new Date(Number(BigInt(r.json.result.timestamp))*1000).toISOString():null;blockTimes.set(block,{timestamp:t,receipt:r.name});}
for(const e of events){e.timestamp=blockTimes.get(e.block)?.timestamp??null;e.blockReceipt=blockTimes.get(e.block)?.receipt??null;}
const byPlayer=new Map();for(const e of events){if(!byPlayer.has(e.player))byPlayer.set(e.player,[]);byPlayer.get(e.player).push(e);}
const participants=[];
for(const [player,es] of byPlayer){const state=currentSeason?await call('players',[word(currentSeason),addressWord(player)],toBlock):null;const solana=await call('playerSolana',[addressWord(player)],toBlock);const bytes=solana.decoded?.['0'];participants.push({player,registrations:es.length,distinctUtcRegistrationDates:new Set(es.filter(e=>e.timestamp).map(e=>e.timestamp.slice(0,10))).size,firstRegistrationAt:es.map(e=>e.timestamp).filter(Boolean).sort()[0]??null,lastRegistrationAt:es.map(e=>e.timestamp).filter(Boolean).sort().at(-1)??null,isCurrentContractOwner:ownerAddress?player.toLowerCase()===ownerAddress.toLowerCase():null,currentSeasonState:state,solanaWallet:bytes&&bytes!=='0x'+'0'.repeat(64)?base58(Buffer.from(bytes.slice(2),'hex')):null,solanaLinkReceipt:solana.receipt});}
const classified={treasurySolanaWallet:'GxPoKNX26GCisuH8Sdr8rtfZY98L5t5eegKtDzSA9P6W',treasuryLabelSource:'https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/lib/constants.ts',contractOwner:ownerAddress,ownerReceipt:owner.receipt,notAssumed:['unlabelled wallets are not automatically independent users','source labels do not establish person identity','on-chain registration does not attribute Android vs web']};
summary.walletsExcluded=[{wallet:classified.treasurySolanaWallet,scope:'game eligibility external-wallet subtotal',reason:'Public TREASURY constant; not presented as independent player',source:classified.treasuryLabelSource},{wallet:ownerAddress,scope:'TopShelf external-participant subtotal',reason:'Contract owner at pinned block; not presented as independent participant',receipt:owner.receipt}];
if(summary.solana.game){summary.solana.game.eligibleWalletsExcludingLabelledTreasury=trackedWallets.filter(w=>w!==classified.treasurySolanaWallet);summary.solana.game.eligibleWalletCountExcludingLabelledTreasury=summary.solana.game.eligibleWalletsExcludingLabelledTreasury.length;if(summary.solana.game.sdkClientRule)summary.solana.game.sdkClientRule.eligibleWalletCountExcludingLabelledTreasury=summary.solana.game.sdkClientRule.eligibleWallets.filter(w=>w!==classified.treasurySolanaWallet).length;}
summary.topshelf.historicalRegistrations={status:coverageComplete&&rejectedLogs===0?'available':'incomplete',capturedAt:new Date().toISOString(),chainId:4663,contract:address,fromBlock,toBlock,snapshotBlockHash:latest.json.result.hash,snapshotBlockTimestamp:new Date(Number(BigInt(latest.json.result.timestamp))*1000).toISOString(),deployment,event:abi.event,coverageComplete,intervals,rejectedLogs,eventCount:coverageComplete&&rejectedLogs===0?events.length:null,observedEventCount:events.length,uniqueRegisteredWallets:coverageComplete&&rejectedLogs===0?participants.length:null,returningRegisteredWalletsOnDistinctUtcDates:coverageComplete&&rejectedLogs===0?participants.filter(p=>p.distinctUtcRegistrationDates>1).length:null,uniqueRegisteredWalletsExcludingOwner:coverageComplete&&rejectedLogs===0?participants.filter(p=>p.isCurrentContractOwner===false).length:null,returningRegisteredWalletsExcludingOwner:coverageComplete&&rejectedLogs===0?participants.filter(p=>p.isCurrentContractOwner===false&&p.distinctUtcRegistrationDates>1).length:null,participants,seasons,links,classification:classified,eventsFile:'topshelf-score-events.json',limits:['Optional registered-score participants only; excludes unregistered play and local practice.','Distinct registration dates measure repeat registrations, not Android-specific retention.','Do not infer independent-user traction from contract-owner activity.']};
summary.completedAt=new Date().toISOString();summary.receipts.push(...receipts);
await fs.writeFile(path.join(out,'topshelf-score-events.json'),JSON.stringify({fromBlock,toBlock,coverageComplete,intervals,events},null,2)+'\n');
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary.topshelf.historicalRegistrations,null,2));
