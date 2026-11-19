import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePNG} from '../tools/painted-png.mjs';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=json('dist/painted/units.json'),native=json('dist/painted/native.json');

test('painted world bank explicitly covers all244 native IDs,27unit bindings and independent tank turrets',()=>{
 assert.equal(manifest.coverage.complete,true);assert.deepEqual(manifest.coverage.missing,[]);
 assert.deepEqual(Object.keys(manifest.frames).map(Number).sort((a,b)=>a-b),Array.from({length:244},(_,i)=>i+111));
 assert.deepEqual(manifest.coverage.statuses,{painted:233,'procedural-effect':5,'native-empty':6});
 assert.equal(manifest.unitBindings.length,27);assert.deepEqual(manifest.unitBindings.map(u=>u.type),Array.from({length:27},(_,i)=>i));
 for(const [name,body,turret]of [['Tank',111,116],['Siege Tank',121,126],['Devastator',131,136],['Sonic Tank',111,141],['Launcher',111,146]]){
  const u=manifest.unitBindings.find(u=>u.name===name);assert(u,name);assert.equal(u.groundSpriteID,body);assert.equal(u.turretSpriteID,turret);
  for(let facing=0;facing<5;facing++){assert.equal(manifest.frames[body+facing].status,'painted');assert.equal(manifest.frames[turret+facing].status,'painted');assert.notDeepEqual(manifest.frames[body+facing].rect,manifest.frames[turret+facing].rect);}
 }
 const blanks=Object.entries(manifest.frames).filter(([,f])=>f.status==='native-empty').map(([id])=>Number(id));assert.deepEqual(blanks,[213,214,215,216,217,354]);
});

test('painted frame geometry, source indices and palette remain bound to independently retained native SHP bank',()=>{
 assert.equal(manifest.source.preloadSha256,native.source.preloadSha256);
 for(const [id,f]of Object.entries(manifest.frames)){
  const original=native.frames.units[id];assert(original,id);assert.equal(f.sourceW,original.sourceW,id+' width');assert.equal(f.sourceH,original.sourceH,id+' height');assert.equal(f.sourceSHA256,original.sourceSHA256,id+' native bytes');
  assert.equal(f.sourceIndicesBase64,original.indicesBase64,id+' source codes');assert.equal(f.sourceMaskBase64,original.maskBase64,id+' source mask');assert.deepEqual(f.sourcePalette,original.palette??null,id+' local palette');
  assert.deepEqual(f.pivot,[Math.floor(original.sourceW/2),Math.floor(original.sourceH/2)],id+' native center');
  assert.equal(f.rect[2],original.sourceW*4);assert.equal(f.rect[3],original.sourceH*4);
 }
});

