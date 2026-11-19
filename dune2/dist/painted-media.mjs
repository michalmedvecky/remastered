// New painted object illustrations with exact native-frame recognition.
// Native simulation, input and timing remain authoritative.
import {compileMediaWitnesses,identifyMediaFrame,mediaSceneKind,nativeMediaPhase,mediaMotionPlan} from './painted-media-core.mjs';
const SCALE=4;
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const loadImage=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Missing painted media atlas: '+url));image.src=url;});
const rectOf=row=>row.rect??[row.x,row.y,row.w,row.h];
export async function createPaintedMedia({manifestURL=new URL('./painted/media.json',import.meta.url)}={}){
  const response=await fetch(manifestURL);if(!response.ok)throw Error('Missing painted media manifest');
  const manifest=await response.json();if(manifest.schema!==1||manifest.scale!==4)throw Error('Unsupported painted media format');
  const witnesses=compileMediaWitnesses(manifest.motion),atlases=new Map(),bases=new Map(),cleanImages=new Map();
  await Promise.all(Object.entries(manifest.atlases).map(async([id,row])=>{
    const url=new URL(row.src.startsWith('painted/')?'../'+row.src:row.src,manifestURL).href;
    const image=await loadImage(url);if(image.naturalWidth!==row.w||image.naturalHeight!==row.h)throw Error('Painted media atlas geometry differs: '+id);atlases.set(id,image);
  }));
  for(const [name,row]of Object.entries(manifest.resources)){
    const entry=row.frames?.['0'],rect=entry&&rectOf(entry);if(!entry||!atlases.has(entry.atlas)||rect?.[2]!==736||rect?.[3]!==448)throw Error('Missing whole painted preview: '+name);
    const image=surface(736,448);image.getContext('2d').drawImage(atlases.get(entry.atlas),...rect,0,0,736,448);bases.set(name,image);
  }
  for(const [id,entry]of Object.entries(manifest.cleanplates??{})){
    const rect=rectOf(entry),image=surface(rect[2],rect[3]),context=image.getContext('2d',{willReadFrequently:true});
    if(!atlases.has(entry.atlas))throw Error('Missing painted cleanplate: '+id);
    context.drawImage(atlases.get(entry.atlas),...rect,0,0,rect[2],rect[3]);
    // One native pixel of alpha blending joins independently inpainted NEW art
    // to the NEW whole painting. No original RGB enters this cleanplate.
    const data=context.getImageData(0,0,image.width,image.height),edge=4;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
      const d=Math.min(x,y,image.width-1-x,image.height-1-y);
      data.data[(y*image.width+x)*4+3]*=Math.min(1,d/edge);
    }
    context.putImageData(data,0,0);cleanImages.set(id,image);
  }
  // Complete source-phase coverage is checked before launch, alongside atlases.
  for(const row of Object.values(manifest.resources))for(let f=0;f<row.frameCount;f++){
    const plan=mediaMotionPlan(row,f);if(!plan.supported)throw Error('Uncovered native media motion: '+row.resource);
    if(row.renderMode==='painted-frame-sequence'){
      const entry=plan.bakedFrame,rect=rectOf(entry),target=entry.nativeRect??[0,0,184,112],atlas=manifest.atlases[entry.atlas];
      if(!atlas||rect[0]<0||rect[1]<0||rect[0]+rect[2]>atlas.w||rect[1]+rect[3]>atlas.h||rect[2]!==target[2]*SCALE||rect[3]!==target[3]*SCALE||target[0]<0||target[1]<0||target[0]+target[2]>184||target[1]+target[3]>112||f>0&&entry.composite!=='replace-on-base')throw Error('Invalid painted native-phase patch: '+row.resource+':'+f);
    }
    for(const op of plan.operations)if(op.type==='asset'){
      if(!manifest.parts?.[op.id])throw Error('Missing native-phase painted part: '+op.id);
      if(op.clean&&!cleanImages.has(op.clean))throw Error('Missing native-phase cleanplate: '+op.clean);
    }
  }
  // All new pose and cleanplate assets are loaded before launch with the bases.
  const art=(ctx,entry,target)=>{const atlas=entry&&atlases.get(entry.atlas);if(!atlas)return false;ctx.drawImage(atlas,...rectOf(entry),...target);return true;};
  const working=surface(736,448),wc=working.getContext('2d');
  const ellipse=(c,x,y,rx,ry,fill)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();};
  function newEffect(c,op,base){
    const [x,y,w,h]=op.target,p=op.phase,n=Math.max(1,op.phases-1),t=p/n;
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    if(op.type==='fan'){
      // Rotate only the already-painted NEW fan disc, retaining its detailed
      // metallic blades and perspective rather than drawing a flat symbol.
      const cx=x+w/2,cy=y+h/2;c.translate(cx,cy);c.scale(w/2,h/2);
      c.beginPath();c.ellipse(0,0,.91,.86,0,0,Math.PI*2);c.clip();
      c.rotate(p*Math.PI/5);
      c.drawImage(base,x*SCALE,y*SCALE,w*SCALE,h*SCALE,-1,-1,2,2);
    }else if(op.type==='engine-highlight'){
      // The new illustration depicts ribbed motor housings. A restrained
      // moving reflection preserves that design without inventing a propeller.
      c.beginPath();c.ellipse(x+w*.45,y+h*.8,w*.5,h*.8,-.35,Math.PI*1.05,Math.PI*1.8);
      c.strokeStyle='rgba(147,185,194,.3)';c.lineWidth=.4;c.stroke();
    }else if(op.type==='steam'||op.type==='dust'){
      const steam=op.type==='steam',count=steam?5:7;
      for(let i=0;i<count;i++){
        const seed=(i*37+p*19)%97,u=i/(count-1),px=x+(steam?u*w:w*(.15+.7*((seed%19)/18))),py=y+h*(steam?.55+.19*Math.sin(i+p):.73-.45*((seed%13)/12));
        const radius=(steam?1.3:1.1)+(steam?2.7:2.2)*t;
        const g=c.createRadialGradient(px,py,0,px,py,radius);g.addColorStop(0,steam?'rgba(225,239,235,.68)':'rgba(213,171,95,.7)');g.addColorStop(1,steam?'rgba(225,239,235,0)':'rgba(191,143,71,0)');ellipse(c,px,py,radius,radius*(steam?.6:.45),g);
      }
    }else if(op.type==='flame'){
      // Purpose-authored smooth flame silhouettes; phase changes shape/light,
      // without remapping source pixel colours into the painted illustration.
      const gradient=c.createLinearGradient(x,y+h,x,y);gradient.addColorStop(0,'#fce0a0');gradient.addColorStop(.38,'#ffad32');gradient.addColorStop(1,'rgba(213,74,8,.15)');
      c.beginPath();c.moveTo(x,y+h);for(let i=0;i<6;i++){const px=x+w*i/5,py=y+h*(.18+.45*((i*3+p*2)%7)/6);c.quadraticCurveTo(px-w/12,py-h/4,px,py);}c.lineTo(x+w,y+h);c.closePath();c.fillStyle=gradient;c.fill();
    }else if(op.type==='weld'){
      const cx=x+w*.55,cy=y+h*.55,g=c.createRadialGradient(cx,cy,0,cx,cy,w*.45);g.addColorStop(0,'rgba(235,254,255,.95)');g.addColorStop(.22,'rgba(92,205,255,.8)');g.addColorStop(1,'rgba(40,135,238,0)');ellipse(c,cx,cy,w*.45,h*.45,g);
      c.strokeStyle='#d4f6ff';c.lineWidth=.25;for(let i=0;i<5;i++){const a=(i+p*.4)*2.39;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a)*w*.4,cy+Math.sin(a)*h*.4);c.stroke();}
    }else if(op.type==='indicator'){
      const on=p%2===1,g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,on?'#fff0b4':'#16353b');g.addColorStop(1,on?'#d8a62e':'#31758a');c.fillStyle=g;c.fillRect(x,y,w,h);
      c.fillStyle=on?'#fff8dc':'#7dc1c7';c.fillRect(x+.25,y+.1,Math.max(.2,w-.5),Math.min(.3,h*.25));
    }else if(op.type==='flow'){
      for(let i=0;i<4;i++){const u=((i+p)%4)/3;ellipse(c,x+w*u,y+h*(1-u),.55,.3,'#e9dfb7');}
    }else if(op.type==='mechanism'){
      c.strokeStyle='#3c3b33';c.lineWidth=.5;c.beginPath();c.moveTo(x+w*.5,y);c.lineTo(x+w*.5,y+h*(p%2?.9:.55));c.stroke();ellipse(c,x+w*.5,y+h*.5,.65,.85,'#ac9569');
    }else if(op.type==='intake'){
      const levels=[0,0,.2,.58,1,1],level=levels[Math.min(p,5)];
      for(const polygon of [[[53,74],[56,58],[64,43],[75,29],[88,20],[96,21],[101,32],[105,50],[106,73]],[[139,60],[140,51],[145,42],[150,36],[154,32],[161,32],[164,41],[166,59]]]){
        c.save();c.beginPath();polygon.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.clip();
        const y0=Math.min(...polygon.map(v=>v[1])),y1=Math.max(...polygon.map(v=>v[1]));
        c.globalCompositeOperation='screen';const g=c.createLinearGradient(50,0,166,0);g.addColorStop(0,'rgba(5,57,105,.7)');g.addColorStop(.5,'rgba(12,87,144,.65)');g.addColorStop(1,'rgba(6,43,91,.7)');c.fillStyle=g;c.fillRect(50,y1-(y1-y0)*level,116,(y1-y0)*level);c.restore();
      }
    }
    c.restore();
  }
  function composeMotion(row,nativeFrame){
    const plan=mediaMotionPlan(row,nativeFrame),missing=[];
    if(row.renderMode==='painted-frame-sequence'){
      const entry=plan.bakedFrame;
      if(nativeFrame>0&&!art(wc,entry,(entry.nativeRect??[0,0,184,112]).map(n=>n*SCALE)))missing.push(row.resource+':'+nativeFrame);
      return{status:row.frameCount===1?'painted-static':'painted-baked-native-phase',missing,operations:nativeFrame>0?1:0,visualPhase:plan.visualPhase};
    }
    wc.save();wc.scale(SCALE,SCALE);
    for(const op of plan.operations){
      if(op.type==='asset'){
        const entry=manifest.parts?.[op.id];if(!entry){missing.push(op.id);continue;}
        if(op.clean){const clean=manifest.cleanplates?.[op.clean];if(!clean){missing.push('cleanplate:'+op.clean);continue;}wc.drawImage(cleanImages.get(op.clean),...clean.nativeRect);}
        wc.save();if(op.clip){wc.beginPath();wc.rect(...op.clip);wc.clip();}art(wc,entry,op.target);wc.restore();
      }else newEffect(wc,op,bases.get(row.resource));
    }
    wc.restore();
    return{status:!plan.supported?'uncovered-motion':missing.length?'semantic-motion-in-progress':row.frameCount===1?'painted-static':'painted-semantic-native-phase',missing:[...new Set(missing)],operations:plan.operations.length,visualPhase:plan.visualPhase};
  }
  let draws=0,unknown=0,ambiguous=0,last=null;
  function draw(ctx,frame,{scene='native',occluders=null}={}){
    const kind=mediaSceneKind(scene,frame);if(!kind)return{drawn:false,status:'outside-media-scene',nativeRect:manifest.nativeRect};
    const match=identifyMediaFrame(frame,witnesses,{occluders});
    if(match.status!=='matched'){if(match.status==='ambiguous')ambiguous++;else unknown++;last={...match,drawn:false,nativeRect:manifest.nativeRect};return last;}
    let name=match.resource,nativeFrame=match.frame;
    if(kind==='factory'){
      const first=match.equivalentFrames.find(row=>row.frame===0);
      if(!first)return{drawn:false,status:'factory-native-frame-not-zero',resource:name,frame:nativeFrame,nativeRect:manifest.nativeRect};
      name=first.resource;nativeFrame=0;
    }
    const row=manifest.resources[name],base=bases.get(name);if(!row||!base)return{drawn:false,status:'uncovered-native-resource',resource:name,frame:nativeFrame,nativeRect:manifest.nativeRect};
    wc.clearRect(0,0,736,448);wc.drawImage(base,0,0);
    const phase=nativeMediaPhase(row,nativeFrame),motion=composeMotion(row,nativeFrame),motionStatus=motion.status;
    const nativeRect=row.nativeRect??manifest.nativeRect??[128,48,184,112];
    ctx.save();ctx.beginPath();ctx.rect(...nativeRect.map(n=>n*SCALE));ctx.clip();ctx.imageSmoothingEnabled=true;ctx.drawImage(working,nativeRect[0]*SCALE,nativeRect[1]*SCALE,nativeRect[2]*SCALE,nativeRect[3]*SCALE);ctx.restore();
    draws++;last={drawn:true,nativeRect,resource:name,frame:nativeFrame,status:'painted-preview',motionStatus,missingMotionAssets:motion.missing,motionOperations:motion.operations,visualPhase:phase.visual,samples:match.samples};return last;
  }
  return{draw,manifest,diagnostics:()=>({ready:true,resources:bases.size,atlases:atlases.size,witnessCoordinates:witnesses.coordinates.length,nativeFrames:witnesses.frames.length,semanticMotionResources:Object.values(manifest.resources).filter(r=>r.frameCount>1&&r.renderMode!=='painted-frame-sequence').length,bakedMotionResources:Object.values(manifest.resources).filter(r=>r.renderMode==='painted-frame-sequence'&&r.frameCount>1).length,motionFrameCoverage:Object.values(manifest.resources).reduce((n,r)=>n+r.frameCount,0),originalRGBShading:false,independentAnimationClock:false,draws,unknown,ambiguous,last})};
}
