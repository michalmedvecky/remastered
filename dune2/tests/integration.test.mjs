import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createGame,tickGame,commandGame,canPlace,tileId,tilePoint,entityTile,validateSave} from '../dist/engine.mjs';
import {Renderer} from '../dist/renderer.mjs';
import {createCampaign,validateCampaign,completeMission,nextMissionOptions} from '../dist/campaign.mjs';
import {writeSlot,readSlots,loadSlot,deleteSlot} from '../dist/persistence.mjs';

const content=JSON.parse(readFileSync(new URL('../dist/assets/content.json',import.meta.url)));
const fresh=()=>createGame(content,{house:1,scenarioId:'SCENA001.INI',speed:2});
const command=(s,c)=>{const r=commandGame(s,content,c);assert.equal(r.ok,true,r.message+' '+JSON.stringify(c));return r;};

// Canvas/asset contract checks: no browser engine is simulated here. These check
// renderer coordinates and source bounds independently of visual browser QA.
const calls=[];
function makeContext(){return new Proxy({
  drawImage(image,...args){assert.ok(image,'image supplied');assert.ok(args.every(Number.isFinite),'finite draw coordinates');if(args.length===8){const[sx,sy,sw,sh]=args;assert.ok(sw>0&&sh>0);assert.ok(sx>=0&&sy>=0&&sx+sw<=image.width&&sy+sh<=image.height,'atlas crop inside PNG');}calls.push({kind:'image',args});},
  fillText(text,...args){assert.ok(args.every(Number.isFinite));},
  createLinearGradient(){return{addColorStop(){}};}
},{get(target,key){if(key in target)return target[key];return(...args)=>{if(['fillRect','strokeRect','rect','moveTo','lineTo','translate','scale','arc'].includes(key))assert.ok(args.every(Number.isFinite),String(key)+' finite coordinates');};}});}
const makeCanvas=()=>({width:320,height:200,getContext:()=>makeContext(),getBoundingClientRect:()=>({left:10,top:20,width:640,height:400})});
const priorDocument=globalThis.document;globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return makeCanvas();}};
try{
  const renderer=new Renderer(makeCanvas(),content),urls=new Set([...Object.values(content.graphics.atlases),...Object.values(content.graphics.images),...Object.values(content.graphics.houseAtlases).flatMap(Object.values)]);
  for(const url of urls){const data=readFileSync(new URL('../dist/'+url,import.meta.url));assert.equal(data.subarray(1,4).toString(),'PNG');renderer.images[url]={width:data.readUInt32BE(16),height:data.readUInt32BE(20)};}
  assert.deepEqual(renderer.point(330,220),{x:160,y:100});
  renderer.center(30.5,25.5);assert.deepEqual(renderer.worldPoint({x:239,y:199}),{x:37,y:29});
  assert.equal(renderer.worldPoint({x:240,y:100}),null);assert.equal(renderer.worldPoint({x:100,y:39}),null);
  assert.deepEqual(renderer.minimapPoint({x:318,y:106}),{x:63,y:63});
  const world=fresh();
  const own=world.entities.find(e=>e.house===world.house&&e.kind==='unit');assert.equal(renderer.entityAt(world,tilePoint(entityTile(own)))?.id,own.id);
  const hidden=world.entities.find(e=>e.house!==world.house&&!world.map.visible[entityTile(e)]);assert.ok(hidden);
  assert.equal(renderer.entityAt(world,tilePoint(entityTile(hidden))),undefined,'unseen enemy is absent from pointer hit tests');
  renderer.draw(world,{selected:[own.id]});
  for(const def of [...content.units,...content.structures])renderer.portraitCanvas(def);
  const campaign=createCampaign(1);renderer.campaign(makeCanvas(),campaign,nextMissionOptions(campaign,content),'SCENA001.INI');
  assert.ok(calls.length>100,'original atlas images participate in rendering');
}finally{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;}

