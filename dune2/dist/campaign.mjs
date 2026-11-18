// Campaign selection follows original region order and scenario formula at 0x813c0.
export const CAMPAIGN_VERSION = 1;
export const SAVE_VERSION = 1;
export const PLAYABLE_HOUSES = Object.freeze([1,0,2]);
export const HOUSE_LETTERS = Object.freeze({0:'H',1:'A',2:'O'});

const clone = value => JSON.parse(JSON.stringify(value));
const houseNumber = value => {
  if(Number.isInteger(value)&&HOUSE_LETTERS[value])return value;
  const name=String(value).toLowerCase();
  return name==='harkonnen'||name==='h'?0:name==='atreides'||name==='a'?1:name==='ordos'||name==='o'?2:null;
};

export function scenarioId(house,number) {
  const id=houseNumber(house);
  if(id===null||!Number.isInteger(number)||number<1||number>22)return null;
  return `SCEN${HOUSE_LETTERS[id]}${String(number).padStart(3,'0')}.INI`;
}
export function scenarioNumber(id) {
  return Number(/^SCEN[AHO](\d{3})\.INI$/i.exec(String(id))?.[1]??0);
}
export function scenarioStage(number) {
  if(number===1)return 0;
  if(number===22)return 8;
  return Math.floor((number-2)/3)+1;
}
export function createCampaign(house=1) {
  const id=houseNumber(house);
  if(id===null)throw new RangeError('Select Atreides, Harkonnen or Ordos');
  return {version:CAMPAIGN_VERSION,house:id,stage:0,completed:[],regions:[],checkpoints:{},latest:null,totalScore:0,finished:false};
}

function regionSource(campaign,content) {
  const letter=HOUSE_LETTERS[campaign.house];
  return content.regions?.[letter]??content.regions?.[`REGION${letter}.INI`]??{};
}
function scenarioSource(content) {return Array.isArray(content.scenarios)?content.scenarios:[];}
function missionById(content,id){return scenarioSource(content).find(m=>String(m.id??m.name).toUpperCase()===id);}

export function nextMissionOptions(campaign,content) {
  if(!validateCampaign(campaign,content)||campaign.finished||campaign.stage>=9)return [];
  if(campaign.stage===0) {
    const id=scenarioId(campaign.house,1),mission=missionById(content,id);
    return mission?[{id,scenarioId:id,scenario:mission,number:1,stage:0,region:null,arrow:null,x:160,y:100,label:'First operation',mapping:'original-initial-scenario'}]:[];
  }
  const group=regionSource(campaign,content)[`GROUP${campaign.stage}`]??{};
  const used=new Set(),options=[];
  const entries=Object.entries(group).filter(([key])=>/^REG\d+$/.test(key)).sort((a,b)=>Number(a[0].slice(3))-Number(b[0].slice(3)));
  for(let index=0;index<entries.length;index++) {
    const [key,value]=entries[index],parts=String(value).split(',').map(s=>Number(s.trim()));
    if(parts.length<4||!parts.slice(0,4).every(Number.isFinite)||used.has(parts[0]))continue;
    used.add(parts[0]);
    const number=(campaign.stage-1)*3+index+(campaign.stage>7?1:2)-(campaign.stage>8?1:0);
    const id=scenarioId(campaign.house,number),mission=id&&missionById(content,id);
    if(!mission)continue;
    options.push({id,scenarioId:id,scenario:mission,number,stage:campaign.stage,region:parts[0],arrow:parts[1],x:parts[2],y:parts[3],key,label:`Region ${parts[0]}`,mapping:'original-choice-index-formula'});
  }
  return options;
}
export function availableMissions(campaign,content) {return nextMissionOptions(campaign,content).map(option=>option.scenario);}
export function completedMissions(campaign,content) {return campaign.completed.map(id=>missionById(content,id)).filter(Boolean);}

export function completeMission(campaign,id,content,result={}) {
  const option=nextMissionOptions(campaign,content).find(item=>item.scenarioId===id);
  if(!option)return campaign;
  const next=clone(campaign);
  if(!next.completed.includes(id))next.completed.push(id);
  if(option.region!==null&&!next.regions.includes(option.region))next.regions.push(option.region);
  // Alternative operations from the completed stage are no longer current.
  next.checkpoints={};
  next.latest=null;
  next.stage++;
  next.finished=next.stage>=9;
  next.totalScore+=Math.max(0,Number.isFinite(result.score)?Math.trunc(result.score):0);
  return next;
}

