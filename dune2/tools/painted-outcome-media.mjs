// Additive packing of four complete mission-outcome paintings. Source indices
// identify the original scene; all displayed RGB comes from retained new art.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {decodePNG,encodePNG} from './painted-png.mjs';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const surface=(width,height)=>({width,height,pixels:new Uint8Array(width*height*4)});
function blit(dest,source,[sx,sy,sw,sh],[dx,dy,dw,dh]){
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const fx=sx+(x+.5)*sw/dw-.5,fy=sy+(y+.5)*sh/dh-.5,
   x0=Math.max(sx,Math.min(sx+sw-1,Math.floor(fx))),y0=Math.max(sy,Math.min(sy+sh-1,Math.floor(fy))),
   x1=Math.min(sx+sw-1,x0+1),y1=Math.min(sy+sh-1,y0+1),
   wx=Math.max(0,Math.min(1,fx-x0)),wy=Math.max(0,Math.min(1,fy-y0)),q=((dy+y)*dest.width+dx+x)*4;
  for(let c=0;c<4;c++)dest.pixels[q+c]=Math.round(source.pixels[(y0*source.width+x0)*4+c]*(1-wx)*(1-wy)+source.pixels[(y0*source.width+x1)*4+c]*wx*(1-wy)+source.pixels[(y1*source.width+x0)*4+c]*(1-wx)*wy+source.pixels[(y1*source.width+x1)*4+c]*wx*wy);
 }
}
export function extendOutcomeMedia(base,{root}){
 const artRoot=path.join(root,'art/hd-v3/media'),outRoot=path.join(root,'dist/painted'),
  read=name=>JSON.parse(fs.readFileSync(path.join(artRoot,name))),
  preserved=read('outcomes/preserved42.json'),inventory=read('outcome-motion/inventory.json'),
  witnesses=read('outcome-motion/global-frame-witnesses.json'),audit=read('outcome-motion/ordinary-coverage-audit.json'),
  meta=read('outcomes/outcomes-generation.json'),rawPath='art/hd-v3/media/outcomes/outcomes.png',
  raw=fs.readFileSync(path.join(root,rawPath)),image=decodePNG(raw),m=structuredClone(base),atlas=surface(1472,896),packing=[];
 if(Object.keys(base.resources).length!==42||base.motion.totalFrames!==264)throw Error('Outcome extension requires the complete previous42 media bank');
 for(const[id,row]of Object.entries(preserved.atlases)){
  if(JSON.stringify(base.atlases[id])!==JSON.stringify(row)||sha(fs.readFileSync(path.join(root,'dist',row.src)))!==row.sha256)throw Error('Previous42 atlas bytes changed: '+id);
 }
 if(sha(raw)!==meta.sha256||image.width!==meta.dimensions[0]||image.height!==meta.dimensions[1]||image.width<1472||image.height<896)throw Error('Outcome raw painting hash/dimensions changed');
 const prompt='art/hd-v3/media/outcomes/'+meta.prompt;
 if(sha(fs.readFileSync(path.join(root,prompt)))!==meta.promptSHA256)throw Error('Outcome prompt changed');
 for(const reference of meta.references)if(sha(fs.readFileSync(path.join(root,reference.path)))!==reference.sha256)throw Error('Outcome input reference changed: '+reference.path);
 for(let i=0;i<inventory.resources.length;i++){
  const source=inventory.resources[i],sourceRect=meta.sourceRects[i],rect=[i%2*736,Math.floor(i/2)*448,736,448],baseImage=surface(736,448);
  if(source.frameCount!==1||!source.loopMatchesFirst||source.nativeWidth!==184||source.nativeHeight!==112)throw Error('Unexpected outcome native phase layout');
  if(sourceRect.length!==4||sourceRect.some(v=>!Number.isInteger(v)||v<0)||sourceRect[0]+sourceRect[2]>image.width||sourceRect[1]+sourceRect[3]>image.height)throw Error('Invalid outcome source crop');
  blit(baseImage,image,sourceRect,[0,0,736,448]);blit(atlas,baseImage,[0,0,736,448],rect);
  m.resources[source.resource]={resource:source.resource,sourceSHA256:source.resourceSha256,sourceArchive:source.archive,paletteResource:source.paletteResource,nativeRect:[128,48,184,112],nativeW:184,nativeH:112,housePaint:false,frameCount:1,frames:{'0':{atlas:'outcomeBases',rect,nativeW:184,nativeH:112,status:'painted-whole-preview',sourceFrame:0}},renderMode:'painted-frame-sequence',motionStatus:'static-native-preview',visualPhaseSequence:[0],nativeFrames:source.frames.map(f=>({frame:f.frame,pixelSHA256:f.pixelSha256,changedBounds:null,changedPixelCount:0,components:[],previousDeltaBounds:null})),semanticParts:[],motionClassification:source.classification,motionObservation:source.visualObservation,owners:source.owners,newArtBinding:{kind:'static-whole-illustration',sourceRect,rawPath}};
  fs.writeFileSync(path.join(artRoot,'review',source.resource.slice(0,-4).toLowerCase()+'-base.png'),encodePNG(736,448,baseImage.pixels));
  packing.push({resource:source.resource,sourceRect,atlas:'outcomeBases',rect});
 }
 const bytes=encodePNG(atlas.width,atlas.height,atlas.pixels),digest=sha(bytes),file='media-outcomes-'+digest.slice(0,16)+'.png';
 fs.writeFileSync(path.join(outRoot,file),bytes);m.atlases.outcomeBases={src:'painted/'+file,sha256:digest,w:atlas.width,h:atlas.height};
 m.motion=witnesses;m.source.art.outcomes={path:rawPath,sha256:meta.sha256,prompt,promptSHA256:meta.promptSHA256,method:'built-in-imagegen-whole-outcome-previews',dimensions:meta.dimensions,references:meta.references};
 m.source.outcomeInventory='art/hd-v3/media/outcome-motion/inventory.json';m.source.globalWitnesses='art/hd-v3/media/outcome-motion/global-frame-witnesses.json';m.source.ordinaryCoverageAudit='art/hd-v3/media/outcome-motion/ordinary-coverage-audit.json';
 m.coverage={...m.coverage,baseResources:46,nativeFrameRecords:268,nativeDistinctImages:214,paintedWholeBaseImages:46,outcomeResources:4,ordinaryScenarioCount:66,ordinaryHelpResources:40,ordinaryMissingResources:0,preserved42AtlasCount:Object.keys(preserved.atlases).length};
 m.limits=m.limits.filter(s=>!s.startsWith('All42 ordinary'));m.limits.push('All46 ordinary unit/structure, Mentat/help, homeworld and scenario briefing/win/loss preview resources are covered; intro/finale WSA cinematics remain separately owned.');
 if(Object.keys(m.resources).length!==46||witnesses.totalFrames!==268||witnesses.distinctFrameCount!==214||audit.missingResources.length||audit.ordinaryResources.some(name=>!m.resources[name]))throw Error('Incomplete46-resource ordinary media extension');
 fs.writeFileSync(path.join(artRoot,'outcomes/packing.json'),JSON.stringify({schema:1,packing,art:m.source.art.outcomes,atlas:m.atlases.outcomeBases,preserved42Atlases:preserved.atlases,originalRGBShading:false},null,2)+'\n');
 return m;
}
export function pruneOutcomeAtlases(manifest,{root}){
 const folder=path.join(root,'dist/painted'),keep=new Set(Object.values(manifest.atlases).map(a=>path.basename(a.src)));
 for(const name of fs.readdirSync(folder))if(/^media-outcomes-[a-f0-9]{16}\.png$/.test(name)&&!keep.has(name))fs.unlinkSync(path.join(folder,name));
}
