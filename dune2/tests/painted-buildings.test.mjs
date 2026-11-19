import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readPak,verifyPreload} from '../tools/preload-data.mjs';
import {decodePNG} from '../tools/painted-png.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=json('dist/painted/buildings.json'),packing=json('art/hd-v2/buildings/packing.json');
const owned=[...Array.from({length:75},(_,i)=>i+33),...Array.from({length:179},(_,i)=>i+210)];

test('painted buildings cover all native wall/building IDs and every original whole-state mapping',()=>{
 const pak=readPak('DUNE.PAK'),bytes=pak.get('ICON.MAP').bytes,words=Array.from({length:bytes.length/2},(_,i)=>bytes.readUInt16LE(i*2));
 assert.deepEqual(Object.keys(manifest.tiles).map(Number).sort((a,b)=>a-b),owned);assert.equal(manifest.coverage.complete,true);assert.deepEqual(manifest.coverage.missingNativeIds,[]);
 for(const name of ['ICON.ICN','ICON.MAP','IBM.PAL'])assert.equal(manifest.source[name],pak.get(name).sha256,name);assert.equal(manifest.source.preload,verifyPreload().packageSha256);
 const structures=json('dist/assets/content.json').structures;assert.equal(Object.keys(manifest.structures).length,19);let states=0;
 for(const source of structures){
  const row=manifest.structures[source.id];assert.equal(row.width,source.width*16);assert.equal(row.height,source.height*16);assert.equal(row.iconGroup,source.iconGroup);
  if([0,1].includes(source.id)){assert.equal(row.ownership,'terrain');continue;}
  const group=words.slice(words[source.iconGroup],words[source.iconGroup+1]||words.length),count=source.width*source.height;
  assert.equal(row.states.length,group.length/count,source.name+' state inventory');
  for(const state of row.states){assert.deepEqual(state.tileIds,group.slice(state.index*count,(state.index+1)*count));assert.equal(state.complete,true);for(const id of state.tileIds)assert(manifest.tiles[id]||[125,143].includes(id),source.name+'/'+state.index+'/'+id);}
  if(source.id!==14)states+=row.states.length;
 }
 assert.equal(states,106);assert.equal(manifest.coverage.nativeWholeStateRecords,106);
});

test('all native pieces bind actual painted RGBA pixels, native extents, raw sources and content-addressed PNG',()=>{
 const atlas=manifest.atlases.buildings,raw=read('dist/'+atlas.src);assert.equal(sha(raw),atlas.sha256);assert(atlas.src.endsWith('-'+atlas.sha256.slice(0,16)+'.png'));
 const image=decodePNG(raw);assert.equal(image.width,1024);assert.equal(image.height,1024);let detailed=0,blocks=0;
 for(const id of owned){
  const f=manifest.tiles[id];assert.equal(f.w,64);assert.equal(f.h,64);assert.equal(f.sourceTileId,id);assert(f.x>=0&&f.y>=0&&f.x+64<=image.width&&f.y+64<=image.height);const bytes=Buffer.alloc(64*64*4);let opaque=0;
  for(let y=0;y<64;y++){Buffer.from(image.pixels.buffer,image.pixels.byteOffset+((f.y+y)*image.width+f.x)*4,256).copy(bytes,y*256);for(let x=0;x<64;x++)if(bytes[(y*64+x)*4+3])opaque++;}
  assert(opaque>0,'native ID'+id+' has actual art');assert.equal(sha(bytes),packing.tileSourceHashes[id]);
  for(let y=0;y<64;y+=4)for(let x=0;x<64;x+=4){const q=(y*64+x)*4;let same=true;for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)for(let k=0;k<4;k++)if(bytes[((y+dy)*64+x+dx)*4+k]!==bytes[q+k])same=false;blocks++;if(!same)detailed++;}
  if(f.sourceInkBounds){const[l,t,w,h]=f.sourceInkBounds;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(x<l*4||y<t*4||x>=(l+w)*4||y>=(t+h)*4)assert.equal(bytes[(y*64+x)*4+3],0,'wall keeps native ink offset');}
 }
 assert(detailed>blocks*.2,'new subpixel lines/shading rather than flat enlarged original pixels');
 for(const[name,hash]of Object.entries(packing.rawHashes))assert.equal(sha(read('art/hd-v2/buildings/raw/'+name)),hash,name+' retained raw');
});

test('native flag derivatives and smooth painted windtrap emissions remain explicitly classified',()=>{
 const flags=Object.values(manifest.tiles).filter(f=>f.status==='painted-derived-native-flag-state');assert.equal(flags.length,10);
 for(const f of flags){assert(manifest.tiles[f.derivedFrom]);assert(f.nativeChangedPixels>0&&f.nativeChangedPixels<=24);assert(f.paintedMarkerPixels>0);assert.match(f.derivation,/highlight phase/);assert(f.nativeDeltaBounds.length===4);}
 for(const id of [304,305,306,307,308]){const f=manifest.tiles[id],mask=Buffer.from(f.emissionMaskBase64,'base64');assert.equal(f.paletteCycle223,true);assert.equal(mask.length,4096);assert(mask.some(v=>v>0));assert(mask.some(v=>v>0&&v<255));assert.match(f.emissionMaskSource,/new painted/);}
 assert.match(manifest.semantics.minorFlagStates,/exact original cloth-pixel silhouettes are not recreated/);
});