export function validateCampaign(campaign,content) {
  if(!campaign||campaign.version!==CAMPAIGN_VERSION||houseNumber(campaign.house)!==campaign.house||!Number.isInteger(campaign.stage)||campaign.stage<0||campaign.stage>9||!Array.isArray(campaign.completed)||campaign.completed.length!==campaign.stage||new Set(campaign.completed).size!==campaign.completed.length||!Array.isArray(campaign.regions)||!campaign.regions.every(r=>Number.isInteger(r)&&r>=1&&r<=27)||!campaign.checkpoints||typeof campaign.checkpoints!=='object'||Array.isArray(campaign.checkpoints)||!Number.isInteger(campaign.totalScore)||campaign.totalScore<0||typeof campaign.finished!=='boolean'||campaign.finished!==(campaign.stage===9))return false;
  for(let index=0;index<campaign.completed.length;index++) {
    const id=campaign.completed[index],match=/^SCEN([AHO])(\d{3})\.INI$/.exec(id);
    if(!match||match[1]!==HOUSE_LETTERS[campaign.house]||scenarioStage(Number(match[2]))!==index||!missionById(content,id))return false;
  }
  const ids=new Set(scenarioSource(content).map(m=>m.id??m.name));
  if(campaign.latest!==null&&(!ids.has(campaign.latest)||!Object.hasOwn(campaign.checkpoints,campaign.latest)))return false;
  if(Object.keys(campaign.checkpoints).some(id=>!ids.has(id)))return false;
  for(const [id,checkpoint]of Object.entries(campaign.checkpoints)) {
    if(!id.startsWith(`SCEN${HOUSE_LETTERS[campaign.house]}`)||scenarioStage(scenarioNumber(id))!==campaign.stage||!checkpoint||!checkpoint.world||checkpoint.world.scenarioId!==id||checkpoint.world.house!==campaign.house||!checkpoint.ui||typeof checkpoint.ui!=='object'||Array.isArray(checkpoint.ui))return false;
  }
  return true;
}

export function checkpointCampaign(campaign,world,ui={},content) {
  if(!validateCampaign(campaign,content)||world.house!==campaign.house||!nextMissionOptions(campaign,content).some(o=>o.scenarioId===world.scenarioId))return campaign;
  const next=clone(campaign);
  next.checkpoints[world.scenarioId]={world:clone(world),ui:clone(ui)};
  next.latest=world.scenarioId;
  return next;
}

export function createSave(world,campaign,ui={},description='') {
  return {kind:'dune-ii-browser',version:SAVE_VERSION,rulesVersion:1,description:String(description).slice(0,50),tick:world.tick,world:clone(world),campaign:clone(campaign),ui:clone(ui)};
}
function checksum(value) {
  const text=JSON.stringify(value);let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
  return hash.toString(16).padStart(8,'0');
}
export function encodeSave(save) {
  const payload=clone(save);delete payload.checksum;
  return JSON.stringify({...payload,checksum:checksum(payload)});
}
export function decodeSave(value,content,validateWorld=()=>true) {
  try {
    const data=typeof value==='string'?JSON.parse(value):clone(value);
    if(!data||data.kind!=='dune-ii-browser'||data.version!==SAVE_VERSION||data.rulesVersion!==1||typeof data.description!=='string'||data.description.length>50||!data.world||!validateWorld(data.world,content)||!validateCampaign(data.campaign,content)||data.world.house!==data.campaign.house||!Number.isInteger(data.tick)||data.tick!==data.world.tick||!data.ui||typeof data.ui!=='object'||Array.isArray(data.ui))return null;
    if(data.checksum!==undefined) {
      const expected=data.checksum;delete data.checksum;
      if(typeof expected!=='string'||expected!==checksum(data))return null;
    }
    if(JSON.stringify(data.ui).length>65536)return null;
    for(const checkpoint of Object.values(data.campaign.checkpoints))if(!validateWorld(checkpoint.world,content)||JSON.stringify(checkpoint.ui).length>65536)return null;
    return data;
  } catch{return null;}
}
