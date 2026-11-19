import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import crypto from'node:crypto';
import{fileURLToPath}from'node:url';
import{decodePNG,alphaBounds}from'../tools/painted-png.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>fs.readFileSync(path.join(ROOT,p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(read('dist/painted/media.json')),inventory=JSON.parse(read('art/hd-v3/media/motion/inventory.json')),atlases=Object.fromEntries(Object.entries(m.atlases).map(([id,a])=>[id,decodePNG(read('dist/'+a.src))]));

test('all46 ordinary preview resources retain the original36 opaque736x448 base subset',()=>{
 assert.equal(m.scale,4);assert.equal(Object.keys(m.resources).length,46);let frameCount=0;
 for(const source of inventory.resources){const r=m.resources[source.resource],f=r.frames['0'],a=atlases[f.atlas];assert.equal(r.sourceSHA256,source.resourceSha256);assert.deepEqual(r.nativeRect,[128,48,184,112]);assert.equal(r.housePaint,false);assert.deepEqual(f.rect.slice(2),[736,448]);assert.equal(f.status,'painted-whole-preview');assert.equal(r.frameCount,source.frameCount);assert.deepEqual(r.visualPhaseSequence,source.visualPhaseSequence);frameCount+=r.nativeFrames.length;for(let y=0;y<448;y++)for(let x=0;x<736;x++)assert.equal(a.pixels[((f.rect[1]+y)*a.width+f.rect[0]+x)*4+3],255);}
 assert.equal(frameCount,161);assert.equal(m.motion.totalFrames,268);assert.equal(m.motion.distinctFrameCount,214);assert.equal(m.motion.coordinates.length,33);
});

test('new motion parts and matched cleanplates are bounded, complete and hash-bound',()=>{
 assert.deepEqual(Object.keys(m.parts),['radar-0','radar-1','radar-2','marshal-0','marshal-1','guard-0','guard-1','guard-2','transport']);assert.deepEqual(Object.keys(m.cleanplates),['radar','marshal','palace-gate','palace-foreground','palace-middle','starport-apron']);
 for(const[id,p]of Object.entries(m.parts)){const a=atlases[p.atlas];assert.deepEqual(p.rect.slice(2),[p.nativeW*4,p.nativeH*4]);const b=alphaBounds(a,p.rect,32);assert(b,id);assert(b[3]>=p.rect[3]*.65,id+' lost a whole object during extraction');assert.equal(p.status,'painted-whole-motion-part');}
 for(const row of Object.values(m.cleanplates)){assert.deepEqual(row.rect.slice(2),row.nativeRect.slice(2).map(v=>v*4));assert.equal(row.status,'painted-clean-background-patch');}
 for(const[id,row]of Object.entries(m.atlases)){assert.equal(hash(read('dist/'+row.src)),row.sha256);assert.deepEqual([atlases[id].width,atlases[id].height],[row.w,row.h]);}
 for(const row of Object.values(m.source.art)){assert.equal(hash(read(row.path)),row.sha256);assert.equal(hash(read(row.prompt)),row.promptSHA256);}
});

test('every production base matches the frozen new-art reference and native phase geometry',()=>{
 for(const[name,r]of Object.entries(m.resources)){const base=decodePNG(read('art/hd-v3/media/review/'+name.slice(0,-4).toLowerCase()+'-base.png')),f=r.frames['0'],a=atlases[f.atlas];for(let y=0;y<448;y++){const p=((f.rect[1]+y)*a.width+f.rect[0])*4;assert.deepEqual(a.pixels.subarray(p,p+736*4),base.pixels.subarray(y*736*4,(y+1)*736*4));}for(const n of r.nativeFrames){assert.equal(typeof n.changedPixelCount,'number');if(n.changedBounds){const[x,y,w,h]=n.changedBounds;assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=184&&y+h<=112);}}}
 assert.deepEqual(m.resources['STARPORT.WSA'].nativeFrames[12].changedBounds,[147,70,32,5]);
});
