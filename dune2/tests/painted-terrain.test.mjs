import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePNG} from '../tools/painted-png.mjs';
import {readPak} from '../tools/preload-data.mjs';
import {terrainSurfaceUV,terrainWorldOffset,terrainCellVisible} from '../dist/painted-terrain.mjs';
const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root)),manifest=JSON.parse(read('dist/painted/terrain.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
function originalIcons(){const raw=readPak('DUNE.PAK').get('ICON.ICN').bytes,chunks={};for(let p=12;p<raw.length;){const n=raw.readUInt32BE(p+4);chunks[raw.toString('ascii',p,p+4)]=raw.subarray(p+8,p+8+n);p+=8+n+(n&1);}return Array.from({length:389},(_,id)=>{const palette=[...chunks.RPAL.subarray(chunks.RTBL[id]*16,chunks.RTBL[id]*16+16)];const values=[];for(const byte of chunks.SSET.subarray(8+id*128,8+(id+1)*128))values.push(byte>>4,byte&15);return{palette,indices:Uint8Array.from(values),mask:Uint8Array.from(values,v=>Number(palette[v]!==0||palette[0]!==0))};});}

test('all135 terrain states bind independently decoded original ICON geometry and disjoint building ownership',()=>{
 const originals=originalIcons(),ids=manifest.coverage.ownedIDs,others=manifest.coverage.otherOwnerIDs;assert.equal(ids.length,135);assert.equal(others.length,254);assert.deepEqual([...ids,...others].sort((a,b)=>a-b),Array.from({length:389},(_,i)=>i));assert.equal(new Set([...ids,...others]).size,389);assert.deepEqual(manifest.coverage.missingOwnedIDs,[]);
 for(const id of ids){const f=manifest.descriptors[id],actual=originals[id];assert.deepEqual(f.palette,actual.palette,'palette '+id);assert.deepEqual([...Buffer.from(f.indicesBase64,'base64')],[...actual.indices],'source indices '+id);assert.deepEqual([...Buffer.from(f.maskBase64,'base64')],[...actual.mask],'source alpha '+id);assert(manifest.tiles[id].kind,'visual rule '+id);}
 assert.equal(manifest.coverage.landscapeStates,81);assert.equal(manifest.coverage.fogStates,16);assert.equal(manifest.coverage.smudgeStates,32);assert.equal(manifest.coverage.bloomStates,2);
});

test('fog geometry remains exact and all native interior terrain endpoints fully cover their class',()=>{
 const originals=originalIcons(),atlas=decodePNG(read('dist/'+manifest.assets.masks.src));
 for(let id=108;id<=123;id++){const m=manifest.tiles[id].fogMask;for(let y=0;y<64;y++)for(let x=0;x<64;x++)assert.equal(atlas.pixels[((m.y+y)*atlas.width+m.x+x)*4+3],originals[id].mask[(y>>2)*16+(x>>2)]*255,'fog '+id);}
 for(const id of [143,159,175,191,207])assert(Buffer.from(manifest.tiles[id].layers[0].mask.nativeMaskBase64,'base64').every(v=>v===1),'full class '+id);
 const slab=Buffer.from(manifest.tiles[124].layers[0].mask.nativeMaskBase64,'base64');assert.deepEqual([...slab],[...originals[124].mask]);
});

test('painted world surfaces bind hashes, join their repeat edges, and preserve UV across native tile and camera boundaries',()=>{
 const bytes=read('dist/'+manifest.assets.surfaces.src);assert.equal(sha(bytes),manifest.assets.surfaces.sha256);const atlas=decodePNG(bytes);
 for(const[name,s]of Object.entries(manifest.surfaces)){for(let y=0;y<s.h;y++)for(let c=0;c<4;c++)assert.equal(atlas.pixels[((s.y+y)*atlas.width+s.x)*4+c],atlas.pixels[((s.y+y)*atlas.width+s.x+s.w-1)*4+c],name+' horizontal wrap');for(let x=0;x<s.w;x++)for(let c=0;c<4;c++)assert.equal(atlas.pixels[(s.y*atlas.width+s.x+x)*4+c],atlas.pixels[((s.y+s.h-1)*atlas.width+s.x+x)*4+c],name+' vertical wrap');}
 for(const camera of [0,1,63,64,511,2048,4095]){const offset=terrainWorldOffset(camera);assert.equal(offset.x,(camera&63)*64);assert.equal(offset.y,((camera>>6)&63)*64);for(let row=0;row<10;row++)for(let col=0;col<15;col++){const right=terrainSurfaceUV(camera,col,row,64,0),next=terrainSurfaceUV(camera,col+1,row,0,0);assert.deepEqual(right,next);assert.deepEqual(terrainSurfaceUV(camera,col,row,0,64),terrainSurfaceUV(camera,col,row+1,0,0));}}
 assert.deepEqual(terrainSurfaceUV(0,1,0),terrainSurfaceUV(1,0,0),'camera moved one tile');assert.notDeepEqual(terrainSurfaceUV(0,0,0),terrainSurfaceUV(0,1,0),'UV does not reset on16px cells');
});

test('new overlay states have clean transparent bounds and declared original footprints without source-colour remapping',()=>{
 const bytes=read('dist/'+manifest.assets.overlays.src);assert.equal(sha(bytes),manifest.assets.overlays.sha256);const atlas=decodePNG(bytes);
 for(const[id,t]of Object.entries(manifest.tiles)){if(!t.overlay)continue;for(const rect of Object.values(t.overlay.variants)){let solid=0,empty=0;const bounds=t.overlay.nativeInkBounds;for(let y=0;y<64;y++)for(let x=0;x<64;x++){const a=atlas.pixels[((rect.y+y)*atlas.width+rect.x+x)*4+3];if(a)solid++;else empty++;if(x<bounds[0]*4||y<bounds[1]*4||x>=(bounds[0]+bounds[2])*4||y>=(bounds[1]+bounds[3])*4)assert.equal(a,0,'outside native extent '+id);}assert(solid>0,'painted state '+id);assert(empty>0,'transparent cutout '+id);}}
 assert.match(manifest.semantics.ground,/Full RGBA/);assert.match(manifest.semantics.ground,/not tinted/);assert(manifest.limits.some(v=>v.includes('six painted archetypes')));
});


test('native isUnveiled flag suppresses valid ground even when overlay is zero, with full fog after building phase',()=>{
 const frame={tiles:new Uint16Array(600),veiledTileId:123};
 for(const [index,ground]of [[0,127],[1,143],[2,292]]){frame.tiles.set([ground,0,1,0],index*4);assert.equal(terrainCellVisible(frame,index),false,'unrevealed '+ground);frame.tiles[index*4+3]=1;assert.equal(terrainCellVisible(frame,index),true,'revealed '+ground);frame.tiles[index*4+1]=123;assert.equal(terrainCellVisible(frame,index),false,'full veil '+ground);}
 const before=frame.tiles.slice();frame.debugScenario=true;for(let index=0;index<3;index++)assert.equal(terrainCellVisible(frame,index),true,'explicit native debug reveal');assert.deepEqual(frame.tiles,before,'visibility is read only');
});
