import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readPak,parseIni} from '../tools/preload-data.mjs';
import {createCampaign,nextMissionOptions,availableMissions,completeMission,validateCampaign,scenarioStage,checkpointCampaign,createSave,encodeSave,decodeSave} from '../dist/campaign.mjs';

const members=[...readPak('SCENARIO.PAK').values()].map(member=>({...member,ini:parseIni(member.bytes)}));
const ids={H:0,A:1,O:2};
const content={scenarios:members.filter(m=>/^SCEN[AHO]\d{3}\.INI$/.test(m.name)).map(m=>({id:m.name,house:ids[m.name[4]],number:Number(m.name.slice(5,8)),sections:m.ini})),regions:Object.fromEntries(['A','H','O'].map(letter=>[letter,members.find(m=>m.name===`REGION${letter}.INI`).ini]))};

test('imported campaign content matches all original mission and region inputs',()=>{
  const actual=JSON.parse(fs.readFileSync(new URL('../dist/assets/content.json',import.meta.url),'utf8'));
  assert.equal(actual.scenarios.length,66);assert.deepEqual(actual.regions,content.regions);
  for(const mission of content.scenarios)assert.deepEqual(actual.scenarios.find(m=>m.id===mission.id),mission);
});

test('all three original campaigns use region choices and reach final scenario22',()=>{
  for(const house of [0,1,2]) {
    let campaign=createCampaign(house);
    const numbers=[];
    for(let stage=0;stage<9;stage++) {
      assert.ok(validateCampaign(campaign,content));assert.equal(campaign.stage,stage);
      const options=nextMissionOptions(campaign,content);
      assert.ok(options.length>0,`house${house} stage${stage}`);
      assert.equal(availableMissions(campaign,content).length,options.length);
      for(const option of options) {
        assert.equal(option.stage,stage);assert.equal(scenarioStage(option.number),stage);
        if(stage>0)assert.ok(option.region>=1&&option.region<=27);
      }
      if(stage===8){assert.equal(options.length,1);assert.equal(options[0].number,22);}
      const option=options[0];numbers.push(option.number);
      const old=structuredClone(campaign);
      campaign=completeMission(campaign,option.scenarioId,content,{score:100});
      assert.deepEqual(old.completed,numbers.slice(0,-1).map(n=>`SCEN${{0:'H',1:'A',2:'O'}[house]}${String(n).padStart(3,'0')}.INI`));
      assert.equal(campaign.totalScore,(stage+1)*100);
    }
    assert.deepEqual(numbers,[1,2,5,8,11,14,17,20,22]);
    assert.equal(campaign.finished,true);assert.equal(nextMissionOptions(campaign,content).length,0);
  }
});

test('campaign choices preserve raw region/arrow/screen data and block arbitrary advancement',()=>{
  let campaign=createCampaign(1);
  assert.equal(completeMission(campaign,'SCENA022.INI',content),campaign);
  campaign=completeMission(campaign,'SCENA001.INI',content);
  const choices=nextMissionOptions(campaign,content);
  assert.deepEqual(choices.map(c=>c.number),[2,3,4]);
  assert.deepEqual(choices.map(c=>[c.region,c.arrow,c.x,c.y]),[[8,3,80,80],[15,2,101,118],[23,3,152,136]]);
  assert.equal(completeMission(campaign,'SCENH002.INI',content),campaign);
  const selected=completeMission(campaign,'SCENA004.INI',content);
  assert.deepEqual(selected.regions,[23]);assert.equal(selected.stage,2);
  assert.equal(validateCampaign({...selected,stage:7},content),false);
  assert.equal(validateCampaign({...selected,finished:true},content),false);
});

test('browser save/checkpoint round trips and rejects tampering without mutating caller',()=>{
  const campaign=createCampaign(1),world={version:1,house:1,tick:61,scenarioId:'SCENA001.INI',entities:[]};
  const ui={camera:{x:12,y:14},selection:[4],zoom:2};
  const checkpoint=checkpointCampaign(campaign,world,ui,content);
  assert.equal(checkpoint.latest,world.scenarioId);assert.deepEqual(checkpoint.checkpoints[world.scenarioId],{world,ui});
  assert.deepEqual(campaign.checkpoints,{});
  const envelope=createSave(world,checkpoint,ui,'Operation one'),encoded=encodeSave(envelope);
  const validator=w=>w?.version===1&&Number.isInteger(w.tick)&&Array.isArray(w.entities);
  assert.deepEqual(decodeSave(encoded,content,validator),envelope);
  const malformed=JSON.parse(encoded);malformed.world.tick=62;
  assert.equal(decodeSave(malformed,content,validator),null);
  assert.equal(decodeSave('{broken',content,validator),null);
  assert.equal(decodeSave({...envelope,version:999},content,validator),null);
  assert.equal(decodeSave({...envelope,world:{...world,house:0}},content,validator),null);
  const badCheckpoint=structuredClone(envelope);badCheckpoint.campaign.checkpoints[world.scenarioId].world.version=999;
  assert.equal(decodeSave(badCheckpoint,content,validator),null);
  const finished=completeMission(checkpoint,world.scenarioId,content);
  assert.equal(finished.checkpoints[world.scenarioId],undefined);assert.equal(finished.latest,null);
});
