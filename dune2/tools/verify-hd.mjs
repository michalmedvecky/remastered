// Read-only verification of the complete Dune II HD delivery package.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=path=>JSON.parse(readFileSync(path));
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
function decoded(value,length,field){assert.equal(typeof value,'string',field);const bytes=Buffer.from(value,'base64');assert.equal(bytes.length,length,field+' byte count');assert.equal(bytes.toString('base64'),value,field+' canonical encoding');return bytes;}

export function verifyHDPackage(root=project){
 root=resolve(root);const dist=resolve(root,'dist'),manifestPath=resolve(dist,'hd/manifest.json'),manifest=json(manifestPath);
 assert.equal(manifest.source.preloadSha256,json(resolve(root,'fidelity/native-build.json')).outputs['dune-native.data'],'HD geometry binds preloaded original data');
 assert.equal(manifest.schema,1);assert.equal(manifest.scale,4);assert.equal(manifest.palette.length,768);assert(manifest.palette.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
 assert.deepEqual(manifest.semantics.unitHouseRange,[144,152]);assert.deepEqual(manifest.semantics.tileHouseRangeOriginalMode,[144,159]);
 const assets=[];
 function image(row,key,{atlas=false}={}){
  assert(row&&typeof row==='object',key);assert(digest(row.sha256),key+' digest');assert.equal(typeof row.src,'string');
  assert.match(row.src,/^hd\/[A-Za-z0-9_-]+-([a-f0-9]{16})\.png$/,key+' content-addressed PNG');assert(basename(row.src).endsWith('-'+row.sha256.slice(0,16)+'.png'),key+' name binds content');
  const path=resolve(dist,row.src),inside=relative(dist,path);assert(inside!=='..'&&!inside.startsWith('../')&&!isAbsolute(inside),key+' public path');
  const bytes=readFileSync(path);assert.equal(hash(bytes),row.sha256,key+' file hash');assert(bytes.subarray(0,8).equals(pngSignature),key+' PNG');assert.equal(bytes.readUInt32BE(16),row.width,key+' width');assert.equal(bytes.readUInt32BE(20),row.height,key+' height');
  assert(Number.isInteger(row.width)&&row.width>0&&Number.isInteger(row.height)&&row.height>0);if(atlas)assert(Math.max(row.width,row.height)<=4096,key+' texture bound');if(row.bytes!==undefined)assert.equal(bytes.length,row.bytes,key+' bytes');
  assets.push({src:row.src,sha256:row.sha256,bytes:bytes.length});
 }
 const atlases=Object.entries(manifest.atlases);assert(atlases.length>=3);for(const[key,row]of atlases)image(row,key,{atlas:true});
 const expected={tiles:389,units:244,ui:281};let shapeIds=[];
 for(const[kind,count]of Object.entries(expected)){
  const frames=manifest.frames[kind];assert.equal(Object.keys(frames).length,count,kind+' coverage');
  for(const[id,f]of Object.entries(frames)){
   assert.match(id,/^(?:0|[1-9][0-9]*)$/,kind+' native ID');const atlas=manifest.atlases[f.atlas??kind];assert(atlas,kind+'/'+id+' atlas');
   for(const key of ['x','y','w','h','sourceW','sourceH'])assert(Number.isSafeInteger(f[key]),kind+'/'+id+' '+key);
   assert(f.x>=0&&f.y>=0&&f.sourceW>0&&f.sourceH>0);assert.equal(f.x%4,0);assert.equal(f.y%4,0);assert.equal(f.w,f.sourceW*4);assert.equal(f.h,f.sourceH*4);assert(f.x+f.w<=atlas.width&&f.y+f.h<=atlas.height,kind+'/'+id+' rectangle');
   assert(['local16','global256'].includes(f.paletteMode));const size=f.sourceW*f.sourceH,indices=decoded(f.indicesBase64,size,kind+'/'+id+' source indices'),mask=decoded(f.maskBase64,size,kind+'/'+id+' source mask'),render=decoded(f.renderIndicesBase64,f.w*f.h,kind+'/'+id+' HD indices');
   assert(mask.every(v=>v===0||v===1));assert(digest(f.sourceSHA256),kind+'/'+id+' original frame digest');
   if(f.paletteMode==='local16'){assert.equal(f.palette.length,16);assert(f.palette.every(v=>Number.isInteger(v)&&v>=0&&v<=255));assert(indices.every(v=>v<=15));assert(render.every(v=>v<=15));}
   if(kind!=='tiles')shapeIds.push(Number(id));
  }
 }
 assert.deepEqual(Object.keys(manifest.frames.tiles).map(Number).sort((a,b)=>a-b),Array.from({length:389},(_,i)=>i));assert.deepEqual(Object.keys(manifest.frames.units).map(Number).sort((a,b)=>a-b),Array.from({length:244},(_,i)=>i+111));assert.deepEqual(shapeIds.sort((a,b)=>a-b),Array.from({length:525},(_,i)=>i));
 assert.equal(Object.keys(manifest.screens).length,16);for(const[key,row]of Object.entries(manifest.screens)){assert.equal(row.width,row.sourceW*4);assert.equal(row.height,row.sourceH*4);image(row,'screen/'+key);}
 for(const key of ['brass','steel'])assert(manifest.uiMaterials[key],key+' UI material');for(const[key,row]of Object.entries(manifest.uiMaterials))image(row,'UI material/'+key);
 assert.equal(manifest.coverage.tileFrames,389);assert.equal(manifest.coverage.unitFrames,244);assert.equal(manifest.coverage.uiFrames,281);assert.equal(manifest.coverage.nativeSHPFrames,525);assert.equal(manifest.coverage.wsasStoredAsHD,0);
 const cover=readFileSync(resolve(dist,'hd/cover.png')),coverRecord=json(resolve(root,'art/hd-v1/generation-cover.json'));assert(cover.subarray(0,8).equals(pngSignature));assert.equal(hash(cover),coverRecord.sha256,'generated cover provenance');
 const materials=readFileSync(resolve(root,'art/hd-v1/materials-source.png'));assert.equal(hash(materials),manifest.source.materialsSha256,'generated material provenance');
 const html=readFileSync(resolve(dist,'index.html'),'utf8'),canvases=new Map([...html.matchAll(/<canvas\b([^>]*)>/g)].map(([,text])=>{const attrs=Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]));return[attrs.id,attrs];}));
 assert.equal(canvases.get('canvas')?.width,'320');assert.equal(canvases.get('canvas')?.height,'200');assert.equal(canvases.get('hd-canvas')?.width,'1280');assert.equal(canvases.get('hd-canvas')?.height,'800');assert.equal(canvases.get('hd-canvas')?.['aria-hidden'],'true');
 const select=html.match(/<select\b[^>]*\bid="graphics"[^>]*>([\s\S]*?)<\/select>/);assert(select,'graphics mode control');assert.match(select[1],/value="hd"/);assert.match(select[1],/value="original"/);
 for(const file of ['hd-core.mjs','hd-renderer.mjs'])assert(readFileSync(resolve(dist,file)).length>0,file+' module');const host=readFileSync(resolve(dist,'native-host.mjs'),'utf8');assert(host.includes("import('./hd-renderer.mjs')"));assert(host.includes('duneHdPresent:'));assert(host.includes('duneHdEnabled:'));
 return{manifestSha256:hash(readFileSync(manifestPath)),scale:manifest.scale,tileFrames:389,unitFrames:244,uiFrames:281,nativeSHPFrames:525,assets:assets.length,assetBytes:assets.reduce((n,r)=>n+r.bytes,0),coverSha256:hash(cover)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyHDPackage(),null,2));
