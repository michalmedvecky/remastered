import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import{fileURLToPath}from'node:url';
import{decodePNG}from'../tools/painted-png.mjs';
import{compileMediaWitnesses,identifyMediaFrame}from'../dist/painted-media-core.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>fs.readFileSync(path.join(ROOT,p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(read('dist/painted/media.json')),frozen=JSON.parse(read('art/hd-v3/media/review/frozen-36-bank.json')),extras=JSON.parse(read('art/hd-v3/media/extra-motion/inventory.json')),atlases=Object.fromEntries(Object.entries(m.atlases).map(([id,a])=>[id,decodePNG(read('dist/'+a.src))]));
test('42-resource extension preserves every frozen36 base, part and cleanplate byte',()=>{
 assert.equal(Object.keys(m.resources).length,42);assert.equal(m.motion.totalFrames,264);assert.equal(m.motion.distinctFrameCount,210);assert.equal(m.motion.coordinates.length,33);
 for(const[id,row]of Object.entries(frozen.atlases)){assert.deepEqual(m.atlases[id],row);assert.equal(hash(read('dist/'+row.src)),row.sha256);}
 for(const[name,row]of Object.entries(frozen.resources))assert.deepEqual(m.resources[name],row);
 assert.deepEqual(m.parts,frozen.parts);assert.deepEqual(m.cleanplates,frozen.cleanplates);
 let extraBytes=0;for(const[id,a]of Object.entries(m.atlases))if(id.startsWith('extra')){extraBytes+=a.w*a.h*4;assert.equal(hash(read('dist/'+a.src)),a.sha256);}assert(extraBytes<48*1024*1024,'Avoid allocating repeated full backgrounds for103 extra phases');
});
test('all103 extra phases have bounded new-art frames with exact native phase mapping',()=>{
 let count=0,patches=0;for(const source of extras.resources){const r=m.resources[source.resource];assert.equal(r.sourceSHA256,source.resourceSha256);assert.equal(r.renderMode,'painted-frame-sequence');assert.equal(Object.keys(r.frames).length,source.frameCount);assert.deepEqual(r.visualPhaseSequence,source.visualPhaseSequence);count+=source.frameCount;
  for(let f=0;f<source.frameCount;f++){const row=r.frames[f],a=m.atlases[row.atlas];assert.equal(row.sourceFrame,f);assert(row.rect[0]>=0&&row.rect[1]>=0&&row.rect[0]+row.rect[2]<=a.w&&row.rect[1]+row.rect[3]<=a.h);if(f===0)assert.deepEqual(row.rect.slice(2),[736,448]);else{assert.equal(row.composite,'replace-on-base');assert.deepEqual(row.rect.slice(2),row.nativeRect.slice(2).map(v=>v*4));const[x,y,w,h]=row.nativeRect;assert(x>=0&&y>=0&&x+w<=184&&y+h<=112);patches++;}}
  const frame=r.frames[0],atlas=atlases[frame.atlas],base=decodePNG(read('art/hd-v3/media/review/'+source.resource.slice(0,-4).toLowerCase()+'-base.png'));for(let y=0;y<448;y++){const at=((frame.rect[1]+y)*atlas.width+frame.rect[0])*4;assert.deepEqual(atlas.pixels.subarray(at,at+736*4),base.pixels.subarray(y*736*4,(y+1)*736*4));}
 }
 assert.equal(count,103);assert.equal(patches,97);
 for(const name of['FARTR.WSA','FHARK.WSA','FORDOS.WSA'])assert.deepEqual(m.resources[name].visualPhaseSequence,Array.from({length:30},(_,i)=>i));
 assert.equal(m.resources['FREMEN.WSA'].nativeFrames[0].indicatorControls.left,'green');assert.equal(m.resources['FREMEN.WSA'].nativeFrames[1].indicatorControls.left,'red');
});
test('all264 exact original indexed phases identify without an inferred clock',()=>{
 const bank=compileMediaWitnesses(m.motion),sources=[['art/hd-v3/media/motion/',JSON.parse(read('art/hd-v3/media/motion/inventory.json'))],['art/hd-v3/media/extra-motion/',extras]];let count=0;
 for(const[folder,inventory]of sources)for(const resource of inventory.resources)for(const row of resource.frames){const raw=read(folder+row.indexFile);assert.equal(hash(raw),row.pixelSha256);const pixels=new Uint8Array(64000);for(let y=0;y<112;y++)pixels.set(raw.subarray(y*184,(y+1)*184),(48+y)*320+128);const match=identifyMediaFrame({pixels},bank);assert.equal(match.status,'matched',resource.resource+':'+row.frame);assert(match.equivalentFrames.some(r=>r.resource===resource.resource&&r.frame===row.frame));count++;}
 assert.equal(count,264);
});
