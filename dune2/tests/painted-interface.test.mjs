import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodePNG} from '../tools/painted-png.mjs';
import {campaignBoundaryPaths} from '../tools/painted-campaign-contours.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(ROOT,file));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bank=JSON.parse(read('dist/painted/interface.json'));
const atlases=Object.fromEntries(Object.entries(bank.atlases).map(([id,row])=>[id,decodePNG(read('dist/'+row.src))]));
const pixel=(frame,x,y)=>{const atlas=atlases[frame.atlas],p=((frame.rect[1]+y)*atlas.width+frame.rect[0]+x)*4;return atlas.pixels.subarray(p,p+4);};

test('all interface production assets have hash-bound generated sources and valid native geometry',()=>{
 assert.equal(bank.schema,1);assert.equal(bank.scale,4);assert.equal(Object.keys(bank.frames).length,23);
 for(const[id,atlas]of Object.entries(bank.atlases)){assert.equal(hash(read('dist/'+atlas.src)),atlas.sha256);assert.deepEqual([atlases[id].width,atlases[id].height],[atlas.w,atlas.h]);}
 for(const frame of Object.values(bank.frames)){const a=bank.atlases[frame.atlas],r=frame.rect;assert(r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=a.w&&r[1]+r[3]<=a.h);assert.deepEqual(r.slice(2),frame.nativeRect.slice(2).map(n=>n*4));if(frame.nineSlice){const[l,t,rr,b]=frame.nineSlice;assert(l+rr<frame.nativeRect[2]);assert(t+b<frame.nativeRect[3]);}}
 for(const row of Object.values(bank.source.art)){assert.equal(hash(read(row.path)),row.sha256);assert.equal(hash(read(row.prompt)),row.promptSHA256);assert.equal(row.method,'built-in-imagegen-whole-object');}
});

test('HUD cannot cover gameplay or live minimap and preserves every native click rectangle',()=>{
 for(const id of['hud-shell','hud-frame-only']){const frame=bank.frames[id];for(const[x,y,w,h]of frame.transparentRects)for(let yy=y*4;yy<(y+h)*4;yy++)for(let xx=x*4;xx<(x+w)*4;xx++)assert.equal(pixel(frame,xx,yy)[3],0);}
 assert.deepEqual(bank.frames['hud-shell'].nativeRect,[0,0,320,200]);
 const native=JSON.parse(read('art/hd-v3/interface/native-inventory.json'));assert.deepEqual(bank.gameWidgets,native.gameWidgets);
 assert.deepEqual(bank.frames['house-choice'].clickRegions,[{house:1,nativeRect:[16,56,96,104]},{house:2,nativeRect:[112,56,96,104]},{house:0,nativeRect:[208,56,96,104]}]);
});

test('advisor patch bases are identical to production atlas and source scene witnesses remain exact',()=>{
 for(const name of['h','a','o','m']){const frame=bank.frames['advisor-'+name],base=decodePNG(read('art/hd-v3/interface/review/advisor-'+name+'-base.png'));assert.equal(frame.housePaint,false);assert.deepEqual([base.width,base.height],[1280,800]);for(let y=0;y<800;y++){const a=atlases[frame.atlas],start=((frame.rect[1]+y)*a.width+frame.rect[0])*4;assert.deepEqual(a.pixels.subarray(start,start+1280*4),base.pixels.subarray(y*1280*4,(y+1)*1280*4));}}
 assert.equal(Object.keys(bank.scenes).length,14);
 for(const scene of Object.values(bank.scenes)){const indices=Buffer.from(scene.indicesBase64,'base64');assert.equal(indices.length,64000);assert.equal(hash(indices),scene.indexedSHA256);assert(scene.witnesses.length>=24);assert(new Set(scene.witnesses.map(p=>p[2])).size>1);for(const[x,y,index]of scene.witnesses){assert.equal(indices[y*320+x],index);assert(index>0);}}
 assert.equal(bank.scenes['MENTATM.CPS'].paletteResource,'BENE.PAL');assert.equal(Buffer.from(bank.scenes['MENTATM.CPS'].palette6Base64,'base64').length,768);
});

test('campaign uses one unchanged region-ID source and all native province positions',()=>{
 const data=Buffer.from(bank.campaign.semanticClickData.indicesBase64,'base64'),before=Buffer.from(data);assert.equal(data.length,304*120);assert.equal(hash(data),bank.campaign.semanticClickData.indexedSHA256);assert.equal(bank.campaign.regions.length,27);
 const paths=campaignBoundaryPaths(data);assert.deepEqual(data,before);assert.deepEqual(paths,bank.campaign.boundaryNetworkPaths);assert(paths.length>20);for(const p of paths)for(const[x,y]of p){assert(x>=0&&x<=304);assert(y>=0&&y<=120);}
 for(const id of['campaign-undivided','campaign-regions','campaign-region-lines','campaign-planet'])assert.deepEqual(bank.frames[id].nativeRect,[8,24,304,120]);
 const shell=bank.frames['campaign-shell'];for(let y=24*4;y<144*4;y++)for(let x=8*4;x<312*4;x++)assert.equal(pixel(shell,x,y)[3],0);
 assert.equal(bank.scenes['FAME.CPS'].asset,'score-shell');assert.deepEqual(bank.frames['score-shell'].crestWells.map(w=>w.nativeRect),[[0,8,56,56],[264,8,56,56]]);
});

test('native composed crest copies retain pixel coordinates, remaps and asymmetric score fallbacks',()=>{
 assert.equal(bank.crestCompositions.families.factory.variants.length,6);assert.deepEqual(bank.crestCompositions.families.factory.variants[2].copies[0].sourceRect,[128,48,56,40]);
 for(const family of Object.values(bank.crestCompositions.families))for(const variant of family.variants)for(const copy of variant.copies){const source=Buffer.from(copy.sourceIndicesBase64,'base64'),expected=Buffer.from(copy.expectedIndicesBase64,'base64'),[x,y,w,h]=copy.sourceRect,scene=Buffer.from(bank.scenes[copy.sourceResource].indicesBase64,'base64');assert.equal(source.length,w*h);assert.equal(hash(expected),copy.expectedIndexedSHA256);for(let yy=0;yy<h;yy++)assert.deepEqual(source.subarray(yy*w,(yy+1)*w),scene.subarray((y+yy)*320+x,(y+yy)*320+x+w));for(let i=0;i<source.length;i++)assert.equal(expected[i],copy.remapApplied&&source[i]>=144&&source[i]<=150?source[i]+variant.playerHouse*16:source[i]);}
 for(const house of[3,4,5])assert.deepEqual(bank.crestCompositions.families.score.variants[house].copies.map(c=>c.sourceHouse),[0,1]);
 for(const name of['MAPMACH.CPS','DUNEMAP.CPS','DUNERGN.CPS','PLANET.CPS']){const s=bank.scenes[name],pixels=Buffer.from(s.indicesBase64,'base64');assert.equal(s.displayWitnesses.length,48);for(const[x,y,v]of s.displayWitnesses)assert.equal(pixels[y*320+x],v);}
});
