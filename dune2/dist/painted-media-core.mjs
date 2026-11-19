// Exact native indexed-frame recognition. This module never generates artwork
// from source RGB and never advances an animation clock.
export function compileMediaWitnesses(bank){
  if(!bank?.coordinates?.length||!Array.isArray(bank.frames))throw Error('Missing native media witnesses');
  return{...bank,frames:bank.frames.map(row=>({...row,signature:Uint8Array.from(atob(row.signatureBase64),c=>c.charCodeAt(0))}))};
}
export function observedMediaOcclusion(frame,external=null){
  const mask=new Uint8Array(64000);
  const mark=(x,y)=>{x=Math.floor(x);y=Math.floor(y);if(x>=0&&x<320&&y>=0&&y<200)mask[y*320+x]=1;};
  const add=row=>{
    if(!row)return;
    if(typeof row==='function'){for(let y=48;y<160;y++)for(let x=128;x<312;x++)if(row(x,y))mark(x,y);return;}
    if(ArrayBuffer.isView(row)&&row.length===64000){for(let i=0;i<64000;i++)if(row[i])mask[i]=1;return;}
    if(Array.isArray(row)){for(const item of row)add(item);return;}
    if(row.visible===false||row.screen!==undefined&&row.screen!==0)return;
    if(row.ink)for(const p of row.ink)mark((row.x??0)+p[0],(row.y??0)+p[1]);
    if(row.mask&&row.width&&row.height){const x=row.x??0,y=row.y??0;for(let yy=0;yy<row.height;yy++)for(let xx=0;xx<row.width;xx++)if(row.mask[yy*row.width+xx])mark(x+xx,y+yy);}
  };
  add(frame.textGlyphs);add(frame.borders);add(frame.uiCommands);add(external);
  return mask;
}
export function identifyMediaFrame(frame,bank,{occluders=null,resource=null,minSamples=8}={}){
  if(!frame?.pixels||frame.pixels.length!==64000)return{status:'unknown',reason:'missing-native-pixels'};
  const mask=observedMediaOcclusion(frame,occluders),rect=bank.nativeRect??[128,48,184,112],samples=[];
  for(let i=0;i<bank.coordinates.length;i++){const [x,y]=bank.coordinates[i],at=(rect[1]+y)*320+rect[0]+x;if(!mask[at])samples.push([i,frame.pixels[at]]);}
  if(samples.length<minSamples)return{status:'unknown',reason:'occluded',samples:samples.length};
  const candidates=bank.frames.filter(row=>(!resource||row.resource===resource)&&samples.every(([i,v])=>row.signature[i]===v));
  if(!candidates.length)return{status:'unknown',reason:'no-exact-native-match',samples:samples.length};
  const hashes=new Set(candidates.map(row=>row.pixelSha256));
  if(hashes.size!==1)return{status:'ambiguous',reason:'occluded-phase-alias',samples:samples.length,candidates};
  const sorted=[...candidates].sort((a,b)=>a.resource.localeCompare(b.resource)||a.frame-b.frame);
  return{status:'matched',samples:samples.length,resource:sorted[0].resource,frame:sorted[0].frame,pixelSha256:sorted[0].pixelSha256,equivalentFrames:sorted.map(({resource,frame})=>({resource,frame}))};
}
export function mediaSceneKind(scene,frame){
  if(frame?.worldVisible)return null;
  const name=String(scene?.kind??scene??'native').toLowerCase();
  if(/factory|choam|production|starport/.test(name))return'factory';
  if(/advisor|mentat|native/.test(name))return'mentat';
  return null;
}
export function nativeMediaPhase(resource,frame){
  if(!Number.isInteger(frame)||frame<0||frame>=resource.frameCount)throw Error('Native media frame outside source range');
  return{frame,visual:resource.visualPhaseSequence?.[frame]??(resource.renderMode==='painted-frame-sequence'?frame:0),
    parts:(resource.semanticParts??[]).map(part=>({...part,phase:part.nativeVisualPhaseSequence?.[frame]??0})),
    native:resource.nativeFrames?.find(row=>row.frame===frame)??null};
}

