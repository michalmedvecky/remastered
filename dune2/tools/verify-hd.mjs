// Read-only verification of Dune II's original-framebuffer upscale delivery.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const shaderFiles=['xbr-lv2.upstream.glsl','xbr-lv2.fragment.glsl','xbr.vertex.glsl','LICENSE.txt'];
const upstreamCommit='235448f244bf676d135f7b25ea6b8e1eae41c4e4';
const upstreamSha256='9cf5b08c7378305b558204354e898f6837c481fd5b4371dfbe6b5092cffe5062';

export function verifyUpscalePackage(root=project){
 root=resolve(root);const dist=resolve(root,'dist'),upscale=resolve(dist,'upscale');
 const provenanceBytes=readFileSync(resolve(upscale,'provenance.json')),provenance=JSON.parse(provenanceBytes);
 assert.equal(provenance.algorithm,'Hyllian xBR-lv2');assert.equal(provenance.license,'MIT');
 assert.equal(provenance.upstreamRepository,'https://github.com/libretro/glsl-shaders');
 assert.equal(provenance.upstreamCommit,upstreamCommit,'pinned upstream revision');
 assert.equal(provenance.sourceUrl,`https://raw.githubusercontent.com/libretro/glsl-shaders/${upstreamCommit}/xbr/shaders/xbr-lv2.glsl`);
 assert.equal(provenance.sourceSha256,upstreamSha256,'pinned upstream shader bytes');
 const files=[];
 for(const name of shaderFiles){
  const bytes=readFileSync(resolve(upscale,name)),digest=hash(bytes);
  assert.equal(digest,provenance.files?.[name],name+' provenance binding');
  if(name==='xbr-lv2.upstream.glsl')assert.equal(digest,upstreamSha256);
  files.push({src:'upscale/'+name,sha256:digest,bytes:bytes.length});
 }
 const license=readFileSync(resolve(upscale,'LICENSE.txt'),'utf8');
 assert.match(license,/Copyright[\s\S]*Hyllian/);assert.match(license,/Permission is hereby granted/);assert.match(license,/THE SOFTWARE IS PROVIDED "AS IS"/);
 const fragment=readFileSync(resolve(upscale,'xbr-lv2.fragment.glsl'),'utf8'),vertex=readFileSync(resolve(upscale,'xbr.vertex.glsl'),'utf8');
 assert.match(fragment,/#version 300 es/);assert.match(vertex,/#version 300 es/);
 for(const name of ['upscale-core.mjs','upscale-renderer.mjs']){
  const bytes=readFileSync(resolve(dist,name));assert(bytes.length>0,name);files.push({src:name,sha256:hash(bytes),bytes:bytes.length});
 }
 const renderer=readFileSync(resolve(dist,'upscale-renderer.mjs'),'utf8');
 assert(renderer.includes('createUpscaleRenderer'),'renderer entry point');
 assert(!renderer.includes('hd/manifest.json'),'generated atlas manifest must not load');
 assert(!renderer.includes('hd/cover.png'),'generated cover must not load');
 const html=readFileSync(resolve(dist,'index.html'),'utf8'),css=readFileSync(resolve(dist,'native-shell.css'),'utf8');
 const canvases=new Map([...html.matchAll(/<canvas\b([^>]*)>/g)].map(([,text])=>{const attrs=Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]));return[attrs.id,attrs];}));
 assert.equal(canvases.get('canvas')?.width,'320');assert.equal(canvases.get('canvas')?.height,'200');
 assert.equal(canvases.get('upscale-canvas')?.width,'1280');assert.equal(canvases.get('upscale-canvas')?.height,'800');assert.equal(canvases.get('upscale-canvas')?.['aria-hidden'],'true');
 const select=html.match(/<select\b[^>]*\bid="graphics"[^>]*>([\s\S]*?)<\/select>/);assert(select,'graphics mode control');assert.match(select[1],/value="upscale"/);assert.match(select[1],/value="original"/);assert(!/value="hd"/.test(select[1]),'retired material remaster mode');
 assert(!/hd\/cover\.png|hd\/manifest\.json/.test(html+css),'generated launch art must not be active');
 const host=readFileSync(resolve(dist,'native-host.mjs'),'utf8');assert(host.includes("import('./upscale-renderer.mjs')"));assert(host.includes('duneHdPresent:'));assert(host.includes('duneHdEnabled:'));
 assert(!existsSync(resolve(dist,'hd')),'retired generated art must not ship');
 assert.deepEqual(readdirSync(upscale).sort(),[...shaderFiles,'provenance.json'].sort(),'bounded upscaler dependency set');
 return{algorithm:provenance.algorithm,scale:4,width:1280,height:800,sourceWidth:320,sourceHeight:200,source:'authoritative original indexed framebuffer and active native palette',generatedArt:false,upstreamCommit,upstreamSha256,provenanceSha256:hash(provenanceBytes),files,bytes:files.reduce((n,r)=>n+r.bytes,0)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyUpscalePackage(),null,2));
