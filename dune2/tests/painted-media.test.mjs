import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileMediaWitnesses,identifyMediaFrame,mediaSceneKind,nativeMediaPhase} from '../dist/painted-media-core.mjs';
const motionURL=new URL('../art/hd-v3/media/motion/',import.meta.url);
const extraURL=new URL('../art/hd-v3/media/extra-motion/',import.meta.url);
const inventory=JSON.parse(fs.readFileSync(new URL('inventory.json',motionURL),'utf8'));
const extras=JSON.parse(fs.readFileSync(new URL('inventory.json',extraURL),'utf8'));
const bank=compileMediaWitnesses(JSON.parse(fs.readFileSync(new URL('frame-witnesses.json',motionURL),'utf8')));
const manifest=JSON.parse(fs.readFileSync(new URL('../dist/painted/media.json',import.meta.url),'utf8'));
const globalBank=compileMediaWitnesses(manifest.motion);
const embed=bytes=>{const pixels=new Uint8Array(64000);for(let y=0;y<112;y++)pixels.set(bytes.subarray(y*184,(y+1)*184),(48+y)*320+128);return{pixels,worldVisible:false};};
test('every original object preview is exactly identified, with duplicate holds explicit',()=>{
 let n=0;for(const row of inventory.resources)for(const f of row.frames){const frame=embed(fs.readFileSync(new URL(f.indexFile,motionURL))),match=identifyMediaFrame(frame,bank);assert.equal(match.status,'matched');assert(match.equivalentFrames.some(r=>r.resource===row.resource&&r.frame===f.frame));n++;}assert.equal(n,161);
});
test('active42 bank identifies all264 original phases using33 immutable global witnesses',async()=>{
 const {createHash}=await import('node:crypto');
 assert.equal(Object.keys(manifest.resources).length,42);assert.equal(globalBank.coordinates.length,33);assert.equal(globalBank.frames.length,264);
 assert.deepEqual(manifest.motion,JSON.parse(fs.readFileSync(new URL('global-frame-witnesses.json',extraURL),'utf8')));
 let n=0;
 for(const [source,folder]of [[inventory,motionURL],[extras,extraURL]])for(const row of source.resources)for(const f of row.frames){
  const bytes=fs.readFileSync(new URL(f.indexFile,folder));assert.equal(bytes.length,184*112);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.pixelSha256);
  const match=identifyMediaFrame(embed(bytes),globalBank);
  assert.equal(match.status,'matched',row.resource+':'+f.frame);assert.equal(match.samples,33);
  assert.equal(match.pixelSha256,f.pixelSha256);assert(match.equivalentFrames.some(r=>r.resource===row.resource&&r.frame===f.frame));n++;
 }
 assert.equal(n,264);
});
test('matching excludes only actual observed UI ink; mismatch never chooses nearest',()=>{
 const row=inventory.resources[0],frame=embed(fs.readFileSync(new URL(row.frames[0].indexFile,motionURL))),[x,y]=bank.coordinates[0],at=(48+y)*320+128+x;frame.pixels[at]^=255;
 assert.equal(identifyMediaFrame(frame,bank).status,'unknown');
 frame.textGlyphs=[{x:128+x,y:48+y,screen:0,ink:[[0,0,15]],width:50,height:50}];const known=identifyMediaFrame(frame,bank);assert(['matched','ambiguous'].includes(known.status));
 frame.pixels[at+1]^=255;assert.equal(known.samples,29); // Bounding box is not an occlusion mask.
 assert.equal(identifyMediaFrame(frame,bank,{occluders:()=>true}).status,'unknown');
});
test('source phase tables preserve authored holds; factory/world scene gates are explicit',()=>{
 for(const row of inventory.resources)for(let frame=0;frame<row.frameCount;frame++){const p=nativeMediaPhase(row,frame);assert.equal(p.frame,frame);assert.equal(p.parts.length,row.semanticParts.length);}
 const starport=inventory.resources.find(r=>r.resource==='STARPORT.WSA');assert.deepEqual(starport.visualPhaseSequence.slice(0,10),Array(10).fill(0));
 assert.equal(mediaSceneKind('factory-shell',{worldVisible:false}),'factory');assert.equal(mediaSceneKind('advisor-a',{worldVisible:false}),'mentat');assert.equal(mediaSceneKind('factory',{worldVisible:true}),null);assert.throws(()=>nativeMediaPhase(starport,25));
});

test('all264 production phases preserve the36 semantic plans and6 explicit baked sequences',async()=>{
 const {mediaMotionPlan}=await import('../dist/painted-media-core.mjs');
 const hashes=new Map();let frames=0,animated=0,semanticFrames=0,semanticAnimated=0,bakedFrames=0,bakedResources=0,patches=0;
 for(const row of Object.values(manifest.resources)){
  if(row.frameCount>1)animated++;
  const baked=row.renderMode==='painted-frame-sequence';if(baked)bakedResources++;else if(row.frameCount>1)semanticAnimated++;
  for(let f=0;f<row.frameCount;f++){
   const plan=mediaMotionPlan(row,f);assert.equal(plan.supported,true,row.resource);frames++;
   if(baked){
    bakedFrames++;assert.deepEqual(plan.bakedFrame,row.frames[f]);assert.equal(plan.bakedFrame.sourceFrame,f);assert.deepEqual(plan.operations,[]);
    const entry=plan.bakedFrame,atlas=manifest.atlases[entry.atlas],target=entry.nativeRect??[0,0,184,112];
    assert(atlas);assert.deepEqual(entry.rect.slice(2),target.slice(2).map(v=>v*4));
    assert(entry.rect[0]>=0&&entry.rect[1]>=0&&entry.rect[0]+entry.rect[2]<=atlas.w&&entry.rect[1]+entry.rect[3]<=atlas.h);
    assert(target[0]>=0&&target[1]>=0&&target[2]>0&&target[3]>0&&target[0]+target[2]<=184&&target[1]+target[3]<=112);
    if(f>0){assert.equal(entry.composite,'replace-on-base');patches++;}
   }else semanticFrames++;
   for(const op of plan.operations){
    assert(op.target.every(Number.isFinite));assert(op.target[2]>0&&op.target[3]>0);
    if(op.type==='asset'){assert(manifest.parts[op.id],op.id);if(op.clean)assert(manifest.cleanplates[op.clean],op.clean);}
   }
   const key=row.nativeFrames[f].pixelSHA256,signature=JSON.stringify(plan);
   if(hashes.has(key))assert.equal(signature,hashes.get(key),row.resource+' duplicate native hold must not invent motion');
   else hashes.set(key,signature);
  }
 }
 assert.equal(frames,264);assert.equal(animated,19);assert.equal(hashes.size,210);
 assert.equal(semanticFrames,161);assert.equal(semanticAnimated,14);assert.equal(bakedResources,6);assert.equal(bakedFrames,103);assert.equal(patches,97);
});

test('production atlas hashes/geometry and all42 whole preview bindings are complete',async()=>{
 const crypto=await import('node:crypto');
 for(const row of Object.values(manifest.atlases)){
  const bytes=fs.readFileSync(new URL('../dist/'+row.src,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256);
  assert.equal(bytes.readUInt32BE(16),row.w);assert.equal(bytes.readUInt32BE(20),row.h);
 }
 assert.equal(Object.keys(manifest.resources).length,42);
 for(const row of Object.values(manifest.resources)){const b=row.frames['0'],atlas=manifest.atlases[b.atlas];assert.deepEqual(b.rect.slice(2),[736,448]);assert(b.rect[0]+b.rect[2]<=atlas.w&&b.rect[1]+b.rect[3]<=atlas.h);}
});
