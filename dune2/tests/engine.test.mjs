import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SIZE,FIXED,tileId,tilePoint,speedAdjust,random15,randomByte,createGame,tickGame,
  commandGame,canPlace,canBuild,getBuildOptions,applyDamage,evaluateObjectives,validateSave,snapshotGame
} from '../dist/engine.mjs';

const content=JSON.parse(readFileSync(new URL('../dist/assets/content.json',import.meta.url)));
const fresh=()=>createGame(content,{house:1,scenarioId:'SCENA001.INI'});
const issue=(s,c)=>assert.equal(commandGame(s,content,c).ok,true,JSON.stringify(c));

for(let id=0;id<SIZE*SIZE;id++){const p=tilePoint(id);assert.equal(tileId(p.x,p.y),id);}
assert.equal(FIXED,256);
assert.deepEqual([0,1,2,3,4].map(s=>speedAdjust(4,2,8,0,s)),[8,6,4,3,2]);
assert.deepEqual([0,1,2,3,4].map(s=>speedAdjust(30,15,60,0,s)),[60,45,30,23,16]);
assert.deepEqual([0,1,2,3,4].map(s=>speedAdjust(16,1,255,1,s)),[8,12,16,24,32]);
assert.deepEqual([0,1,2,3,4].map(s=>speedAdjust(5,1,255,0,s)),[9,7,5,4,3]);
assert.equal(speedAdjust(10,20,30,0,2),10,'normal speed bypasses clamps');

const rng={rng:{lcg:1,bytes:[1,0,0]}};
const lcgExpected=[346,130,10982,1090,11656,7117,17595,6415];
const observed=lcgExpected.map(()=>random15(rng));
// Independent BigInt recurrence checks full 32-bit state and high15 extraction.
let exact=1n;for(const draw of observed){exact=(exact*0x015a4e35n+1n)&0xffffffffn;assert.equal(draw,Number((exact>>16n)&32767n));}
assert.equal(rng.rng.lcg,Number(exact));
const byteA={rng:{bytes:[97,1,0]}},byteB=structuredClone(byteA);
assert.deepEqual(Array.from({length:256},()=>randomByte(byteA)),Array.from({length:256},()=>randomByte(byteB)));
assert.equal(new Set(Array.from({length:64},()=>randomByte(byteA))).size>20,true);

const s=fresh();
assert.equal(s.entities.filter(e=>e.kind==='structure'&&e.house===1&&e.type===8).length,1);
assert.equal(s.houses[1].credits,1000);
assert.equal(s.houses[1].quota,1000);
assert.equal(s.entities.filter(e=>e.kind==='unit').length,17);
assert.equal(s.map.terrain.length,4096);
assert.ok(validateSave(s,content));
assert.equal(canBuild(s,content,'structure',12).ok,false,'refinery requires a windtrap');
assert.equal(commandGame(s,content,{type:'place',tile:0}).ok,false);
assert.equal(commandGame(s,content,{type:'move',ids:[9999],tile:0}).ok,false);
assert.equal(commandGame(s,content,{type:'setSpeed',value:9}).ok,false);

function firstSite(state,type){
  const base=state.entities.find(e=>e.house===1&&e.kind==='structure'&&e.type===8);
  const bx=base.x>>8,by=base.y>>8;
  for(let r=1;r<=9;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const x=bx+dx,y=by+dy;if(x<0||y<0||x>=64||y>=64)continue;
    const tile=tileId(x,y);if(canPlace(state,content,type,tile).ok)return tile;
  }
  throw new Error('No valid original base placement site for type '+type);
}
issue(s,{type:'build',kind:'structure',objectType:9});
assert.equal(s.houses[1].credits,700);
assert.equal(s.production[0].ready,false);
tickGame(s,content,450);
assert.equal(s.production[0].ready,true);
assert.equal(commandGame(s,content,{type:'place',tile:0}).ok,false,'unexplored/nonrock footprint rejected');
issue(s,{type:'place',tile:firstSite(s,9)});
assert.equal(s.production.length,0);
assert.ok(s.houses[1].powerProduced>0);
assert.equal(canBuild(s,content,'structure',12).ok,true);
issue(s,{type:'build',kind:'structure',objectType:12});
tickGame(s,content,750);
assert.equal(s.production[0].ready,true);
issue(s,{type:'place',tile:firstSite(s,12)});
assert.equal(s.houses[1].credits,300);
let harvester=s.entities.find(e=>e.house===1&&e.kind==='unit'&&e.type===16);
assert.ok(harvester,'new refinery receives a harvester');
assert.equal(harvester.order.type,'harvest');
for(let i=0;i<12000&&s.delivered===0;i++)tickGame(s,content,1);
assert.ok(s.delivered>0,'automated outbound/harvest/return cycle deposits credits');
assert.ok(s.entities.every(e=>e.cargo<=100),'cargo respects recovered cap');
const saved=snapshotGame(s);
assert.ok(validateSave(saved,content));
const restore=JSON.parse(JSON.stringify(saved));
tickGame(s,content,600);tickGame(restore,content,600);
assert.deepEqual(restore,s,'save restore produces exactly the same next 600 ticks');

