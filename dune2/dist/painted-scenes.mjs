// Source-indexed scene recognition. No guessed house or partial-face fallback.
// GPL-2.0-only.
import {campaignScene} from './painted-ui-core.mjs';

const WIDTH=320,HEIGHT=200,PIXELS=WIDTH*HEIGHT;
const ADVISORS=['MENTATH.CPS','MENTATA.CPS','MENTATO.CPS','MENTATM.CPS'];
const OVERLAY_ONLY=new Set(['MISC.ENG','MISC.CPS']);
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const inside=(x,y,r)=>x>=r[0]&&y>=r[1]&&x<r[0]+r[2]&&y<r[1]+r[3];

/** Use the SAME static domain for all four advisors. The original right-strip
 * witnesses were overwritten by three-line speech and Proceed/Repeat/Yes/No.
 * Their replacement must identify the whole CPS, independently of its patches.
 */
export function compileSceneRecognition(chrome,{sourceFrames=null,indexedScenes=null,maxAdvisorPoints=384}={}){
  const scenes=chrome.scenes??{},indices=new Map();
  for(const[name,row]of Object.entries(scenes)){
    const raw=indexedScenes?.get?.(name)??(row.indicesBase64?decode(row.indicesBase64):null);
    if(raw){if(raw.length!==PIXELS)throw Error('Invalid source scene geometry: '+name);indices.set(name,raw);}
  }
  // Native GUI_Mentat_Loop owns the complete top40; widget8 owns its whole
  // media rectangle. Bottom widget allocations use up to64x24 native pixels.
  // GUI_Security_Show fills widget9's input panel plus its6px border, replacing
  // the advisor's lower-left body too. Observer border ink is intentionally
  // rim-only, so it cannot describe that real interior clear. Exclude this
  // known native window when choosing static anchors, never arbitrary boxes.
  const exclusions=[[0,0,320,40],[128,48,184,112],[152,164,168,36],[10,170,300,23]];
  for(const row of Object.values(chrome.frames??{}))if(row.kind==='painted-whole-advisor'){
    for(const rect of Object.values(row.nativePatches??{}))if(Array.isArray(rect)&&rect.length===4)exclusions.push(rect.slice());
  }
  const advisors=ADVISORS.filter(name=>indices.has(name));
  const cells=new Map();
  for(let y=40;y<HEIGHT;y+=2)for(let x=0;x<WIDTH;x+=2){
    if(exclusions.some(r=>inside(x,y,r)))continue;
    const at=y*WIDTH+x,values=advisors.map(name=>indices.get(name)[at]);
    if(new Set(values).size<2||values.every(v=>v===0))continue;
    const key=(x>>4)+':'+(y>>4),points=cells.get(key)??[];
    points.push({x,y,at,values,diversity:new Set(values).size});cells.set(key,points);
  }
  // Round-robin among spatial cells prevents a small occluder or one shared
  // frame edge from dominating the evidence. Prefer discriminating source data.
  const buckets=[...cells.values()].map(points=>points.sort((a,b)=>b.diversity-a.diversity||a.at-b.at));
  const points=[];
  for(let round=0;points.length<maxAdvisorPoints;round++){
    let added=0;
    for(const bucket of buckets)if(bucket[round]){points.push(bucket[round]);added++;if(points.length===maxAdvisorPoints)break;}
    if(!added)break;
  }
  const ui=sourceFrames?.frames?.ui??sourceFrames?.ui??{};
  const advisorSpriteIds=new Set();
  for(const[id,row]of Object.entries(ui))if(/^MENSHP[AHOM]\.SHP$/i.test(row.resource??row.sourceResource??''))advisorSpriteIds.add(Number(id));
  // Full metadata is available at runtime. This fallback also makes the atomic
  // base rule usable by source-only scene fixtures without a second manifest.
  if(!advisorSpriteIds.size)for(const row of Object.values(chrome.frames??{}))if(row.kind==='painted-whole-advisor'){
    const house=row.nativePatches?.house;if(Number.isInteger(house))for(let i=0;i<15;i++)advisorSpriteIds.add(387+house*15+i);
  }
  const cursors=new Map();
  for(let id=0;id<=6;id++){
    const row=ui[id];if(!row)continue;
    const mask=row.mask??(row.maskBase64?decode(row.maskBase64):null);
    if(mask)cursors.set(id,{width:row.sourceW,height:row.sourceH,mask});
  }
  return{scenes,indices,advisors,advisorPoints:points,advisorExclusions:exclusions,advisorSpriteIds,cursors};
}

export function isAdvisorSprite(commandOrId,compiled){
  return compiled.advisorSpriteIds.has(typeof commandOrId==='number'?commandOrId:commandOrId?.id);
}

