import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,tickGame,commandGame,validateSave,tileId} from '../dist/engine.mjs';
import {createCampaign,checkpointCampaign,encodeSave} from '../dist/campaign.mjs';
import {configurePersistence,safeJSON,readSlots,writeSlot,deleteSlot,loadSlot,storeCampaign,readCampaign,readPreferences,storePreferences} from '../dist/persistence.mjs';

const content=JSON.parse(readFileSync(new URL('../dist/assets/content.json',import.meta.url),'utf8'));
configurePersistence(content,validateSave);
const KEY='dune-ii-reconstruction-saves-v1',CAMPAIGN_KEY='dune-ii-reconstruction-campaign-v1',PREF_KEY='dune-ii-reconstruction-options-v1';
class Storage {
  values=new Map();
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){this.values.set(key,String(value));}
}
const fresh=()=>createGame(content,{house:1,scenarioId:'SCENA001.INI'});
const uiFor=world=>({selection:[world.entities.find(e=>e.house===world.house).id],camera:{x:25,y:20},isStandalone:false});

test('five bounded slots retain independent snapshots and checksums',()=>{
  const storage=new Storage(),world=fresh(),campaign=createCampaign(1),ui=uiFor(world);
  assert.deepEqual(readSlots(storage),[null,null,null,null,null]);
  const source=structuredClone({world,campaign,ui});
  const first=writeSlot(0,world,ui,campaign,'Operation\nOne',storage);
  assert.equal(first.name,'Operation One');assert.equal(first.name,first.description);
  assert.match(first.checksum,/^[a-f0-9]{8}$/);assert.equal(first.kind,'dune-ii-browser');
  assert.deepEqual({world,campaign,ui},source,'saving does not mutate active state');
  first.world.tick=999;assert.equal(loadSlot(0,validateSave,content,storage).world.tick,0);
  writeSlot(4,world,ui,campaign,'Fifth slot',storage);
  const slots=readSlots(storage);assert.equal(slots.length,5);assert.equal(slots.filter(Boolean).length,2);
  slots[0].ui.camera.x=0;assert.equal(loadSlot(0,validateSave,content,storage).ui.camera.x,25);
  assert.throws(()=>writeSlot(5,world,ui,campaign,'Invalid',storage),/1 to 5/);
  assert.throws(()=>writeSlot(-1,world,ui,campaign,'Invalid',storage),/1 to 5/);
  assert.throws(()=>deleteSlot(1.5,storage),/1 to 5/);
  assert.throws(()=>loadSlot(5,validateSave,content,storage),/1 to 5/);
  assert.equal(deleteSlot(0,storage),true);assert.equal(readSlots(storage)[0],null);
  assert.equal(loadSlot(4,validateSave,content,storage).name,'Fifth slot','deleting does not drop another slot checksum');
  storage.setItem(KEY,JSON.stringify(Array(6).fill(first)));
  assert.deepEqual(readSlots(storage),Array(5).fill(null));
});

test('engine/campaign/UI save restores exactly the next 600 ticks',()=>{
  const storage=new Storage(),world=fresh(),campaign=createCampaign(1);
  const unit=world.entities.find(e=>e.house===world.house&&e.kind==='unit');
  assert.ok(unit);
  const target=tileId((unit.x>>8)+3,(unit.y>>8)+1);
  assert.equal(commandGame(world,content,{type:'move',ids:[unit.id],tile:target}).ok,true);
  tickGame(world,content,137);
  const ui={selection:[unit.id],camera:{x:49,y:54},isStandalone:false};
  writeSlot(2,world,ui,campaign,'Mid-movement',storage);
  const saved=loadSlot(2,validateSave,content,storage),reference=structuredClone(world);
  assert.deepEqual(saved.world,world);assert.deepEqual(saved.ui,ui);
  // Diverge the active session, then verify the stored state remains independent.
  commandGame(world,content,{type:'stop',ids:[unit.id]});tickGame(world,content,79);
  assert.notDeepEqual(saved.world,world);
  tickGame(reference,content,600);tickGame(saved.world,content,600);
  assert.deepEqual(saved.world,reference);
  assert.ok(validateSave(saved.world,content));
});