test('all new RGBA frames, semantic faction masks and consumed raw inputs match atlas/provenance without ghost backplates',()=>{
 const atlases={};for(const [id,a]of Object.entries(manifest.atlases)){const bytes=read('dist/'+a.src);assert.equal(sha(bytes),a.sha256);atlases[id]=decodePNG(bytes);}
 const paintings=new Set();
 for(const [id,f]of Object.entries(manifest.frames)){
  const bytes=read('art/hd-v2/units/packed/'+id+'.png'),im=decodePNG(bytes),atlas=atlases[f.atlas],[x,y,w,h]=f.rect;assert.equal(sha(bytes),f.outputSha256);assert.equal(im.width,w);assert.equal(im.height,h);
  assert(x>=0&&y>=0&&x+w<=atlas.width&&y+h<=atlas.height,id+' atlas rectangle');
  for(let row=0;row<h;row++)assert.deepEqual(im.pixels.subarray(row*w*4,(row+1)*w*4),atlas.pixels.subarray(((y+row)*atlas.width+x)*4,((y+row)*atlas.width+x+w)*4),id+' consumed atlas pixels');
  const faction=Buffer.from(f.factionMaskBase64,'base64');assert.equal(faction.length,w*h);assert(faction.every(v=>v===0||v===255));let ink=0;
  for(let i=0;i<w*h;i++){const p=i*4;if(im.pixels[p+3]){ink++;const px=i%w,py=Math.floor(i/w),b=f.sourceInk;assert(b&&px>=b[0]*4&&px<(b[0]+b[2])*4&&py>=b[1]*4&&py<(b[1]+b[3])*4,id+' logical ink bounds');}if(faction[i])assert(im.pixels[p+3]&&im.pixels[p+2]>im.pixels[p]*1.15&&im.pixels[p+2]>im.pixels[p+1]*1.1,id+' faction colour semantics');}
  if(f.status==='native-empty')assert.equal(ink,0);else assert(ink>0,id+' nonempty art');
  if(f.status==='painted'){paintings.add(f.outputSha256);assert.equal(sha(read(f.evidence.raw)),f.evidence.rawSHA256,id+' consumed raw');assert(!f.evidence.touchesSheetEdge,id+' complete generated object');}
 }
 assert.equal(paintings.size,233,'Every painted native pose/effect has its own nonidentical result; aliases are explicit native-bank sharing, not generic substitutes');
 for(const id of [268,269,270,271,272,289,290,291,292,293,294,295,296,297]){const f=manifest.frames[id];assert.deepEqual(f.evidence.alphaConfidence?.transparentThrough,128);assert(f.evidence.crop[0]>0&&f.evidence.crop[1]>0,id+' translucent matte excluded from object crop');}
 assert.equal(manifest.frames['242'].evidence.group,'quad-south-four-wheel-correction');
 for(const id of [243,244,245])assert.equal(manifest.frames[id].evidence.acceptedPilot,true);
});

test('fixed steel turrets cannot retain invented faction paint while Devastator stays faction-capable',()=>{
 const neutral=[...Array.from({length:5},(_,i)=>116+i),...Array.from({length:5},(_,i)=>126+i),...Array.from({length:10},(_,i)=>141+i)];
 for(const id of neutral){
  const f=manifest.frames[id],im=decodePNG(read('art/hd-v2/units/packed/'+id+'.png'));
  assert.equal(f.paletteMode,'global256',id+' original fixed palette');assert.equal(f.sourcePalette,null,id+' no local house palette');
  assert.equal(f.factionMask,'neutral-fixed-steel');assert(Buffer.from(f.factionMaskBase64,'base64').every(v=>v===0),id+' no semantic faction mask');
  assert(f.evidence.neutralTurretCorrection,id+' material correction provenance');
  for(let p=0;p<im.pixels.length;p+=4){const[r,g,b,a]=im.pixels.subarray(p,p+4);assert(!(a>=64&&b>90&&b>r*1.6&&b>g*1.45),id+' no saturated cobalt collar');}
 }
 const unchanged={136:'99f96e7d6632d6e4bc143e81ccb8cf7018ff8ecc07b9b09a2403d02fbafd367f',137:'d0035007ab730b48d67d91ebe9542fa17987150d8f581cb38940ffed68441135',138:'94b807ebdd9dd59746cd36963274406cbcbf97c25dc3251dba071bbc06f14bf6',139:'8f8bbc28267573fbb685ecba9c63d1cc51a7492d889345b9df772e0e245ef5df',140:'d47f8178af99dc315e20a9269f27f1ca3ff4dbe303bf748b159181053379dc3b'};
 for(const [id,hash]of Object.entries(unchanged)){
  const f=manifest.frames[id];assert.equal(f.paletteMode,'local16');assert(f.sourcePalette.some(v=>v>=144&&v<=152));
  assert(Buffer.from(f.factionMaskBase64,'base64').some(v=>v>0),id+' retains house paint');assert.equal(f.evidence.raw,'art/hd-v2/units/raw/turrets.png');assert.equal(f.outputSha256,hash,id+' untouched approved Devastator pixels');
 }
});