/** Compare only pixels that distinguish the three copied house-name strips.
 * Common panel backgrounds dominated the old sparse similarity score after
 * translation; the first candidate could win despite naming another house.
 */
export function compileConfirmationRecognition(indices,sourceRects){
  if(indices?.length!==PIXELS)return{points:[],houses:[]};
  const entries=Object.entries(sourceRects??{}),houses=entries.map(([id])=>Number(id)),points=[];
  if(entries.length!==3)return{points,houses};
  const width=Math.min(...entries.map(([,r])=>r[2])),height=Math.min(...entries.map(([,r])=>r[3]));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const values=entries.map(([,r])=>indices[(r[1]+y)*WIDTH+r[0]+x]);
    if(values.some(v=>v!==values[0]))points.push({x,y,values});
  }
  return{points,houses};
}
export function recognizeConfirmationHouse(frame,compiled){
  const pixels=frame.uiPixels??frame.pixels;
  if(pixels?.length!==PIXELS||compiled.points.length<24)return null;
  const exact=[];
  for(let i=0;i<compiled.houses.length;i++){
    if(compiled.points.every(p=>pixels[p.y*WIDTH+208+p.x]===p.values[i]))exact.push(compiled.houses[i]);
  }
  return exact.length===1?exact[0]:null;
}

function observedOcclusion(frame,compiled){
  const mask=new Uint8Array(PIXELS);
  for(const row of [...(frame.textGlyphs??[]),...(frame.uiBorders??frame.borders??[]),...(frame.uiCommands??[])]){
    if(row.screen!==undefined&&row.screen!==0||row.visibleInk===0)continue;
    for(const p of row.ink??[]){const x=row.x+p[0],y=row.y+p[1];if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT)mask[y*WIDTH+x]=1;}
  }
  // Native v2 supplies cursor-free uiPixels from the real saved underlay. The
  // older raw-pixel path excludes only the actual source cursor alpha.
  const pointer=frame.cursor,source=pointer&&compiled.cursors.get(pointer.id);
  if(!frame.uiPixels&&pointer?.visible&&source){
    const left=pointer.x-pointer.hotX,top=pointer.y-pointer.hotY;
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(source.mask[y*source.width+x]){
      const xx=left+x,yy=top+y;if(xx>=0&&xx<WIDTH&&yy>=0&&yy<HEIGHT)mask[yy*WIDTH+xx]=1;
    }
  }
  return mask;
}

export function recognizePaintedScene(frame,compiled,{minAdvisorSamples=64,minAdvisorNonzero=24}={}){
  if(frame.worldVisible)return{scene:'hud',method:'committed-world',score:1,samples:0};
  const pixels=frame.uiPixels??frame.pixels;
  if(pixels?.length!==PIXELS)return{scene:'native',method:'none',reason:'missing-native-pixels',samples:0,score:0};
  const campaign=campaignScene(frame,compiled.scenes);
  if(campaign)return{scene:campaign,method:'campaign-composition',score:1,samples:0};
  const occluded=observedOcclusion(frame,compiled),candidates=[];
  for(let i=0;i<compiled.advisors.length;i++){
    let samples=0,matches=0,nonzero=0;
    for(const point of compiled.advisorPoints){
      if(occluded[point.at])continue;
      samples++;if(pixels[point.at]===point.values[i]){matches++;if(point.values[i])nonzero++;}
    }
    candidates.push({scene:compiled.advisors[i],samples,matches,nonzero,score:samples?matches/samples:0});
  }
  const exact=candidates.filter(c=>c.samples>=minAdvisorSamples&&c.nonzero>=minAdvisorNonzero&&c.matches===c.samples);
  if(exact.length===1)return{...exact[0],method:'exact-static-advisor',candidates};
  if(exact.length>1)return{scene:'native',method:'none',reason:'ambiguous-advisor-source',samples:exact[0].samples,score:1,candidates};
  let best=null,tied=false;
  for(const[name,row]of Object.entries(compiled.scenes)){
    if(OVERLAY_ONLY.has(name)||ADVISORS.includes(name))continue;
    let samples=0,matches=0;
    for(const[x,y,index]of row.witnesses??row.witness??row.points??[]){
      if(x<0||x>=WIDTH||y<0||y>=HEIGHT||occluded[y*WIDTH+x])continue;
      samples++;if(pixels[y*WIDTH+x]===index)matches++;
    }
    const score=samples>=12?matches/samples:0;
    if(score>(best?.score??0)){best={scene:row.kind??name,method:'source-witnesses',samples,matches,score};tied=false;}
    else if(score>0&&score===best?.score)tied=true;
  }
  if(best?.score>=.72&&!tied)return{...best,candidates};
  return{scene:'native',method:'none',reason:tied?'ambiguous-source':'unrecognized-source',samples:best?.samples??0,score:best?.score??0,candidates};
}