// These anchors bind semantic moving objects to the approved new paintings.
// Original WSA phases identify timing; original RGB never shades the new art.
const animatedNames=new Set(['BARRAC.WSA','CARRYALL.WSA','GOLD-BB.WSA','HARVEST.WSA','HEADQRTS.WSA','HITCFTRY.WSA','HVYFTRY.WSA','LITEFTRY.WSA','PALACE.WSA','REFINERY.WSA','STARPORT.WSA','STORAGE.WSA','WINDTRAP.WSA','WOR.WSA']);
export function mediaMotionPlan(row,nativeFrame){
  const phase=nativeMediaPhase(row,nativeFrame),resource=row.resource;
  if(row.renderMode==='painted-frame-sequence')return{supported:!!row.frames?.[nativeFrame],visualPhase:phase.visual,operations:[],bakedFrame:row.frames?.[nativeFrame]??null};
  if(row.frameCount===1)return{supported:true,visualPhase:0,operations:[]};
  if(!animatedNames.has(resource))return{supported:false,visualPhase:phase.visual,operations:[]};
  const operations=[];
  if(resource==='WOR.WSA'){
    // The painted fortress base intentionally contains no patrol figures. Add
    // complete newly painted figures in every observed phase, including zero.
    const p=phase.parts[0]?.phase??0;
    for(const [i,x]of [14,22,30,43,63,82,113,125].entries()){
      const offset=[0,.5,1,1,.5,0,-.5,-.5][(p+i)%8];
      operations.push({type:'asset',id:'guard-'+((p+i)%3),target:[x+offset-1,74.5,2,3.5],semantic:'front-patrol'});
    }
    return{supported:true,visualPhase:phase.visual,operations};
  }
  for(const part of phase.parts){
    const p=part.phase;if(!p)continue;
    const common={semantic:part.id,phase:p,phases:part.nativeDistinctPoses??1};
    switch(resource){
      case 'HEADQRTS.WSA':operations.push({...common,type:'asset',id:'radar-'+p,clean:'radar',target:[149,42,24,17]});break;
      case 'CARRYALL.WSA':operations.push({...common,type:'asset',id:'marshal-'+p,clean:'marshal',target:[153,83,12,18]});break;
      case 'BARRAC.WSA':operations.push({...common,type:'fan',target:[133,68,14,8]});break;
      case 'GOLD-BB.WSA':operations.push({...common,type:'steam',target:[101,60,22,10]});break;
      case 'HARVEST.WSA':operations.push({...common,type:'dust',target:part.id==='left-contact'?[62,87,27,10]:[137,87,19,10]});break;
      case 'HITCFTRY.WSA':operations.push({...common,type:'indicator',target:[103,66,3,1]});break;
      case 'HVYFTRY.WSA':operations.push({...common,type:'flame',target:part.id==='left-bay-glow'?[22,69,20,8]:[164,73,19,10]});break;
      case 'LITEFTRY.WSA':operations.push({...common,type:part.id==='pulley-detail'?'mechanism':'weld',target:part.id==='right-workstation'?[137,58,14,12]:part.bounds});break;
      case 'PALACE.WSA':
        if(part.id==='left-indicators')operations.push({...common,type:'indicator',target:[12,96,3,1]});
        else{
          const map={'gate-person':{target:[91,82,4,10],clean:'palace-gate'},'middle-person':{target:[142,86,3.5,7],clean:'palace-middle'},'right-person':{target:[169.5,91,6,13],clean:'palace-foreground'}};
          operations.push({...common,...map[part.id],type:'asset',id:'guard-'+p});
        }break;
      case 'REFINERY.WSA':operations.push({...common,type:'indicator',target:part.bounds});break;
      case 'STORAGE.WSA':operations.push({...common,type:part.id==='diagonal-flow'?'flow':'indicator',target:part.bounds});break;
      case 'WINDTRAP.WSA':operations.push({...common,type:part.id==='intakes'?'intake':'engine-highlight',target:part.id==='intakes'?part.bounds:[1,54,12,6]});break;
      case 'STARPORT.WSA':{
        const x=nativeFrame<22?phase.native?.changedBounds?.[0]:[16,3,-10][nativeFrame-22];
        if(x!==undefined)operations.push({...common,type:'asset',id:'transport',target:[x,94,32,5],clip:phase.native?.changedBounds?[phase.native.changedBounds[0],94,phase.native.changedBounds[2],5]:null});
        break;
      }
    }
  }
  return{supported:true,visualPhase:phase.visual,operations};
}
