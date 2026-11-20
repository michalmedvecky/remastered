import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileTerrainMaterials,buildTerrainMaterialField} from '../dist/painted-material-field.mjs';
const manifest=JSON.parse(readFileSync(new URL('../dist/painted/terrain.json',import.meta.url))),compiled=compileTerrainMaterials(manifest.descriptors);
const material=(x,y)=>x>=10&&x<=30&&y>=10&&y<=26?(x>=16&&x<=23&&y>=14&&y<=20?'dense':'spice'):x>=33&&x<=43&&y>=13&&y<=22?'dune':'sand';
function tile(x,y,at=material){const k=at(x,y);let bits=0;for(const[dx,dy,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]]){const v=at(x+dx,y+dy);if(k==='spice'?(v==='spice'||v==='dense'):v===k)bits|=bit;}return k==='dense'?192+bits:k==='spice'?176+bits:k==='dune'?144+bits:127;}
function frame(x=9,y=9,at=material){const tiles=new Uint16Array(17*12*4);for(let row=0;row<12;row++)for(let col=0;col<17;col++)tiles.set([tile(x+col,y+row,at),0,1,1],(row*17+col)*4);return{grid:{x,y,width:17,height:12},viewport:x+y*64,tiles,veiledTileId:123,debugScenario:false};}

test('native material membership preserves sparse dense grains and uses genuine dune ridge inks instead of sand-position differences',()=>{
 const full=compiled.records.get(207),edge=compiled.records.get(206),dune=compiled.records.get(159);
 assert.equal([...full.denseSpice].filter(v=>v).length,61,'full207 dark grains occupy61/256, not256/256');
 assert([...edge.denseSpice].filter(v=>v).length<=53,'partial206 native dark grain count');
 assert.equal([...dune.dune].filter(v=>v).length,49,'only native88/92 ridge inks');
 assert.equal(compiled.records.has(127),false,'ordinary sand has no invented material mask');
});

test('all full spice/dense fields retain sand gaps and cannot turn into opaque painted rectangles',()=>{
 for(const k of ['spice','dense']){
  const f=frame(12,12,()=>k),copy=f.tiles.slice(),a=buildTerrainMaterialField(f,compiled);
  assert.equal(a.active,true);assert.deepEqual(f.tiles,copy,'native game descriptors are read-only');
  for(const[name,s]of Object.entries(a.stats)){assert(s.maxOpacity<.9,name+' is not an opaque replacement');assert(s.lowOpacityPixels>s.samples*.1,name+' retains granular gaps');assert(s.meanOpacity<.65,name+' is not a flat solid material fill');}
 }
});

test('global feather plus world grain coordinates gives identical camera-overlap pixels across committed tile steps',()=>{
 const a=buildTerrainMaterialField(frame(9,9),compiled),b=buildTerrainMaterialField(frame(10,9),compiled),scale=a.maskScale;
 for(const name of ['spice','denseSpice']){
  const am=a.masks[name],bm=b.masks[name];assert(am&&bm,name);
  for(let y=16*scale;y<(a.height-16)*scale;y++)for(let x=32*scale;x<(a.width-16)*scale;x++)assert.equal(am.alpha[y*am.width+x],bm.alpha[y*bm.width+x-16*scale],name+' stable world sample '+x+','+y);
 }
});

test('unknown/full-fog cells never seed material colour, and changing a harvested tile updates its visual field without editing map state',()=>{
 const f=frame(12,12),before=f.tiles.slice(),i=5*17+5;f.tiles[i*4+3]=0;
 const field=buildTerrainMaterialField(f,compiled),scale=field.maskScale;
 for(const row of Object.values(field.masks))for(let y=5*16*scale;y<6*16*scale;y++)for(let x=5*16*scale;x<6*16*scale;x++)assert.equal(row.alpha[y*row.width+x],0,'no unknown native tile material');
 assert.equal(f.tiles[i*4],before[i*4],'visibility did not change ground');
 const harvested=frame(12,12);harvested.tiles[i*4]=127;const updated=buildTerrainMaterialField(harvested,compiled);
 for(const row of Object.values(updated.masks))for(let y=5*16*scale;y<6*16*scale;y++)for(let x=5*16*scale;x<6*16*scale;x++)assert.equal(row.alpha[y*row.width+x],0,'native sand after harvest has no spice overprint');
 assert.equal(harvested.tiles[i*4],127);
});

test('dune transitions share one sand base and a globally feathered ridge field, with no opaque class endpoint',()=>{
 const f=frame(31,11),r=buildTerrainMaterialField(f,compiled),s=r.stats.dune;assert(s);assert(s.maxOpacity<=.48);assert(s.meanOpacity<.25);
 const uniform=buildTerrainMaterialField(frame(31,11,()=> 'dune'),compiled);assert(uniform.stats.dune.maxOpacity<=.48);assert(uniform.stats.dune.meanOpacity<.35);
});
