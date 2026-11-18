import {SAVE_VERSION,createSave,encodeSave,decodeSave,validateCampaign,scenarioId,nextMissionOptions} from './campaign.mjs';
export {SAVE_VERSION};

const KEY='dune-ii-reconstruction-saves-v1';
const CAMPAIGN_KEY='dune-ii-reconstruction-campaign-v1';
const PREF_KEY='dune-ii-reconstruction-options-v1';
const SLOTS=5,MAX_TEXT=8*1024*1024;
const DEFAULTS=Object.freeze({sound:true,music:false,volume:.45,edgeScroll:true,speed:2});
// Campaign shape validation only needs the catalog of original mission IDs.
// World validation uses the real imported content after configurePersistence.
const CAMPAIGN_CATALOG={scenarios:[0,1,2].flatMap(house=>Array.from({length:22},(_,i)=>({id:scenarioId(house,i+1),house})))};
let configuredContent=null,configuredValidator=null;

export function configurePersistence(content,validateWorld) {
  if(!content||!Array.isArray(content.scenarios)||typeof validateWorld!=='function')throw new TypeError('Persistence needs the imported content and world validator.');
  configuredContent=content;configuredValidator=validateWorld;
}
export function safeJSON(text) {
  if(typeof text!=='string'||text.length>MAX_TEXT)return null;
  try{return JSON.parse(text);}catch{return null;}
}
function getStorage(storage){return storage??globalThis.localStorage;}
function validIndex(index){if(!Number.isInteger(index)||index<0||index>=SLOTS)throw new Error('Choose a save slot from 1 to 5.');}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function copy(value){return JSON.parse(JSON.stringify(value));}
function invalidSave(){return new Error('This save is invalid or belongs to an incompatible version.');}

