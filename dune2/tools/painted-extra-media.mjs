// Deterministic new-art phase baking for six ordinary Mentat illustrations.
// Original indices select native phases/indicator gains; never supply RGB art.
import fs from'node:fs';
import path from'node:path';
import crypto from'node:crypto';
import{decodePNG,encodePNG}from'./painted-png.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const byte=n=>Math.max(0,Math.min(255,Math.round(n)));
const surface=(width,height)=>({width,height,pixels:new Uint8Array(width*height*4)});
function blit(dest,source,[sx,sy,sw,sh],[dx,dy,dw,dh]){
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const fx=sx+(x+.5)*sw/dw-.5,fy=sy+(y+.5)*sh/dh-.5,x0=Math.max(sx,Math.min(sx+sw-1,Math.floor(fx))),y0=Math.max(sy,Math.min(sy+sh-1,Math.floor(fy))),x1=Math.min(sx+sw-1,x0+1),y1=Math.min(sy+sh-1,y0+1),wx=Math.max(0,Math.min(1,fx-x0)),wy=Math.max(0,Math.min(1,fy-y0)),q=((dy+y)*dest.width+dx+x)*4;
  for(let c=0;c<4;c++)dest.pixels[q+c]=byte(source.pixels[(y0*source.width+x0)*4+c]*(1-wx)*(1-wy)+source.pixels[(y0*source.width+x1)*4+c]*wx*(1-wy)+source.pixels[(y1*source.width+x0)*4+c]*(1-wx)*wy+source.pixels[(y1*source.width+x1)*4+c]*wx*wy);
 }
}
function copy(image){return{...image,pixels:image.pixels.slice()};}
function crop(image,rect){const out=surface(rect[2],rect[3]);blit(out,image,rect,[0,0,...rect.slice(2)]);return out;}
function sample(image,u,v){const fx=((u%1+1)%1)*(image.width-1),fy=Math.max(0,Math.min(1,v))*(image.height-1),x=Math.floor(fx),y=Math.floor(fy),xx=Math.min(image.width-1,x+1),yy=Math.min(image.height-1,y+1),a=fx-x,b=fy-y;return[0,1,2].map(c=>image.pixels[(y*image.width+x)*4+c]*(1-a)*(1-b)+image.pixels[(y*image.width+xx)*4+c]*a*(1-b)+image.pixels[(yy*image.width+x)*4+c]*(1-a)*b+image.pixels[(yy*image.width+xx)*4+c]*a*b);}
function periodicSample(image,u,v){u=(u%1+1)%1;const rgb=sample(image,u,v),edge=.045,d=Math.min(u,1-u);if(d<edge){const other=sample(image,1-u,v),mix=.5*(1-d/edge)**2;for(let c=0;c<3;c++)rgb[c]=rgb[c]*(1-mix)+other[c]*mix;}return rgb;}
function blend(image,x,y,rgb,a){if(x<0||y<0||x>=image.width||y>=image.height)return;const p=(y*image.width+x)*4;for(let c=0;c<3;c++)image.pixels[p+c]=byte(image.pixels[p+c]*(1-a)+rgb[c]*a);image.pixels[p+3]=255;}
function clearBlack(image,rect){const[x,y,w,h]=rect.map(n=>n*4);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const p=(yy*image.width+xx)*4;image.pixels[p]=image.pixels[p+1]=image.pixels[p+2]=0;image.pixels[p+3]=255;}}
function star(image,x,y){x=Math.round(x*4);y=Math.round(y*4);for(let d=-5;d<=5;d++){const a=.65*(1-Math.abs(d)/6);blend(image,x+d,y,[70,125,235],a);blend(image,x,y+d,[70,125,235],a);}blend(image,x,y,[190,220,255],1);}
const planetRect=[95,23,82,77];
const planetModels=[{cx:135.5,cy:66.5,rx:38,ry:31.5,exposure:1.12,rim:[45,95,235]},{cx:135.5,cy:65.5,rx:38,ry:32.5,exposure:.7,rim:[90,10,12]},{cx:135.5,cy:61,rx:39,ry:36.5,exposure:1.02,rim:[50,150,235]}];
function renderPlanet(texture,model,nativeFrame){
 const out=surface(planetRect[2]*4,planetRect[3]*4),angle=nativeFrame*Math.PI*2/30;
 for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){
  const px=planetRect[0]+(x+.5)/4,py=planetRect[1]+(y+.5)/4,nx=(px-model.cx)/model.rx,ny=(py-model.cy)/model.ry,r=Math.hypot(nx,ny),p=(y*out.width+x)*4;out.pixels[p+3]=255;
  if(r>1){const a=Math.exp(-(r-1)*95)*.32;if(a>.005)for(let c=0;c<3;c++)out.pixels[p+c]=byte(model.rim[c]*a);continue;}
  const nz=Math.sqrt(Math.max(0,1-r*r)),u=Math.atan2(nx,nz)/(2*Math.PI)+.5+angle/(2*Math.PI),v=.5+Math.asin(ny)/Math.PI,rgb=periodicSample(texture,u,v),light=(.34+.76*Math.max(0,-.45*nx-.25*ny+.86*nz))*model.exposure,edge=Math.min(1,(1-r)*Math.min(model.rx,model.ry)*4+.5),rim=Math.exp(-(1-r)*80)*.35;
  for(let c=0;c<3;c++)out.pixels[p+c]=byte((rgb[c]*light*(1-rim)+model.rim[c]*rim)*edge);
 }
 return out;
}
function indicatorPatch(base,rect,lamps){
 const image=crop(base,rect.map(n=>n*4)),points=lamps.map(l=>[(l.x-rect[0])*4,(l.y-rect[1])*4]),first=points[0],last=points.at(-1),dx=last[0]-first[0],dy=last[1]-first[1],length=dx*dx+dy*dy;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const t=length?Math.max(0,Math.min(1,((x+.5-first[0])*dx+(y+.5-first[1])*dy)/length)):0,d=Math.hypot(x+.5-first[0]-t*dx,y+.5-first[1]-t*dy),a=Math.max(0,Math.min(1,4.7-d));if(a)blend(image,x,y,[14,20,26],a);
 }
 lamps.forEach((l,i)=>{const[cx,cy]=points[i],level=l.level??.8;for(let y=Math.max(0,Math.floor(cy-5));y<Math.min(image.height,Math.ceil(cy+5));y++)for(let x=Math.max(0,Math.floor(cx-5));x<Math.min(image.width,Math.ceil(cx+5));x++){const d=Math.hypot((x+.5-cx)/2.2,(y+.5-cy)/1.6),a=d<1?Math.min(1,(1-d)*3):Math.exp(-d*d)*.32;blend(image,x,y,l.rgb.map(v=>v*(.2+.8*level)),a);if(Math.hypot(x+.5-cx+.6,y+.5-cy+.6)<.7)blend(image,x,y,[210,230,235],.7*level);}});
 return image;
}
export function extendPaintedMedia(base,{root}){
 const artRoot=path.join(root,'art/hd-v3/media'),outRoot=path.join(root,'dist/painted'),inventory=JSON.parse(fs.readFileSync(path.join(artRoot,'extra-motion/inventory.json'))),witnesses=JSON.parse(fs.readFileSync(path.join(artRoot,'extra-motion/global-frame-witnesses.json'))),m=structuredClone(base),raws={},rawMeta={},newArt={};
 for(const name of['extra-worlds','extra-troops','extra-planets']){const file='art/hd-v3/media/raw/'+name+'.png',bytes=fs.readFileSync(path.join(root,file)),meta=JSON.parse(fs.readFileSync(path.join(artRoot,'raw',name+'-generation.json')));if(sha(bytes)!==meta.sha256)throw Error('Extra source art changed: '+name);raws[name]=decodePNG(bytes);rawMeta[name]=meta;const prompt='art/hd-v3/media/raw/'+meta.prompt;newArt[name]={path:file,sha256:sha(bytes),prompt,promptSHA256:sha(fs.readFileSync(path.join(root,prompt))),method:'built-in-imagegen-whole-extra-media'};}
 const names=['FARTR.WSA','FHARK.WSA','FORDOS.WSA','WORM.WSA','FREMEN.WSA','SARDUKAR.WSA'],sourceRows=new Map(inventory.resources.map(r=>[r.resource,r])),bases=names.map((name,i)=>{const image=surface(736,448),group=i<4?'extra-worlds':'extra-troops',cell=i<4?i:i-4;blit(image,raws[group],rawMeta[group].sourceRects[cell],[0,0,736,448]);return image;}),baseAtlas=surface(2208,896),planetAtlases=[surface(1640,1848),surface(1640,1848),surface(1640,1848)],indicatorAtlas=surface(512,128),atlasImages={extraBases:baseAtlas,extraPlanet0:planetAtlases[0],extraPlanet1:planetAtlases[1],extraPlanet2:planetAtlases[2],extraIndicators:indicatorAtlas},textures=[0,1,2].map(i=>crop(raws['extra-planets'],rawMeta['extra-planets'].sourceRects[i])),records=[],controls={};
 for(let i=0;i<3;i++){
  clearBlack(bases[i],[94,16,90,96]);for(const[x,y]of[[180,18],[179,105],[96,105]])star(bases[i],x,y);
  const source=sourceRows.get(names[i]),frames={};
  for(let f=0;f<30;f++){const patch=renderPlanet(textures[i],planetModels[i],f),rect=[f%5*328,Math.floor(f/5)*308,328,308];blit(planetAtlases[i],patch,[0,0,328,308],rect);if(f===0)blit(bases[i],patch,[0,0,328,308],planetRect.map(n=>n*4));else frames[f]={atlas:'extraPlanet'+i,rect,nativeRect:planetRect,composite:'replace-on-base',status:'painted-derived-new-texture-native-planet-phase',sourceFrame:f,rotationRadians:f*Math.PI*2/30};}
  controls[names[i]]={kind:'planet-rotation',nativePhases:30,fullTurn:true,frameAngleFormula:'nativeFrame * 2PI /30; increasinglongitude sampling produces leftward feature motion',newTextureSourceRect:rawMeta['extra-planets'].sourceRects[i],newModel:planetModels[i],sourceEnvelope:source.changedBounds};records[i]={frames,model:controls[names[i]]};
 }
 const fremenRect=[28,32,7,5],sardRect=[31,14,11,10];
 for(const i of[4,5]){
  const source=sourceRows.get(names[i]),clean=copy(bases[i]),frames={};
  for(const f of source.frames){const c=f.indicatorControls,lamps=i===4?[{x:30.3,y:34.3,rgb:c.left==='red'?[245,48,35]:[42,225,70],level:.8},{x:32.9,y:33.6,rgb:c.right==='red'?[245,48,35]:[42,225,70],level:.8}]:[{x:34,y:16.7,rgb:[55,115,250],level:c.blue},{x:36.4,y:18.7,rgb:[245,50,35],level:c.red},{x:38.8,y:21,rgb:[45,225,70],level:c.green}],target=i===4?fremenRect:sardRect,patch=indicatorPatch(clean,target,lamps),slot=i===4?0:f.frame+1,rect=[slot%8*56,Math.floor(slot/8)*48,patch.width,patch.height];blit(indicatorAtlas,patch,[0,0,patch.width,patch.height],rect);if(f.frame===0)blit(bases[i],patch,[0,0,patch.width,patch.height],target.map(n=>n*4));else frames[f.frame]={atlas:'extraIndicators',rect,nativeRect:target,composite:'replace-on-base',status:'painted-derived-equipment-indicator-phase',sourceFrame:f.frame};}
  records[i]={frames};controls[names[i]]={kind:'equipment-indicators',nativeRect:source.changedBounds,newTarget:i===4?fremenRect:sardRect,physicalAttachment:'Small equipment/status strip; no body or weapon translation',nativeControls:source.frames.map(f=>({frame:f.frame,...f.indicatorControls}))};
 }
 for(let i=0;i<names.length;i++){
  const source=sourceRows.get(names[i]),rect=[i%3*736,Math.floor(i/3)*448,736,448];blit(baseAtlas,bases[i],[0,0,736,448],rect);const frames={'0':{atlas:'extraBases',rect,nativeW:184,nativeH:112,status:i<3?'painted-whole-scene-with-new-texture-planet':'painted-whole-preview',sourceFrame:0},...(records[i]?.frames??{})};
  m.resources[names[i]]={resource:names[i],sourceSHA256:source.resourceSha256,sourceArchive:source.archive,paletteResource:source.paletteResource,nativeRect:[128,48,184,112],nativeW:184,nativeH:112,housePaint:false,frameCount:source.frameCount,frames,renderMode:'painted-frame-sequence',motionStatus:source.frameCount===1?'static-native-preview':'painted-native-phase-frame-patches',visualPhaseSequence:source.visualPhaseSequence,nativeFrames:source.frames.map(f=>({frame:f.frame,pixelSHA256:f.pixelSha256,changedBounds:f.changedBounds,changedPixelCount:f.changedFromFirst,components:f.components,previousDeltaBounds:f.previousDeltaBounds,indicatorControls:f.indicatorControls})),semanticParts:source.semanticParts,motionClassification:source.classification,motionObservation:source.visualObservation,owners:source.owners,newArtBinding:controls[names[i]]??{kind:'static-whole-illustration'}};
  fs.writeFileSync(path.join(artRoot,'review',names[i].slice(0,-4).toLowerCase()+'-base.png'),encodePNG(736,448,bases[i].pixels));
 }
 for(const[id,image]of Object.entries(atlasImages)){const bytes=encodePNG(image.width,image.height,image.pixels),hash=sha(bytes),file='media-extra-'+id+'-'+hash.slice(0,16)+'.png';fs.writeFileSync(path.join(outRoot,file),bytes);m.atlases[id]={src:'painted/'+file,sha256:hash,w:image.width,h:image.height};}
 m.motion=witnesses;m.source.art={...m.source.art,...newArt};m.source.extraInventory='art/hd-v3/media/extra-motion/inventory.json';m.source.globalWitnesses='art/hd-v3/media/extra-motion/global-frame-witnesses.json';m.coverage={...m.coverage,baseResources:42,nativeFrameRecords:264,nativeDistinctImages:210,animatedResources:19,paintedWholeBaseImages:42,additionalNativePhasePatches:97,extraMotionResources:6,nativeOriginalPixelsReimposed:false};m.limits=m.limits.filter(s=>!s.startsWith('Only36')&&!s.startsWith('All42 ordinary')&&!s.startsWith('Homeworld surface art'));m.limits.push('All42 ordinary Mentat preview resources are covered; intro/finale WSA cinematics remain separately owned.','Homeworld surface art is newly interpreted; native phase count/order, globe envelopes and source-index identity remain authoritative. Rotation uses newly painted texturemaps, not original RGB.');
 if(Object.keys(m.resources).length!==42||m.motion.totalFrames!==264)throw Error('Incomplete42-resource media extension');
 fs.writeFileSync(path.join(artRoot,'extra-motion/painted-bindings.json'),JSON.stringify({schema:1,controls,resources:names,art:newArt,atlases:Object.fromEntries(Object.keys(atlasImages).map(id=>[id,m.atlases[id]])),phasePatchCount:97,originalRGBShading:false},null,2)+'\n');
 return m;
}
export function pruneExtraAtlases(manifest,{root}){const folder=path.join(root,'dist/painted'),keep=new Set(Object.values(manifest.atlases).map(a=>path.basename(a.src)));for(const name of fs.readdirSync(folder))if(/^media-extra-.*-[a-f0-9]{16}\.png$/.test(name)&&!keep.has(name))fs.unlinkSync(path.join(folder,name));}
