import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readPak,parseIni,verifyPreload} from '../tools/preload-data.mjs';
import {decodePNG} from '../tools/painted-png.mjs';
import {compileMediaWitnesses,identifyMediaFrame,mediaMotionPlan} from '../dist/painted-media-core.mjs';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const art='art/hd-v3/media/',m=json('dist/painted/media.json'),inventory=json(art+'outcome-motion/inventory.json'),audit=json(art+'outcome-motion/ordinary-coverage-audit.json'),preserved=json(art+'outcomes/preserved42.json');
const outcomes=['WIN1.WSA','WIN2.WSA','LOSTBILD.WSA','LOSTVEHC.WSA'];
test('four outcomes are original single-frame184x112 previews, not duplicate loop phases',()=>{
 assert.deepEqual(inventory.resources.map(r=>r.resource),outcomes);
 const originals=readPak('DUNE.PAK');
 for(const r of inventory.resources){
  const source=originals.get(r.resource),raw=source.bytes;
  assert.equal(source.sha256,r.resourceSha256);assert.equal(raw.subarray(0,10).toString('hex'),r.rawHeader.littleEndianHex);
  assert.deepEqual([0,2,4,6,8].map(p=>raw.readUInt16LE(p)),[1,184,112,r.rawHeader.bufferHint,0]);
  assert.equal(r.rawHeader.sourceBytes,source.size);assert.equal(r.frameCount,1);assert.equal(r.loopRecordFrame,1);assert.equal(r.loopMatchesFirst,true);
  assert.equal(r.decoderEvidence.frames.length,2);assert.equal(r.decoderEvidence.frames[0].pixel_sha256,r.decoderEvidence.frames[1].pixel_sha256);
  const pixels=read(art+'outcome-motion/'+r.frames[0].indexFile);assert.equal(pixels.length,184*112);assert.equal(sha(pixels),r.frames[0].pixelSha256);
  assert.equal(m.resources[r.resource].sourceSHA256,source.sha256);assert.equal(m.resources[r.resource].housePaint,false);
 }
 assert.equal(inventory.frameCount,4);
});
test('additive46 bank preserves all ten previous42 atlas files and all264 phase identities',()=>{
 assert.equal(Object.keys(m.resources).length,46);assert.equal(preserved.resources.length,42);assert.equal(Object.keys(preserved.atlases).length,10);
 for(const[id,row]of Object.entries(preserved.atlases)){assert.deepEqual(m.atlases[id],row);assert.equal(sha(read('dist/'+row.src)),row.sha256);}
 assert.deepEqual(Object.keys(m.resources).filter(name=>!outcomes.includes(name)),preserved.resources);
 const old=json(art+'extra-motion/global-frame-witnesses.json');
 assert.deepEqual(m.motion.coordinates,old.coordinates);assert.equal(m.motion.frames.length,268);assert.equal(m.motion.distinctFrameCount,214);
 assert.deepEqual(m.motion.frames.slice(0,264),old.frames);
 assert.equal(m.motion.preserved42.witnessBankSHA256,sha(read(art+'extra-motion/global-frame-witnesses.json')));
});
test('new outcome atlas is whole opaque new art with retained raw/prompt/reference provenance',()=>{
 const meta=json(art+'outcomes/outcomes-generation.json'),raw=read(art+'outcomes/outcomes.png'),image=decodePNG(raw);
 assert.equal(meta.tool,'built-in image_gen.imagegen');assert.equal(meta.copiedWithoutModification,true);
 assert(image.width>=1472&&image.height>=896);assert.deepEqual([image.width,image.height],meta.dimensions);assert.equal(sha(raw),meta.sha256);
 assert.equal(sha(read(art+'outcomes/'+meta.prompt)),meta.promptSHA256);
 for(const ref of meta.references)assert.equal(sha(read(ref.path)),ref.sha256);
 const atlasRow=m.atlases.outcomeBases,atlas=decodePNG(read('dist/'+atlasRow.src));assert(atlas.width<=2048&&atlas.height<=2048);assert.deepEqual([atlas.width,atlas.height],[1472,896]);assert.equal(sha(read('dist/'+atlasRow.src)),atlasRow.sha256);
 for(const name of outcomes){
  const row=m.resources[name],frame=row.frames[0],base=decodePNG(read(art+'review/'+name.slice(0,-4).toLowerCase()+'-base.png'));
  assert.equal(row.frameCount,1);assert.equal(Object.keys(row.frames).length,1);assert.deepEqual(frame.rect.slice(2),[736,448]);
  const plan=mediaMotionPlan(row,0);assert.equal(plan.supported,true);assert.deepEqual(plan.operations,[]);assert.deepEqual(plan.bakedFrame,frame);
  for(let y=0;y<448;y++){
   const at=((frame.rect[1]+y)*atlas.width+frame.rect[0])*4;assert.deepEqual(atlas.pixels.subarray(at,at+736*4),base.pixels.subarray(y*736*4,(y+1)*736*4));
   for(let x=0;x<736;x++)assert.equal(base.pixels[(y*736+x)*4+3],255);
  }
 }
});
test('all four outcome witnesses identify exactly and never approximate a changed original',()=>{
 const bank=compileMediaWitnesses(m.motion);
 for(const source of inventory.resources){
  const raw=read(art+'outcome-motion/'+source.frames[0].indexFile),pixels=new Uint8Array(64000);
  for(let y=0;y<112;y++)pixels.set(raw.subarray(y*184,(y+1)*184),(48+y)*320+128);
  const match=identifyMediaFrame({pixels,worldVisible:false},bank);assert.equal(match.status,'matched');assert.equal(match.resource,source.resource);assert.equal(match.frame,0);assert.equal(match.samples,33);
  for(const[x,y]of bank.coordinates)pixels[(48+y)*320+128+x]^=255;
  assert.equal(identifyMediaFrame({pixels,worldVisible:false},bank).status,'unknown');
 }
});
test('ordinary coverage includes every original scenario BASIC picture and compressed help preview',()=>{
 assert.equal(audit.sourcePreloadSHA256,verifyPreload().packageSha256);assert.equal(audit.scenarioCount,66);assert.equal(audit.scenarios.length,66);
 assert.equal(audit.helpFiles.length,3);assert.equal(audit.helpResources.length,40);assert.equal(audit.ordinaryResources.length,46);assert.deepEqual(audit.missingResources,[]);
 assert.deepEqual(audit.outcome4Resources,outcomes);assert.equal(audit.original36Resources.length,36);assert.equal(audit.extra6Resources.length,6);
 const scenarioPak=readPak('SCENARIO.PAK'),seen=new Set();
 for(const row of audit.scenarios){
  const source=scenarioPak.get(row.resource);assert.equal(source.sha256,row.sourceSHA256);const sections=parseIni(source.bytes),basic=sections.BASIC;
  for(const[field,fallback]of Object.entries(audit.nativeDefaults)){const picture=(basic[field]??fallback).toUpperCase();assert.equal(row.pictures[field],picture);assert(m.resources[picture],row.resource+' '+field+' '+picture);seen.add(picture);}
 }
 assert.deepEqual([...seen].sort(),audit.scenarioResources);
 assert.deepEqual(audit.useCounts.WinPicture,{'WIN1.WSA':27,'WIN2.WSA':39});assert.deepEqual(audit.useCounts.LosePicture,{'LOSTBILD.WSA':36,'LOSTVEHC.WSA':30});
 // Decode the picture prefix independently from the original help bytes. The
 // native digraph scheme compresses resource names, so plain .WSA scans miss them.
 const couples=' etainosrlhcdupm'+'tasio wb'+' rnsdalm'+'h ieoras'+'nrtlc sy'+'nstcloer'+' dtgesio'+'nr ufmsw'+' tep.ica'+'e oiadur'+' laeiyod'+'eia otru'+'etoakhlr'+' eiu,.oa'+'nsrctlai'+'leoiratp'+'eaoip bm';
 const helpSeen=new Set(),english=readPak('ENGLISH.PAK');
 for(const file of audit.helpFiles){
  const source=english.get(file.resource);assert.equal(file.sourceSHA256,source.sha256);
  for(const subject of file.subjects){
   let prefix='';for(let i=subject.offset;i<source.bytes.length;i++){
    let c=source.bytes[i];if(!c||c===42||c===63)break;
    if(c&128){c&=127;prefix+=couples[c>>3];c=couples.charCodeAt(c+16);}else if(c===27)c=127+source.bytes[++i];
    prefix+=String.fromCharCode(c);assert(prefix.length<256);
   }
   const picture=prefix.toUpperCase().endsWith('.WSA')?prefix.toUpperCase():null;assert.equal(subject.picture,picture);
   if(picture){assert(m.resources[picture],file.resource+' '+picture);helpSeen.add(picture);}
  }
 }
 assert.deepEqual([...helpSeen].sort(),audit.helpResources);
 for(const name of audit.ordinaryResources)assert(m.resources[name],name+' must not disappear from the ordinary preview bank');
});