test('corrupt metadata, checksums, worlds and UI are rejected without changing active state',()=>{
  const storage=new Storage(),world=fresh(),campaign=createCampaign(1),ui=uiFor(world);
  const wire=writeSlot(0,world,ui,campaign,'Valid slot',storage),active=structuredClone(world);
  const mutations=[
    r=>{r.checksum='00000000';},r=>{delete r.checksum;},
    r=>{r.world.tick++;},
    r=>{r.version=99;r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.campaign.stage=8;r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.ui.camera.x=50;r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.ui.camera.y=-1;r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.ui.camera.x=.5;r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.ui.selection=[999999];r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.ui.selection=[r.ui.selection[0],r.ui.selection[0]];r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.ui.isStandalone='false';r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.world.map.seen.pop();r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.world.scenarioId='SCENH001.INI';r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.name='x'.repeat(49);r.description=r.name;r.checksum=JSON.parse(encodeSave(r)).checksum;},
    r=>{r.savedAt='not-a-date';r.checksum=JSON.parse(encodeSave(r)).checksum;}
  ];
  for(const change of mutations) {
    const bad=structuredClone(wire);change(bad);
    storage.setItem(KEY,JSON.stringify([bad,null,null,null,null]));
    assert.equal(readSlots(storage)[0],null);
    assert.throws(()=>loadSlot(0,validateSave,content,storage),/invalid|incompatible/);
    assert.deepEqual(world,active);
  }
  storage.setItem(KEY,JSON.stringify([wire,null,null,null,null]));
  const before=storage.getItem(KEY),badUI={...ui,camera:{x:NaN,y:0}};
  assert.throws(()=>writeSlot(0,world,badUI,campaign,'Bad',storage),/invalid/);
  assert.equal(storage.getItem(KEY),before,'validation fails before overwriting a good slot');
  const badWorld=structuredClone(world);badWorld.rng.bytes[0]=999;
  assert.throws(()=>writeSlot(0,badWorld,ui,campaign,'Bad',storage),/invalid/);
  assert.equal(storage.getItem(KEY),before);assert.deepEqual(world,active);
  storage.setItem(KEY,'{broken');assert.deepEqual(readSlots(storage),Array(5).fill(null));
  assert.equal(safeJSON(' '.repeat(8*1024*1024+1)),null);
});

test('standalone original missions can save independently of campaign stage',()=>{
  const storage=new Storage(),world=createGame(content,{house:2,scenarioId:'SCENO022.INI'}),campaign=createCampaign(2),ui=uiFor(world);
  ui.isStandalone=true;
  writeSlot(0,world,ui,campaign,'Final battle practice',storage);
  assert.equal(loadSlot(0,validateSave,content,storage).world.scenarioId,'SCENO022.INI');
  ui.isStandalone=false;
  assert.throws(()=>writeSlot(1,world,ui,campaign,'Not a campaign operation',storage),/invalid/);
});

test('campaign envelopes validate stages, checkpoints and corruption',()=>{
  const storage=new Storage(),world=fresh(),ui=uiFor(world),campaign=checkpointCampaign(createCampaign(1),world,ui,content);
  assert.equal(storeCampaign(campaign,storage),true);assert.deepEqual(readCampaign(storage),campaign);
  const read=readCampaign(storage);read.house=0;assert.deepEqual(readCampaign(storage),campaign);
  const before=storage.getItem(CAMPAIGN_KEY);
  assert.equal(storeCampaign({...campaign,stage:9},storage),false);assert.equal(storage.getItem(CAMPAIGN_KEY),before);
  const wire=JSON.parse(before);wire.campaign.totalScore++;
  storage.setItem(CAMPAIGN_KEY,JSON.stringify(wire));assert.equal(readCampaign(storage),null);
  const badCheckpoint=structuredClone(campaign);badCheckpoint.checkpoints[world.scenarioId].ui.camera.x=1000;
  assert.equal(storeCampaign(badCheckpoint,storage),false);
  const invalidWorld=structuredClone(campaign);invalidWorld.checkpoints[world.scenarioId].world.entities[0].hp=-1;
  assert.equal(storeCampaign(invalidWorld,storage),false);
  storage.setItem(CAMPAIGN_KEY,JSON.stringify(campaign));assert.equal(readCampaign(storage),null,'unchecked legacy payload is not silently trusted');
});

test('preferences are typed and bounded; unavailable storage is recoverable',()=>{
  const storage=new Storage();
  assert.deepEqual(readPreferences(storage),{sound:true,music:false,volume:.45,edgeScroll:true,speed:2});
  assert.equal(storePreferences({sound:false,music:true,volume:.2,edgeScroll:false,speed:4},storage),true);
  assert.deepEqual(readPreferences(storage),{sound:false,music:true,volume:.2,edgeScroll:false,speed:4});
  storage.setItem(PREF_KEY,'{"sound":"yes","music":true,"volume":2,"edgeScroll":null,"speed":9,"__proto__":{"polluted":true}}');
  assert.deepEqual(readPreferences(storage),{sound:true,music:true,volume:.45,edgeScroll:true,speed:2});assert.equal({}.polluted,undefined);
  assert.equal(storePreferences({volume:NaN,speed:1.5},storage),true);assert.equal(readPreferences(storage).volume,.45);assert.equal(readPreferences(storage).speed,2);
  const unavailable={getItem(){throw new Error('denied');},setItem(){throw new Error('full');}};
  assert.deepEqual(readSlots(unavailable),Array(5).fill(null));assert.equal(readCampaign(unavailable),null);
  assert.equal(storeCampaign(createCampaign(1),unavailable),false);assert.equal(storePreferences({},unavailable),false);
  assert.equal(readPreferences(unavailable).speed,2);
  const world=fresh();assert.throws(()=>writeSlot(0,world,uiFor(world),createCampaign(1),'Valid',unavailable),/unavailable or full/);
  assert.throws(()=>deleteSlot(0,unavailable),/unavailable/);
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('SecurityError');}});
  try {
    assert.deepEqual(readSlots(),Array(5).fill(null));assert.equal(readCampaign(),null);assert.equal(readPreferences().volume,.45);
  } finally {
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;
  }
});
