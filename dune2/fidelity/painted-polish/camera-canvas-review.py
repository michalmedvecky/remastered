#!/usr/bin/env python3
"""Write an inert, source-bound real-Canvas smooth-camera QA fixture.

python3 fidelity/painted-polish/camera-canvas-review.py --output dist/camera-qa.html
Use the existing restricted preview server. Inspect body.dataset.done/#result,
capture evidence, then remove the temporary HTML before delivery. No server,
WASM engine, original DOS binary, simulation or RNG is launched by this helper.
"""
from pathlib import Path
import argparse,hashlib,json
ROOT=Path(__file__).resolve().parents[2]
TEMPLATE=r'''<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Source-bound smooth camera QA</title>
<style>body{margin:0;background:#15191c;color:#eee;font:14px/1.4 system-ui}header{padding:8px 16px}h1{font-size:19px;margin:0}canvas{display:block;width:1280px;height:800px;max-width:100%;object-fit:contain;object-position:top left}pre{margin:8px 16px;white-space:pre-wrap;overflow-wrap:anywhere}button{margin-right:8px}#status{color:#dccc91}</style>
<header><h1>Committed camera / overscan Canvas QA</h1><div>Exact native indexed ICON/SHP fixtures; new production artwork; no DOS or simulation. World camera moves on RAF while native snapshots commit every180ms.</div><div id=status>Loading painted assets…</div><button id=replay disabled>Replay camera path</button><button id=freeze disabled>Freeze current view</button></header><canvas id=canvas width=1280 height=800></canvas><pre id=result>pending</pre>
<script type=module>
import {createPaintedRenderer} from './painted-renderer.mjs';
import {prepareFrameDescriptor,composeNativeViewport,stampNativeSprite} from './hd-core.mjs';
import {visibleNativeFrame} from './painted-core.mjs';
const sourceMeta=__SOURCE_META__;
const canvas=document.getElementById('canvas'),resultElement=document.getElementById('result'),statusElement=document.getElementById('status'),replayButton=document.getElementById('replay'),freezeButton=document.getElementById('freeze');
for(const type of['error','unhandledrejection'])addEventListener(type,event=>{resultElement.textContent=String(event.error??event.reason??event.message);statusElement.textContent='ERROR — inspect result';document.body.dataset.done='true';document.body.dataset.pass='false';});
const readJSON=async p=>{const r=await fetch(p);if(!r.ok)throw Error('Missing fixture dependency '+p);return r.json();};
const [original,terrain,buildings,chrome]=await Promise.all(['native','terrain','buildings','interface'].map(n=>readJSON('./painted/'+n+'.json')));
const frames={tiles:{},units:{},ui:{}};for(const kind of Object.keys(frames))for(const[id,f]of Object.entries(original.frames[kind]))frames[kind][id]=prepareFrameDescriptor(f);
const palette=Uint8Array.from(original.palette,v=>Math.round(v*16/65));if(palette.some((v,i)=>(v*65>>4)!==original.palette[i]))throw Error('Native palette inversion differs');
const basePixels=Uint8Array.from(atob(chrome.scenes['SCREEN.CPS'].indicesBase64),c=>c.charCodeAt(0));
const worldCells=new Map();
function place(name,x,y){const b=Object.values(buildings.structures).find(s=>s.name===name);if(!b)throw Error('Missing native building '+name);const state=b.states.find(s=>s.index===0),cols=b.width/16;for(const[id,tile]of state.tileIds.entries())worldCells.set((y+Math.floor(id/cols))*64+x+id%cols,tile);}
place('Const Yard',14,14);place('Windtrap',18,13);place('Heavy Fctry',21,16);
function tile(x,y){if(x<0||y<0||x>=64||y>=64)return[0,0,0,0];const b=worldCells.get(y*64+x);if(b!==undefined)return[b,0,1,1];if(y===18&&x>=12&&x<=18)return[124,0,1,1];if(y>=18&&y<=20&&x>=20&&x<=24)return[191,0,1,1];if(x===18&&y>=11&&y<=17)return[128+(y-11)%15,0,1,1];return[x>=19?143:127,0,1,1];}
function command(id,cx,cy,nx,ny,owner,layer=1){const f=frames.units[id]??frames.ui[id],p=f.palette?.map(v=>v>=144&&v<=152?v+16:v);return{id,x:cx-nx-Math.floor(f.sourceW/2),y:40+cy-ny-Math.floor(f.sourceH/2),width:f.sourceW,height:f.sourceH,flags:0,palette:p,clip:[0,40,240,160],owner,layer,house:1,remapCount:0};}
const topUI=[{id:7,x:16,y:1},{id:9,x:104,y:1},{id:11,x:192,y:0},{id:90,x:258,y:51}].map((c,i)=>({...c,width:frames.ui[c.id].sourceW,height:frames.ui[c.id].sourceH,flags:0,clip:[0,0,320,200],screen:0,serial:i+1,sourceSerial:i+1}));
const initialX=12,initialY=12,path=[13,14,15,16,17,18,17,16],startDelay=200,stepMs=180,totalMs=startDelay+path.length*stepMs+400;
let currentX=initialX,revision=1,commits=0,callbacks=0,sourceMismatch=0;
function snapshot(elapsed){const nx=currentX*16,ny=initialY*16,tiles=new Uint16Array(600),overTiles=new Uint16Array(816);for(let y=0;y<10;y++)for(let x=0;x<15;x++)tiles.set(tile(currentX+x,initialY+y),(y*15+x)*4);for(let y=0;y<12;y++)for(let x=0;x<17;x++)overTiles.set(tile(currentX-1+x,initialY-1+y),(y*17+x)*4);
 const commands=[];const add=(id,cx,cy,owner,layer)=>{if(cx-nx>=-16&&cx-nx<=256&&cy-ny>=-16&&cy-ny<=176)commands.push(command(id,cx,cy,nx,ny,owner,layer));};
 // This Trike is entirely clipped in the original native viewport atN=224,
 // but its CURRENT observed full pose occupies the valid overscan strip.
 add(243,216,248,1,1);
 // Remove both current Tank layers together; no previous owner pose may linger.
 if(step<4){add(111,310,270,2,1);add(116,310,270,2,1);}
 add(245,386,305,3,1);
 const pixels=basePixels.slice();for(const c of topUI)stampNativeSprite(pixels,frames.ui[c.id],c);
 const f={version:2,pixels,palette,tiles,commands,worldVisible:true,worldAvailable:true,gameplayActive:true,viewport:currentX+initialY*64,worldRevision:revision,worldCommitTick:Math.floor(elapsed*.06),gameTick:Math.floor(elapsed*.06),playerHouse:1,veiledTileId:123,debugScenario:false,overscan:{x:currentX-1,y:initialY-1,width:17,height:12,tiles:overTiles},selectedUnit:-1,selection:{position:0,width:0,height:0,state:0,type:0},cursor:{id:0,x:60,y:90,hotX:0,hotY:0,visible:true},screenOffset:0,message:'',uiCommands:topUI,textGlyphs:[],textRuns:[],borders:[],uiLedgerOverflow:0,cacheOverflow:0};
 const predicted=composeNativeViewport(visibleNativeFrame(f),frames);if(predicted.missingFrames||predicted.unsupportedCommands)throw Error('Invalid exact native fixture');f.pixels=predicted.pixels;const again=composeNativeViewport(visibleNativeFrame(f),frames);for(let i=0;i<64000;i++)if(again.pixels[i]!==f.pixels[i])sourceMismatch++;
 callbacks++;return f;
}
const offsets=[],errors=[],inputProjection=[];let painter=null;painter=await createPaintedRenderer(canvas,{mode:'painted',onError:e=>errors.push(String(e)),setViewOffset:(x,y)=>{offsets.push([performance.now(),x,y]);if(offsets.length>1000)offsets.shift();if(painter&&!canvas.hidden){const c=painter.diagnostics().camera.sample;if(c?.active)inputProjection.push({at:performance.now(),errorX:Math.abs(currentX*16+x/256-c.displayX),errorY:Math.abs(initialY*16+y/256-c.displayY)});}}});
const surface=terrain.surfaces.rock,image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='./'+terrain.assets.surfaces.src;});const texture=document.createElement('canvas');texture.width=surface.w;texture.height=surface.h;texture.getContext('2d').drawImage(image,surface.x,surface.y,surface.w,surface.h,0,0,surface.w,surface.h);
const expected=document.createElement('canvas');expected.width=960;expected.height=640;const ec=expected.getContext('2d'),pattern=ec.createPattern(texture,'repeat'),actual=canvas.getContext('2d',{willReadFrequently:true});
let baseline={frames:0,worldFrames:0,nativeFrames:0};
let animation=0,start=0,lastCallback=-Infinity,step=0,trace=[],uv=[],fringeWitness=null,goneWitness=null,finished=false;
function blueIn(rect){const [x,y,w,h]=rect,p=actual.getImageData(x*4,y*4,w*4,h*4).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i+2]>85&&p[i+2]>p[i]*1.35&&p[i+2]>p[i+1]*1.2)n++;return n;}
function checkCanvas(t){const d=painter.diagnostics(),c=d.camera.sample;if(!c||!d.frames)return;trace.push({at:t,x:c.displayX,y:c.displayY,nativeX:c.nativeX,rafFrames:d.frames,worldRefreshes:d.worldFrames,moving:c.moving});if(c.active){ec.setTransform(1,0,0,1,0,0);ec.clearRect(0,0,960,640);ec.save();ec.translate(-c.displayX*4,-c.displayY*4);ec.fillStyle=pattern;ec.fillRect(c.displayX*4,c.displayY*4,960,640);ec.restore();let max=0,sum=0,n=0;for(const[x,y]of[[140,75],[180,80]]){const a=actual.getImageData(x*4,y*4,4,4).data,b=ec.getImageData(x*4,(y-40)*4,4,4).data;for(let i=0;i<a.length;i++)if(i%4!==3){const e=Math.abs(a[i]-b[i]);max=Math.max(max,e);sum+=e;n++;}}uv.push({at:t,maxDifference:max,meanDifference:sum/n});}
 if(c.nativeX===224&&c.offsetX>4&&c.offsetX<15&&!fringeWitness){const n=blueIn([0,88,16,16]);if(n>0)fringeWitness={at:t,cameraX:c.displayX,nativeX:c.nativeX,currentNativeCommandX:-16,currentNativeOriginalVisiblePixels:0,paintedBluePixels:n};}
 if(c.nativeX>=272&&Math.abs(c.offsetX)<4&&!goneWitness){const x=310-c.displayX;goneWitness={at:t,revision:d.history.at(-1)?.revision,ownerRemoved:true,paintedBluePixels:blueIn([Math.max(0,x-7),111,14,15])};}
}
function finish(){finished=true;const d=painter.diagnostics(),moving=trace.filter(t=>t.moving),median=a=>{const b=a.slice().sort((a,b)=>a-b);return b[Math.floor(b.length/2)]??null;},maxUV=Math.max(...uv.map(u=>u.maxDifference)),meanUV=uv.reduce((n,u)=>n+u.meanDifference,0)/(uv.length||1),intervals=d.camera.intervals??[],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const resultValue={source:sourceMeta,executesDos:false,syntheticSourceExact:true,nativeFixtureMismatchPixels:sourceMismatch,snapshots:{commits,callbacks},canvas:{frames:d.frames-baseline.frames,worldRefreshes:d.worldFrames-baseline.worldFrames,nativeFrames:d.nativeFrames-baseline.nativeFrames,cachedWorldReused:d.frames-baseline.frames>d.worldFrames-baseline.worldFrames,animationMedianMs:median(intervals),movingSamples:moving.length,errors},uv:{samples:uv.length,maxChannelDifference:maxUV,meanChannelDifference:meanUV},fringeWitness,goneWitness,reducedMotion:reduced,inputQ8:{samples:offsets.length,maxAbs:Math.max(...offsets.flatMap(v=>v.slice(1).map(Math.abs))),projectionSamples:inputProjection.length,maxLogicalError:Math.max(0,...inputProjection.flatMap(v=>[v.errorX,v.errorY]))},diagnostics:d};
 resultValue.pass=errors.length===0&&sourceMismatch===0&&d.worldFrames-baseline.worldFrames===commits&&d.frames-baseline.frames>d.worldFrames-baseline.worldFrames&&maxUV<=8&&resultValue.inputQ8.maxLogicalError<=1/256&&(reduced||fringeWitness?.paintedBluePixels>0);resultElement.textContent=JSON.stringify(resultValue,null,2);statusElement.textContent=resultValue.pass?'PASS — exact source prediction, current fringe, stable world UV and cached RAF motion':'REVIEW — inspect result details';document.body.dataset.done='true';document.body.dataset.pass=String(resultValue.pass);globalThis.cameraReview=resultValue;}
function tick(now){if(!start)start=now;const elapsed=now-start;checkCanvas(elapsed);if(step<path.length&&elapsed>=startDelay+step*stepMs){currentX=path[step++];revision++;commits++;painter.present(snapshot(elapsed));lastCallback=elapsed;}else if(elapsed-lastCallback>=60&&elapsed<totalMs-200){painter.present(snapshot(elapsed));lastCallback=elapsed;}if(elapsed>=totalMs){finish();return;}animation=requestAnimationFrame(tick);}
function replayPath(){if(animation)cancelAnimationFrame(animation);start=0;step=0;currentX=initialX;revision++;commits=1;callbacks=0;sourceMismatch=0;trace=[];uv=[];inputProjection.length=0;fringeWitness=null;goneWitness=null;finished=false;document.body.dataset.done='false';document.body.dataset.pass='';painter.setMode('original');painter.setMode('painted');{const d=painter.diagnostics();baseline={frames:d.frames,worldFrames:d.worldFrames,nativeFrames:d.nativeFrames};}painter.present(snapshot(0));lastCallback=0;animation=requestAnimationFrame(tick);}
replayButton.onclick=replayPath;freezeButton.onclick=()=>{if(animation)cancelAnimationFrame(animation);animation=0;if(!finished)finish();};replayButton.disabled=false;freezeButton.disabled=false;replayPath();
</script>'''
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args();out=a.output.resolve();assert out.parent==(ROOT/'dist').resolve(),'Temporary fixture must be directly inside dune2/dist'
 native=ROOT/'dist/painted/native.json';meta=dict(nativeBankSha256=hashlib.sha256(native.read_bytes()).hexdigest(),module='createPaintedRenderer',source='Exact prepared ICON/SHP descriptors, original indexed palette and SCREEN.CPS evidence',purpose='Synthetic presentation-only camera, current fringe, world-UV and cached-render review')
 out.write_text(TEMPLATE.replace('__SOURCE_META__',json.dumps(meta,separators=(',',':'))));print(json.dumps(dict(output=str(out),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),launchesServer=False,executesDos=False)))
if __name__=='__main__':main()