const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value))};
const world=fresh(),unit=world.entities.find(e=>e.house===1&&e.kind==='unit'&&e.type===13);
command(world,{type:'move',ids:[unit.id],tile:tileId(34,25)});tickGame(world,content,47);
assert.ok(unit.moveRemainder>0,'save fixture contains fractional movement state');
const campaign=createCampaign(1),ui={selection:[unit.id],camera:{x:23,y:20},isStandalone:false};
const slot=writeSlot(2,world,ui,campaign,'Fractional movement',storage);
assert.equal(readSlots(storage).filter(Boolean).length,1);assert.notEqual(slot.world,world);
const restored=loadSlot(2,validateSave,content,storage);assert.ok(validateCampaign(restored.campaign,content));assert.deepEqual(restored.ui,ui);
tickGame(world,content,600);tickGame(restored.world,content,600);assert.deepEqual(restored.world,world,'actual persistence adapter restores engine determinism');
const malformed=readSlots(storage);malformed[2].world.entities[0].script=null;storage.setItem([...memory.keys()][0],JSON.stringify(malformed));
assert.throws(()=>loadSlot(2,validateSave,content,storage),/invalid|incompatible/i);assert.ok(validateSave(world,content),'failed load does not mutate active world');
deleteSlot(2,storage);assert.equal(readSlots(storage).some(Boolean),false);

function summarize(s){return{tick:s.tick,seconds:s.tick/60,outcome:s.outcome,credits:s.houses[1].credits,displayCredits:s.houses[1].displayCredits,delivered:s.delivered,liveUnits:s.entities.filter(e=>e.hp>0&&e.house===1&&e.kind==='unit').length,liveStructures:s.entities.filter(e=>e.hp>0&&e.house===1&&e.kind==='structure').map(e=>({type:e.type,hp:e.hp,maxHp:e.maxHp})),kills:s.kills,losses:s.losses,result:s.result??null};}
const idle=fresh();tickGame(idle,content,7200);const idleAtTwoMinutes=summarize(idle);tickGame(idle,content,301);assert.equal(idle.outcome,'victory','original first-scenario starting quota is evaluated after grace');

function nextSite(state,type){const base=state.entities.find(e=>e.house===1&&e.kind==='structure'&&e.type===8);const p=tilePoint(entityTile(base));for(let radius=1;radius<12;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const x=p.x+dx,y=p.y+dy;if(x>=0&&x<64&&y>=0&&y<64&&canPlace(state,content,type,tileId(x,y)).ok)return tileId(x,y);}throw new Error('No visible valid construction site.');}
const active=fresh(),tape=[];
function record(c){command(active,c);tape.push({tick:active.tick,...c});}
for(const type of [9,12]){
  record({type:'build',kind:'structure',objectType:type});
  let wait=0;while(!active.production.some(p=>p.kind==='structure'&&p.ready)&&wait++<3000)tickGame(active,content,1);
  assert.ok(wait<3000);record({type:'place',tile:nextSite(active,type)});
}
const harvester=active.entities.find(e=>e.house===1&&e.kind==='unit'&&e.type===16);assert.ok(harvester);assert.equal(harvester.order.type,'harvest');
let firstDelivery=null;
while(active.tick<7200&&!active.outcome){tickGame(active,content,1);if(firstDelivery===null&&active.delivered>0)firstDelivery=active.tick;}
const activeAtTwoMinutes=summarize(active);tickGame(active,content,301);
assert.ok(firstDelivery!==null,'normal refinery workflow actually yields credits before assessment');
assert.equal(active.outcome,'victory','windtrap/refinery resource cycle can satisfy original quota');
assert.ok(active.delivered>=700,'production spending is replaced by actual spice deliveries');
const advanced=completeMission(campaign,active.scenarioId,content,active.result);assert.equal(advanced.stage,1);assert.ok(validateCampaign(advanced,content));assert.equal(nextMissionOptions(advanced,content).length,3);

const observations={scope:'Reconstructed browser engine only; ordinary player build/place commands, no state cheats and no DOS execution',house:1,scenario:'SCENA001.INI',speed:2,inputTape:tape,idleAtTwoMinutes,idleAtAssessment:summarize(idle),activeAtTwoMinutes,activeAtAssessment:summarize(active),firstDeliveryTick:firstDelivery};
writeFileSync(new URL('./scenario-observations.json',import.meta.url),JSON.stringify(observations,null,2)+'\n');
console.log(`Integration verified: renderer/asset bounds; persistence and fractional state; first mission idle ${idle.outcome}; normal windtrap/refinery ${active.outcome}, ${active.delivered} delivered credits, first delivery tick ${firstDelivery}.`);