function basicWorld(world) {
  return plain(world)&&world.version===1&&Number.isSafeInteger(world.tick)&&world.tick>=0&&Number.isSafeInteger(world.house)&&world.house>=0&&world.house<=2&&typeof world.scenarioId==='string'&&Array.isArray(world.entities)&&world.entities.length<=2000&&world.entities.every(e=>plain(e)&&Number.isSafeInteger(e.id)&&e.id>0);
}
function validUI(ui,world) {
  if(!plain(ui)||!plain(ui.camera)||!Number.isInteger(ui.camera.x)||ui.camera.x<0||ui.camera.x>49||!Number.isInteger(ui.camera.y)||ui.camera.y<0||ui.camera.y>54||typeof ui.isStandalone!=='boolean'||!Array.isArray(ui.selection)||ui.selection.length>world.entities.length||ui.selection.length>2000||new Set(ui.selection).size!==ui.selection.length)return false;
  const ids=new Set(world.entities.map(e=>e.id));
  return ui.selection.every(id=>Number.isSafeInteger(id)&&id>0&&ids.has(id));
}
function validWorld(world,content,validator) {
  if(!basicWorld(world)||!validator(world,content))return false;
  const source=content.scenarios.find(s=>s.id===world.scenarioId);
  return !!source&&(source.house===undefined||source.house===world.house);
}
function validRecord(record,content=configuredContent??CAMPAIGN_CATALOG,validator=configuredValidator??basicWorld) {
  try {
    if(!plain(record)||record.version!==SAVE_VERSION||record.kind!=='dune-ii-browser'||record.rulesVersion!==1||typeof record.checksum!=='string'||!/^[a-f0-9]{8}$/.test(record.checksum)||typeof record.name!=='string'||record.name.length<1||record.name.length>48||record.name!==record.description||typeof record.savedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.savedAt)||!Number.isFinite(Date.parse(record.savedAt)))return false;
    const decoded=decodeSave(record,content,(world,c)=>validWorld(world,c,validator));
    if(!decoded||!validUI(record.ui,record.world))return false;
    for(const checkpoint of Object.values(record.campaign.checkpoints))if(!validUI(checkpoint.ui,checkpoint.world))return false;
    if(!record.ui.isStandalone&&record.world.outcome===null&&!nextMissionOptions(record.campaign,content).some(o=>o.scenarioId===record.world.scenarioId))return false;
    return true;
  }catch{return false;}
}
function readStoredSlots(storage) {
  const slots=safeJSON(getStorage(storage)?.getItem(KEY));
  if(!Array.isArray(slots)||slots.length>SLOTS)return Array(SLOTS).fill(null);
  return Array.from({length:SLOTS},(_,i)=>slots[i]??null);
}
export function readSlots(storage) {
  try{return readStoredSlots(storage).map(slot=>validRecord(slot)?copy(slot):null);}
  catch{return Array(SLOTS).fill(null);}
}
export function writeSlot(index,state,ui,campaign,name,storage) {
  validIndex(index);
  // All copies are prepared and checked before touching storage or caller state.
  let record;
  try {
    const title=String(name||'Arrakis operation').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,48)||'Arrakis operation';
    const payload={...createSave(state,campaign,ui,title),name:title,savedAt:new Date().toISOString()};
    record=JSON.parse(encodeSave(payload));
    if(!validRecord(record))throw invalidSave();
  }catch{throw invalidSave();}
  const slots=readSlots(storage);slots[index]=record;
  const encoded=JSON.stringify(slots);
  if(encoded.length>MAX_TEXT)throw new Error('The save is too large for browser storage.');
  try{getStorage(storage).setItem(KEY,encoded);}catch{throw new Error('Browser storage is unavailable or full. Your current mission is unchanged.');}
  return copy(record);
}
export function deleteSlot(index,storage) {
  validIndex(index);
  const slots=readSlots(storage);slots[index]=null;
  try{getStorage(storage).setItem(KEY,JSON.stringify(slots));return true;}
  catch{throw new Error('Browser storage is unavailable. The save could not be deleted.');}
}
export function loadSlot(index,validate,content,storage) {
  validIndex(index);
  if(typeof validate!=='function'||!content)throw invalidSave();
  try {
    const slot=readStoredSlots(storage)[index];
    if(!validRecord(slot,content,validate))throw invalidSave();
    return copy(slot);
  }catch{throw invalidSave();}
}
function validCampaignEnvelope(record,content) {
  if(!plain(record)||record.kind!=='dune-ii-campaign'||record.version!==1||typeof record.checksum!=='string'||!/^[a-f0-9]{8}$/.test(record.checksum)||!validateCampaign(record.campaign,content))return false;
  const expected=JSON.parse(encodeSave(record)).checksum;
  if(expected!==record.checksum)return false;
  for(const checkpoint of Object.values(record.campaign.checkpoints))if(!validUI(checkpoint.ui,checkpoint.world)||!validWorld(checkpoint.world,content,configuredValidator??basicWorld))return false;
  return true;
}
export function storeCampaign(campaign,storage) {
  try {
    const content=configuredContent??CAMPAIGN_CATALOG;
    const envelope=JSON.parse(encodeSave({kind:'dune-ii-campaign',version:1,campaign:copy(campaign)}));
    if(!validCampaignEnvelope(envelope,content))return false;
    const encoded=JSON.stringify(envelope);if(encoded.length>MAX_TEXT)return false;
    getStorage(storage).setItem(CAMPAIGN_KEY,encoded);return true;
  }catch{return false;}
}
export function readCampaign(storage) {
  try {
    const record=safeJSON(getStorage(storage)?.getItem(CAMPAIGN_KEY));
    return validCampaignEnvelope(record,configuredContent??CAMPAIGN_CATALOG)?copy(record.campaign):null;
  }catch{return null;}
}
function preferences(value) {
  const p=plain(value)&&(value.version===undefined||value.version===1)?value:{};
  return {
    sound:typeof p.sound==='boolean'?p.sound:DEFAULTS.sound,
    music:typeof p.music==='boolean'?p.music:DEFAULTS.music,
    volume:typeof p.volume==='number'&&Number.isFinite(p.volume)&&p.volume>=0&&p.volume<=1?p.volume:DEFAULTS.volume,
    edgeScroll:typeof p.edgeScroll==='boolean'?p.edgeScroll:DEFAULTS.edgeScroll,
    speed:Number.isInteger(p.speed)&&p.speed>=0&&p.speed<=4?p.speed:DEFAULTS.speed
  };
}
export function readPreferences(storage) {
  try{return preferences(safeJSON(getStorage(storage)?.getItem(PREF_KEY)));}
  catch{return {...DEFAULTS};}
}
export function storePreferences(value,storage) {
  try{getStorage(storage).setItem(PREF_KEY,JSON.stringify({version:1,...preferences(value)}));return true;}
  catch{return false;}
}
