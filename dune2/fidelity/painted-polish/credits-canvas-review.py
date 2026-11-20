#!/usr/bin/env python3
"""Generate an independent whole-UI rolling-credit Canvas review.

  python3 fidelity/painted-polish/credits-canvas-review.py --output dist/credits-qa.html

Run the generated page through the existing restricted preview. It reconstructs
native indexed SHP writes and their surviving ownership, then invokes the whole
createPaintedUI pipeline. It never imports the credit-layout helper to decide its
expected safe bounds or slot identity. No game, emulator, server or DOS binary runs.
"""
from pathlib import Path
import argparse, hashlib, json

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = r'''<!doctype html><meta charset=utf-8><title>Rolling credits whole UI QA</title>
<style>body{margin:0;background:#101820;color:#eee;font:14px sans-serif}h1,p{margin:12px}#gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0}canvas{display:block;width:100%;height:auto}figcaption{padding:4px}#result{display:none}</style>
<h1>Rolling credits: whole UI integration</h1><p id=status>Loading native SHP evidence and complete production UI…</p><div id=gallery></div><pre id=result>pending</pre>
<script type=module>
import {createPaintedUI} from './painted-ui.mjs';
import {prepareFrameDescriptor,stampNativeSprite,mappedIndex,toRgba} from './hd-core.mjs';
const sourceHashes=__HASHES__,statusElement=document.getElementById('status'),galleryElement=document.getElementById('gallery'),resultElement=document.getElementById('result');
const surface=(w=1280,h=800)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const json=async name=>{const response=await fetch('./painted/'+name+'.json');if(!response.ok)throw Error('Missing '+name);return response.json();};
const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='./'+src;});
const safe=[258,4,48,9],panel=[255,1,55,15],nativeClip=[256,4,64,9],all=[0,0,320,200];
const inRect=(x,y,r)=>x>=r[0]*4&&y>=r[1]*4&&x<(r[0]+r[2])*4&&y<(r[1]+r[3])*4;
const numberText=value=>String(value).padStart(6,' ');
let serial=0;
function makeFrame(native,chrome,sourceFrames,scene,spec,{label=true,counter=true}={}){
 const background=chrome.scenes[scene==='hud'?'SCREEN.CPS':'CHOAM.CPS'],pixels=bytes(background.indicesBase64),palette=Uint8Array.from(native.palette),owners=new Int32Array(64000).fill(-1),commands=[];
 function stamp(id,x,y,clip){
  const source=sourceFrames.ui[id],command={id,x,y,width:source.sourceW,height:source.sourceH,screen:0,flags:0,nativeClip:clip.slice(),clip:clip.slice(),serial:++serial,sourceSerial:serial,ink:[],totalInk:0},record=commands.length;
  commands.push(command);stampNativeSprite(pixels,source,command);
  for(let yy=0;yy<source.sourceH;yy++)for(let xx=0;xx<source.sourceW;xx++){
   const sx=x+xx,sy=y+yy,at=yy*source.sourceW+xx;
   if(!source.mask[at]||sx<0||sx>=320||sy<0||sy>=200||sx<clip[0]||sx>=clip[0]+clip[2]||sy<clip[1]||sy>=clip[1]+clip[3])continue;
   pixels[sy*320+sx]=mappedIndex(source,source.indices[at],command);owners[sy*320+sx]=record;command.totalInk++;
  }
 }
 if(label)stamp(11,192,0,all);
 if(counter){
  // Actual GUI_DrawCredits SCREEN1 widget4 copied forty rows upward to widget5.
  stamp(12,256,4,nativeClip);
  if(spec.kind!=='background-only'){
   const old=numberText(spec.old??spec.value),next=numberText(spec.next??spec.value),offset=spec.offset??0;
   for(let column=0;column<6;column++){
    const x=260+10*column,clip=spec.partial&&column===5?[313,4,3,9]:nativeClip;
    const id=old[column]===' '?13:14+Number(old[column]);
    if(old[column]!==next[column]){
     // Literal native offset formulas; this independent fixture does not ask
     // the production credit helper where either rolling glyph should be.
     const nativeOffset=offset<0?-7:1;
     stamp(id,x,4+nativeOffset-offset,clip);
     if(offset!==0){const newID=next[column]===' '?13:14+Number(next[column]);stamp(newID,x,4+nativeOffset+8-offset,clip);}
    }else stamp(id,x,5,clip);
   }
  }
 }
 for(let at=0;at<64000;at++)if(owners[at]>=0){const command=commands[owners[at]],x=at%320,y=Math.floor(at/320);command.ink.push([x-command.x,y-command.y,pixels[at]]);}
 const uiCommands=[];
 for(const command of commands){
  command.visibleInk=command.ink.length;if(!command.visibleInk)continue;
  const xs=command.ink.map(p=>p[0]),ys=command.ink.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys);
  command.clip=[command.x+x0,command.y+y0,Math.max(...xs)-x0+1,Math.max(...ys)-y0+1];uiCommands.push(command);
 }
 return{pixels,uiPixels:pixels.slice(),palette,worldVisible:scene==='hud',worldAvailable:scene==='hud',playerHouse:1,uiCommands,textRuns:[],textGlyphs:[],borders:[],cursor:{id:0,visible:false,x:0,y:0,hotX:0,hotY:0}};
}
function compare(actual,baseline,allowed=safe){
 const a=new Uint32Array(actual.buffer,actual.byteOffset,actual.byteLength/4),b=new Uint32Array(baseline.buffer,baseline.byteOffset,baseline.byteLength/4);
 let changed=0,outside=0,rightBevel=0,left=1280,top=800,right=0,bottom=0;const columns=Array(6).fill(0);
 for(let i=0;i<a.length;i++)if(a[i]!==b[i]){
  changed++;const x=i%1280,y=Math.floor(i/1280);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
  if(!inRect(x,y,allowed))outside++;
  if(x>=306*4&&y<20*4)rightBevel++;
  if(inRect(x,y,safe))columns[Math.floor((x/4-258)/8)]++;
 }
 return{changedPixels:changed,outsideAllowedPixels:outside,rightBevelPixels:rightBevel,columns,bounds:changed?[left/4,top/4,(right-left)/4,(bottom-top)/4]:null};
}
try{
 const[native,chrome]=await Promise.all([json('native'),json('interface')]),sourceFrames={tiles:{},units:{},ui:{}};
 for(const kind of Object.keys(sourceFrames))for(const[id,row]of Object.entries(native.frames[kind]))sourceFrames[kind][id]=prepareFrameDescriptor(row);
 const ui=await createPaintedUI({sourceFrames}),canvas=surface(),ctx=canvas.getContext('2d',{willReadFrequently:true}),nativeCanvas=surface(320,200),nc=nativeCanvas.getContext('2d'),data=nc.createImageData(320,200),results=[],errors=[],panelBaseline=[];
 const render=frame=>{toRgba(frame.uiPixels,frame.palette,data.data);nc.putImageData(data,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(nativeCanvas,0,0,1280,800);ui.draw(ctx,frame);return ctx.getImageData(0,0,1280,800).data;};
 for(const scene of ['hud','CHOAM.CPS']){
  const noCommands=makeFrame(native,chrome,sourceFrames,scene,{}, {counter:false,label:false}),actual=render(noCommands),frame=chrome.frames[scene==='hud'?'hud-shell':'factory-shell'],atlas=await loadImage(chrome.atlases[frame.atlas].src),reference=surface(),rc=reference.getContext('2d',{willReadFrequently:true});
  toRgba(noCommands.uiPixels,noCommands.palette,data.data);nc.putImageData(data,0,0);rc.imageSmoothingEnabled=false;rc.drawImage(nativeCanvas,0,0,1280,800);rc.drawImage(atlas,...frame.rect,0,0,1280,800);
  const want=rc.getImageData(0,0,1280,800).data,delta=compare(actual,want,scene==='hud'?[0,0,0,0]:panel);
  // Crest composition may legitimately differ at the left of a raw CHOAM
  // source atlas. Only its independent counter/header region is evaluated here.
  let outsideHeader=0;for(let y=0;y<80;y++)for(let x=255*4;x<1280;x++){const p=(y*1280+x)*4;if(actual[p]!==want[p]||actual[p+1]!==want[p+1]||actual[p+2]!==want[p+2]||actual[p+3]!==want[p+3])if(!inRect(x,y,scene==='hud'?[0,0,0,0]:panel))outsideHeader++;}
  panelBaseline.push({scene,factoryPanelAllowedOnce:scene!=='hud',outsideHeaderPanelPixels:outsideHeader});
  if(outsideHeader)errors.push(scene+': baseline counter panel changed unrelated header pixels');
  const baseline=render(makeFrame(native,chrome,sourceFrames,scene,{}, {counter:false})).slice();
  const cases=[{name:'background-only',kind:'background-only'},...Array.from([0,341,65535,999999],value=>({name:'static '+value,value,kind:'static',gallery:true}))];
  for(const[old,next]of [[9,10],[99,100],[999,1000],[9999,10000],[99999,100000]])for(let offset=-7;offset<=7;offset++)cases.push({name:'roll '+old+'-'+next+' offset'+offset,kind:'roll',old,next,offset,gallery:old===999&&offset===4});
  cases.push({name:'partial last-slot copy',kind:'static',value:999999,partial:true});
  for(const spec of cases){
   const frame=makeFrame(native,chrome,sourceFrames,scene,spec),actual=render(frame),delta=compare(actual,baseline),diagnostic=ui.diagnostics(),row={scene,name:spec.name,kind:spec.kind,offset:spec.offset??0,visibleSourceDigits:frame.uiCommands.filter(c=>c.id>=14&&c.id<=23).length,fitViolations:diagnostic.textFit.violations,...delta};
   if(diagnostic.scene!==scene)errors.push(scene+' '+spec.name+': scene '+diagnostic.scene);
   if(row.outsideAllowedPixels||row.rightBevelPixels)errors.push(scene+' '+spec.name+': digit/stroke escaped safe field');
   if(row.fitViolations)errors.push(scene+' '+spec.name+': measured type escaped its fitted field');
   if(spec.kind==='background-only'&&row.changedPixels)errors.push(scene+': sourceBG12 erased painted counter');
   if(spec.kind==='static'&&!spec.partial){
    const text=numberText(spec.value);for(let column=0;column<6;column++)if((text[column]===' '&&row.columns[column]!==0)||(text[column]!==' '&&row.columns[column]===0))errors.push(scene+' '+spec.name+': unstable slot '+column);
   }
   results.push(row);
   if(spec.gallery){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),copy=surface(520,80);caption.textContent=scene+' — '+spec.name;copy.getContext('2d').drawImage(canvas,760,0,520,80,0,0,520,80);figure.append(caption,copy);galleryElement.append(figure);}
  }
 }
 const output={pass:errors.length===0,wholeUI:true,executesDos:false,importsCreditLayoutHelper:false,sourceHashes,nativeControlEvidence:'GUI_DrawCredits, six columns x260+10*i; SCREEN1 widget4 copied up40 to widget5[256,4,64,9]',independentSafeField:safe,stressValueNote:'999999/100000 exercise six slots; ordinary native credits are uint16.',coverage:{scenes:2,staticValues:[0,341,65535,999999],carryPairs:5,offsets:Array.from({length:15},(_,i)=>i-7),cases:results.length},panelBaseline,results,errors};
 resultElement.textContent=JSON.stringify(output);statusElement.textContent=output.pass?'PASS: fixed slots and all roll phases preserve counter frame.':'FAIL: '+errors.length+' counter errors';document.body.dataset.pass=String(output.pass);
}catch(error){resultElement.textContent=JSON.stringify({pass:false,error:String(error),stack:error.stack});statusElement.textContent='Fixture failed';document.body.dataset.error='true';}
document.body.dataset.done='true';
</script>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    names = ['dist/painted/native.json', 'dist/painted/interface.json', 'dist/painted/icons.json', 'dist/painted-credits.mjs']
    hashes = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in names if (ROOT / name).is_file()}
    destination = args.output.resolve()
    assert destination.parent == (ROOT / 'dist').resolve(), 'Temporary fixture must be directly inside dune2/dist'
    destination.write_text(TEMPLATE.replace('__HASHES__', json.dumps(hashes)))
    print(json.dumps({'output': str(destination), 'wholeUICases': 162, 'executesDos': False, 'launchesServer': False, 'importsCreditLayoutHelper': False}))


if __name__ == '__main__':
    main()