const altered=structuredClone(saved);altered.map.seen.pop();assert.equal(validateSave(altered,content),false);
const nan=structuredClone(saved);nan.entities[0].x=NaN;assert.equal(validateSave(nan,content),false);
const duplicate=structuredClone(saved);duplicate.entities[1].id=duplicate.entities[0].id;assert.equal(validateSave(duplicate,content),false);
const badCargo=structuredClone(saved);badCargo.entities[0].cargo=101;assert.equal(validateSave(badCargo,content),false);
const badScenario=structuredClone(saved);badScenario.scenarioId='not-a-scenario';assert.equal(validateSave(badScenario,content),false);
const badRng=structuredClone(saved);badRng.rng.bytes[0]=999;assert.equal(validateSave(badRng,content),false);
const missingScript=structuredClone(saved);delete missingScript.entities[0].script;assert.equal(validateSave(missingScript,content),false);
const badTeam=structuredClone(saved);badTeam.teams=[null];assert.equal(validateSave(badTeam,content),false);
const badOrder=structuredClone(saved);badOrder.entities[0].order.tile=5000;assert.equal(validateSave(badOrder,content),false);

const factories=fresh();factories.stage=2;
const yard=factories.entities.find(e=>e.kind==='structure'&&e.house===1);
for(let i=0;i<2;i++)factories.entities.push({...structuredClone(yard),id:factories.nextId++,type:3,x:yard.x+(i+3)*256,script:{...yard.script,entry:3}});
issue(factories,{type:'build',kind:'unit',objectType:13});
issue(factories,{type:'build',kind:'unit',objectType:13});
assert.equal(new Set(factories.production.map(p=>p.producer)).size,2,'independent factories accept independent orders');
assert.equal(commandGame(factories,content,{type:'build',kind:'unit',objectType:13}).ok,false,'busy factories reject another queue');
const unseen=fresh(),enemy=unseen.entities.find(e=>e.house!==1&&e.kind==='unit'&&!unseen.map.visible[(e.x>>8)+(e.y>>8)*64]);
assert.ok(enemy);assert.equal(commandGame(unseen,content,{type:'attack',ids:[unseen.entities.find(e=>e.house===1&&e.kind==='unit').id],target:enemy.id}).ok,false,'explicit target must be visible');

const paused=fresh(),pausedBefore=structuredClone(paused);
paused.paused=true;tickGame(paused,content,180);
assert.equal(paused.tick,0);assert.equal(paused.uiTick,180);
assert.deepEqual(paused.entities,pausedBefore.entities);
paused.paused=false;tickGame(paused,content,1);assert.equal(paused.tick,1);

const quota=fresh();quota.scenario.endMask=4;quota.scenario.winMask=4;quota.houses[1].quota=1200;quota.houses[1].credits=1500;quota.houses[1].displayCredits=1199;
quota.tick=7200;assert.equal(evaluateObjectives(quota),null,'actual credits do not bypass animated display');
quota.houses[1].displayCredits=1200;assert.equal(evaluateObjectives(quota),'victory');
quota.tick=7199;assert.equal(evaluateObjectives(quota),null,'grace boundary is preserved');
quota.tick=7200;quota.houses[1].displayCredits=65535;assert.equal(evaluateObjectives(quota),null,'uninitialized display sentinel does not satisfy quota');

const loss=fresh();for(const e of loss.entities)if(e.kind==='structure'&&e.house===1)e.hp=0;
loss.houses[1].displayCredits=0;loss.tick=7200;loss.scenario.nextPoll=7200;
tickGame(loss,content,1);assert.equal(loss.outcome,'defeat');
const win=fresh();win.tick=7200;win.scenario.nextPoll=7200;tickGame(win,content,1);assert.equal(win.outcome,'victory');assert.ok(win.result.score>=0);

const wall=fresh();wall.entities=wall.entities.filter(e=>e.kind==='structure');wall.tick=7200;wall.scenario.endMask=1;wall.scenario.winMask=1;
wall.entities.push({...structuredClone(wall.entities[0]),id:99,house:2,type:14,w:1,h:1});
assert.equal(evaluateObjectives(wall),null,'walls count in end trigger');
wall.entities[1].type=15;assert.equal(evaluateObjectives(wall),'victory','turrets excluded from structure end trigger');

const damage=fresh(),infantry=damage.entities.find(e=>e.kind==='unit'&&e.type===4);
infantry.type=2;infantry.hp=50;infantry.maxHp=50;
applyDamage(damage,content,infantry,26,{house:2});assert.equal(infantry.type,4);assert.equal(infantry.hp,20,'infantry group transforms below half HP');
applyDamage(damage,content,infantry,500,{house:2});assert.equal(infantry.hp,0,'lethal damage clamps HP');

function replay(chunk){
  const state=fresh(),unit=state.entities.find(e=>e.house===1&&e.kind==='unit'&&e.type===13);
  const tape=[{tick:10,type:'move',ids:[unit.id],tile:tileId(31,24)},{tick:300,type:'stop',ids:[unit.id]},{tick:500,type:'guard',ids:[unit.id]}];
  for(let at=0;at<1000;){const next=tape.find(c=>c.tick>=at);if(next&&next.tick===at){const {tick,...cmd}=next;issue(state,cmd);tape.splice(tape.indexOf(next),1);continue;}const amount=Math.min(chunk,1000-at,next?next.tick-at:1000-at);tickGame(state,content,amount);at+=amount;}
  return state;
}
assert.deepEqual(replay(1),replay(2));assert.deepEqual(replay(1),replay(4));

for(const scenario of content.scenarios){
  const state=createGame(content,{house:scenario.house,scenarioId:scenario.id});
  assert.ok(validateSave(state,content),scenario.id+' initial state valid');
  tickGame(state,content,16);assert.ok(validateSave(state,content),scenario.id+' advanced state valid');
  assert.ok(state.entities.some(e=>e.house===state.house&&e.kind==='structure'&&e.type===8),scenario.id+' player construction yard');
}
console.log(`Engine verified: ${content.scenarios.length} original scenarios; coordinates; speed/RNG; placement/economy; 600-tick save determinism; input replay; pause; objectives; damage; malformed saves.`);
