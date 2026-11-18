import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateLandscape,applyScenarioLandscape,mapInfo,isValidMapTile,landscapeTypeForIcon} from '../dist/terrain.mjs';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const fixtures=json('../fidelity/terrain/fixtures.json');
const content=json('../dist/assets/content.json');
const hashWords=words=>{
  const buffer=Buffer.alloc(words.length*2);
  words.forEach((word,index)=>buffer.writeUInt16LE(word,index*2));
  return createHash('sha256').update(buffer).digest('hex');
};

test('landscape implementation matches independent portable C fixtures for every supplied mission seed',()=>{
  const missionSeeds=new Set(content.scenarios.map(s=>Number(s.sections.MAP.Seed)));
  assert.equal(missionSeeds.size,48);
  assert.equal(fixtures.seeds.length,51);
  for(const fixture of fixtures.seeds){
    const actual=generateLandscape(fixture.seed,{iconMap:content.graphics.iconMap});
    assert.equal(hashWords(actual.tileIds),fixture.tileIdsSha256,`seed ${fixture.seed}: all 4096 icon IDs`);
    assert.equal(hashWords(actual.nativeTypes),fixture.nativeTypesSha256,`seed ${fixture.seed}: material classes`);
    assert.deepEqual(actual.random.bytes,fixture.randomBytes,`seed ${fixture.seed}: RNG bytes`);
    assert.equal(actual.random.draws,fixture.randomDraws,`seed ${fixture.seed}: RNG draw count`);
    missionSeeds.delete(fixture.seed);
  }
  assert.equal(missionSeeds.size,0);
  // These fixtures would catch silently restoring OpenDUNE's C division.
  assert.equal(fixtures.seeds.filter(f=>f.unpatchedDiffers).length,49);
});

test('terrain-only MAP projections match independent C fixtures for all 66 scenario files',()=>{
  assert.equal(fixtures.scenarios.length,66);
  assert.equal(content.scenarios.length,66);
  for(const fixture of fixtures.scenarios){
    const scenario=content.scenarios.find(s=>s.id===fixture.id);
    assert.ok(scenario,fixture.id);
    const actual=applyScenarioLandscape(generateLandscape(fixture.seed,{iconMap:content.graphics.iconMap}),scenario.sections.MAP,Number(scenario.sections.BASIC.MapScale));
    assert.equal(hashWords(actual.tileIds),fixture.tileIdsSha256,`${fixture.id}: icon IDs`);
    assert.equal(hashWords(actual.baselineTileIds),fixture.baselineTileIdsSha256,`${fixture.id}: changed flags and baselines`);
    assert.deepEqual(actual.random.bytes,fixture.randomBytes,`${fixture.id}: RNG bytes`);
    assert.equal(actual.random.draws,fixture.randomDraws,`${fixture.id}: RNG draw count`);
  }
});

test('native map scales use playable bounds within the unchanged 64 by 64 storage grid',()=>{
  assert.deepEqual(mapInfo(0),{minX:1,minY:1,sizeX:62,sizeY:62});
  assert.deepEqual(mapInfo(1),{minX:16,minY:16,sizeX:32,sizeY:32});
  assert.deepEqual(mapInfo(2),{minX:21,minY:21,sizeX:21,sizeY:21});
  assert.equal(isValidMapTile(16+16*64,1),true);
  assert.equal(isValidMapTile(47+47*64,1),true);
  assert.equal(isValidMapTile(48+47*64,1),false);
  assert.equal(isValidMapTile(0,0),false);
  assert.equal(landscapeTypeForIcon(143),4);
  assert.equal(landscapeTypeForIcon(159),2);
  assert.equal(landscapeTypeForIcon(175),6);
  assert.equal(landscapeTypeForIcon(208),14);
});

test('terrain evidence remains bound to verified Ghidra bytes and declares its limits',()=>{
  const evidence=json('../fidelity/terrain/source-verification.json');
  assert.equal(evidence.functions.length,16);
  assert.equal(evidence.functions.reduce((count,f)=>count+f.instructionsVerified,0),3241);
  assert.ok(evidence.functions.every(f=>f.allAssemblyBytesMatchRelocatedOriginal));
  assert.equal(evidence.nativeRuntimeComparison,false);
  assert.equal(evidence.executedDosBinary,false);
  assert.equal(fixtures.clearedOutOfMapSpiceNeighbors,true);
});


test('landscape, terrain-only overrides and RNG match bounded original-DOS observations',()=>{
  const runtime=json('../fidelity/terrain/dos-runtime-fixtures.json');
  assert.equal(runtime.primarySeeds,3);
  assert.equal(runtime.wholeGameLoads,9);
  assert.equal(landscapeTypeForIcon(runtime.originalGroundIDConstants.builtSlab),10,'original runtime built-slab ID');
  assert.equal(landscapeTypeForIcon(125),4,'unbuilt slab art is not the native built-slab marker');
  assert.equal(landscapeTypeForIcon(runtime.originalGroundIDConstants.wall+1),11,'original wall icon range');
  for(const fixture of runtime.rows){
    const observed=Buffer.from(fixture.originalTileIdsLeBase64,'base64');
    assert.equal(observed.length,8192);
    assert.equal(createHash('sha256').update(observed).digest('hex'),fixture.originalTileIdsSha256);
    const actual=generateLandscape(fixture.seed,{iconMap:content.graphics.iconMap});
    assert.equal(hashWords(actual.tileIds),fixture.originalTileIdsSha256,`DOS seed ${fixture.seed}: all4096icons`);
    assert.deepEqual(actual.random.bytes,fixture.originalRngAtFunctionReturn,`DOS seed ${fixture.seed}: byte RNG`);
    assert.equal(actual.random.draws,fixture.originalRngDraws,`DOS seed ${fixture.seed}: native RNG call count`);
  }
  for(const fixture of runtime.controlledFields){
    const actual=applyScenarioLandscape(generateLandscape(fixture.seed,{iconMap:content.graphics.iconMap}),{Bloom:fixture.bloom.join(','),Field:fixture.field.join(',')},0);
    assert.equal(hashWords(actual.tileIds),fixture.originalTileIdsSha256,`${fixture.scenario}: original terrain-only override icons`);
    assert.equal(hashWords(actual.baselineTileIds),fixture.originalBaselineSha256,`${fixture.scenario}: original change flags`);
    assert.deepEqual(actual.random.bytes,fixture.originalRngBytes,`${fixture.scenario}: original override RNG bytes`);
    assert.equal(actual.random.draws,fixture.originalRngDraws,`${fixture.scenario}: original override RNG calls`);
  }
});
