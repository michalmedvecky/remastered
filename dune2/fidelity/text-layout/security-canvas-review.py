#!/usr/bin/env python3
"""Emit an inert native-security composition and owned-text Canvas regression.

Uses retained indexed CPS/SHP/FNT/WSA evidence with production createPaintedUI.
No game, WASM, original executable, emulator or server is launched.
"""
from pathlib import Path
import argparse,base64,hashlib,importlib.util,json

ROOT=Path(__file__).resolve().parents[2]
ADVISOR_PATH=ROOT/'fidelity/painted-polish/advisor-canvas-review.py'
spec=importlib.util.spec_from_file_location('advisor_security_fixture',ADVISOR_PATH)
ADVISOR=importlib.util.module_from_spec(spec);spec.loader.exec_module(ADVISOR)
SOURCE_FRAME=ADVISOR.TEMPLATE[ADVISOR.TEMPLATE.index('function makeFrame('):ADVISOR.TEMPLATE.index('function compareRegion(')]
SOURCE_FRAME=SOURCE_FRAME.replace(' else sprite(377,200,168);','')

TEMPLATE=r'''<!doctype html><meta charset=utf-8><title>Security text composition QA</title>
<style>body{margin:12px;background:#101820;color:#eee;font:14px sans-serif}#gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0}canvas{display:block;width:100%;height:auto}figcaption{padding:5px}#result{display:none}</style>
<h1>Bezpečnostní otázka a vstup: celé HD pozadí, jediná vrstva písma</h1><p id=status>Loading original indexed evidence…</p><div id=gallery></div><pre id=result>pending</pre><script type=module>
import{createPaintedUI}from'./painted-ui.mjs';
import{prepareFrameDescriptor,stampNativeSprite,mappedIndex,toRgba}from'./hd-core.mjs';
import{decodeNativeCharacter,decodeNativeText}from'./native-text.mjs';
const locale=__LOCALE__,fixtures=__FIXTURES__,fonts={fonts:locale.fonts},sourceHashes=__HASHES__,question=__QUESTION__;
const fullClip=[0,0,320,200],poses={h:387,a:402,o:417,m:462},houseIDs={h:0,a:1,o:2,m:5};let serial=0;
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)),surface=(w=1280,h=800)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const json=async name=>(await fetch('./painted/'+name+'.json')).json(),insideR=(x,y,r)=>x>=r[0]&&y>=r[1]&&x<r[0]+r[2]&&y<r[1]+r[3];
const alphabet=new Map();for(let c=0;c<254;c++){try{alphabet.set(decodeNativeCharacter(c,locale.encoding),c);}catch{}}
const encode=value=>Uint8Array.from([...value],c=>{if(!alphabet.has(c))throw Error('No native byte '+c);return alphabet.get(c);});
__SOURCE_FRAME__
function securityFrame(chrome,sourceFrames,advisor,answer,blink,pose){
 const frame=makeFrame(chrome,sourceFrames,{advisor,mode:'security',pose,resource:'PALACE.WSA',phase:0});
 frame.textEncoding=locale.encoding;frame.textRuns=[];frame.textGlyphs=[];frame.borders=[];
 const owners=new Int32Array(64000).fill(-1),coverage=new Int32Array(64000).fill(-1),records=[],runs=[];
 function put(x,y,index,owner=-1){if(x<0||x>=320||y<0||y>=200)return;frame.pixels[y*320+x]=index;owners[y*320+x]=owner;}
 function border(rect,schema,fill){
  const[x,y,w,h]=rect,colours=schema===1?[20,26,16,20]:[20,16,26,20];
  if(fill)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(xx,yy,colours[0]);
  for(let xx=x;xx<x+w;xx++){put(xx,y,colours[2]);put(xx,y+h-1,colours[1]);}
  for(let yy=y;yy<y+h;yy++){put(x,yy,colours[2]);put(x+w-1,yy,colours[1]);}
  put(x,y+h-1,colours[3]);put(x+w-1,y,colours[3]);
  const row={x,y,width:w,height:h,type:-1,widgetIndex:-1,schema,fill,pressed:false,screen:0,serial:++serial,sourceSerial:serial,ink:[]};
  // hd_border_record observes only the native one-pixel rim, even when filled.
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(xx===0||yy===0||xx===w-1||yy===h-1)row.ink.push([xx,yy,frame.pixels[(y+yy)*320+x+xx]]);
  row.totalInk=row.visibleInk=row.ink.length;frame.borders.push(row);
 }
 function line(value,x,y,{background=0,shadow3=false,copyRect=fullClip}={}){
  const source=locale.fonts['NEW8P.FNT'],textBytes=[...encode(value)],colours=[background,15,12,shadow3?12:0,6,...Array(11).fill(0)],runIndex=runs.length;
  const run={text:decodeNativeText(textBytes,locale.encoding),textBytes,x,y,width:0,height:source.height,fontHeight:source.height,font:2,colours,runId:++serial,serial,sourceSerial:serial,visibleInk:0,totalInk:0,ink:[],glyphs:[],clips:[]};
  let left=x;
  for(const[index,char]of textBytes.entries()){
   const g=source.chars[char],data=bytes(g.nibblesBase64),record=records.length;
   const glyph={char,x:left,y,width:g.width,height:source.height,fontHeight:source.height,font:2,advance:g.width-1,index,serial:run.serial+index/4294967296,sourceSerial:run.serial+index,colours,totalInk:0,visibleInk:0,ink:[]};
   records.push({glyph,run});run.glyphs.push(glyph);
   for(let yy=0;yy<source.height;yy++)for(let xx=0;xx<g.width;xx++){
    const code=yy>=g.unusedLines&&yy<g.unusedLines+g.usedLines?data[(yy-g.unusedLines)*g.width+xx]:0,colour=colours[code];
    if(!colour)continue;glyph.totalInk++;
    if(insideR(left+xx,y+yy,copyRect))put(left+xx,y+yy,colour,record);
   }
   run.width=Math.max(run.width,left+g.width-x);left+=glyph.advance;
  }
  for(let yy=y;yy<y+run.fontHeight;yy++)for(let xx=x;xx<x+run.width;xx++)if(insideR(xx,yy,copyRect)&&insideR(xx,yy,fullClip))coverage[yy*320+xx]=runIndex;
  runs.push(run);return run;
 }
 // Exact native Security_Show window; widget9=[16,176,288,11].
 border([10,170,300,23],1,true);border([14,174,292,15],2,false);
 const questionRun=line(question,4,1,{shadow3:true,copyRect:[0,0,320,40]});
 let inputX=16;
 for(const char of answer){line(char,inputX,176,{background:20,copyRect:[16,176,288,11]});inputX+=locale.fonts['NEW8P.FNT'].chars[char.charCodeAt(0)].width-1;}
 const cursorRect=[inputX,176,locale.fonts['NEW8P.FNT'].chars[87].width,11];
 // GUI_EditBox_BlinkCursor is a raw rectangle, not a DirectBorder command.
 for(let yy=176;yy<187;yy++)for(let xx=inputX;xx<inputX+cursorRect[2];xx++){put(xx,yy,blink?15:20);coverage[yy*320+xx]=-1;}
 for(let at=0;at<64000;at++)if(owners[at]>=0){const{glyph}=records[owners[at]],x=at%320,y=Math.floor(at/320);glyph.ink.push([x-glyph.x,y-glyph.y,frame.pixels[at]]);}
 for(const{glyph,run}of records){glyph.visibleInk=glyph.ink.length;glyph.clip=[glyph.x,glyph.y,glyph.width,glyph.height];run.visibleInk+=glyph.visibleInk;run.totalInk+=glyph.totalInk;for(const[x,y,c]of glyph.ink)run.ink.push([glyph.x+x-run.x,glyph.y+y-run.y,c]);if(glyph.visibleInk)frame.textGlyphs.push(glyph);}
 for(let i=0;i<runs.length;i++){
  const run=runs[i],ends=new Map();
  for(let y=0;y<200;y++)for(let x=0;x<320;){if(coverage[y*320+x]!==i){x++;continue;}const first=x;while(x<320&&coverage[y*320+x]===i)x++;const key=first+':'+(x-first),prior=ends.get(key);if(prior&&prior[1]+prior[3]===y)prior[3]++;else{const rect=[first,y,x-first,1];run.clips.push(rect);ends.set(key,rect);}}
  run.clip=[run.x,run.y,run.width,run.fontHeight];if(run.visibleInk)frame.textRuns.push(run);
 }
 // The opaque native security window overwrites lower shoulder/book pixels.
 for(const command of frame.uiCommands){command.ink=command.ink.filter(([x,y])=>!insideR(command.x+x,command.y+y,[10,170,300,23]));command.visibleInk=command.ink.length;}
 frame.uiCommands=frame.uiCommands.filter(c=>c.visibleInk);frame.uiPixels=frame.pixels.slice();
 return{frame,questionRect:[questionRun.x,questionRun.y,questionRun.width,questionRun.fontHeight],inputRect:[16,176,288,11],cursorRect};
}
const differences=(a,b,rect)=>{let count=0,maximum=0;for(let y=rect[1]*4;y<(rect[1]+rect[3])*4;y++)for(let x=rect[0]*4;x<(rect[0]+rect[2])*4;x++)for(let c=0;c<4;c++){const at=(y*1280+x)*4+c,delta=Math.abs(a[at]-b[at]);if(delta){count++;maximum=Math.max(maximum,delta);}}return{differentBytes:count,maxChannelDelta:maximum};};
try{
 const[native,chrome]=await Promise.all([json('native'),json('interface')]);for(const[name,patch]of Object.entries(locale.scenes))if(chrome.scenes[name])chrome.scenes[name]={...chrome.scenes[name],...patch};
 const sourceFrames={tiles:{},units:{},ui:{}};for(const kind of Object.keys(sourceFrames))for(const[id,row]of Object.entries(native.frames[kind]))sourceFrames[kind][id]=prepareFrameDescriptor(kind==='ui'&&locale.uiFrames[id]?{...row,...locale.uiFrames[id]}:row);
 const ui=await createPaintedUI({sourceFrames,locale}),canvas=surface(),ctx=canvas.getContext('2d',{willReadFrequently:true}),rawCanvas=surface(320,200),rawContext=rawCanvas.getContext('2d'),image=rawContext.createImageData(320,200),results=[],errors=[],blinkPairs=new Map();
 const atlases=new Map();for(const[key,row]of Object.entries(chrome.atlases)){const im=new Image();await new Promise((ok,no)=>{im.onload=ok;im.onerror=no;im.src='./'+row.src;});atlases.set(key,im);}
 const expectedBases=new Map();for(const advisor of ['a','h','o','m']){const d=chrome.frames['advisor-'+advisor],c=surface(),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(atlases.get(d.atlas),...d.rect,0,0,1280,800);expectedBases.set(advisor,x.getImageData(0,0,1280,800).data);}
 function render(frame,poisonRects=[]){
  toRgba(frame.uiPixels,frame.palette,image.data);rawContext.putImageData(image,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(rawCanvas,0,0,1280,800);
  if(poisonRects.length){const raw=ctx.getImageData(0,0,1280,800);for(const r of poisonRects)for(let y=r[1]*4;y<(r[1]+r[3])*4;y++)for(let x=r[0]*4;x<(r[0]+r[2])*4;x++){const p=(y*1280+x)*4;raw.data[p]=(x*37+y*19)&255;raw.data[p+1]=(x^y)&255;raw.data[p+2]=((x+y)&1)?255:0;raw.data[p+3]=255;}ctx.putImageData(raw,0,0);}
  ui.draw(ctx,frame);return ctx.getImageData(0,0,1280,800).data;
 }
 for(const advisor of ['a','h','o','m'])for(const[answerIndex,answer]of ['','KOV','KOVOVE'].entries())for(const blink of [false,true]){
  const fixture=securityFrame(chrome,sourceFrames,advisor,answer,blink,answerIndex*2),{frame,questionRect,inputRect,cursorRect}=fixture,actual=render(frame),diagnostic=ui.diagnostics(),poisoned=render(frame,[questionRect,inputRect]);
  const row={advisor,answer,blink,pose:answerIndex*2,scene:diagnostic.scene,expectedScene:'MENTAT'+advisor.toUpperCase()+'.CPS',nativeQuestion:question,questionRect,inputRect,cursorRect,sourceInputRuns:frame.textRuns.filter(r=>r.y===176).map(r=>({text:r.text,x:r.x,width:r.width,clips:r.clips})),fitViolations:diagnostic.textFit.violations,skippedStale:diagnostic.skippedStale,skippedAdvisorPatches:diagnostic.skippedAdvisorPatches,questionUnderlay:differences(actual,poisoned,questionRect),inputUnderlay:differences(actual,poisoned,inputRect),body:{}};
  for(const[name,rect]of Object.entries({hair:[28,48,80,24],body:[4,148,60,20],leftWall:[2,40,12,96]}))row.body[name]=differences(actual,expectedBases.get(advisor),rect);
  if(row.scene!==row.expectedScene)errors.push(advisor+' '+answer+' blink'+blink+': advisor source not recognized');
  if(row.fitViolations||row.skippedStale||row.skippedAdvisorPatches)errors.push(advisor+' '+answer+': text witness/actor/fit failure');
  for(const[name,delta]of Object.entries(row.body))if(delta.differentBytes)errors.push(advisor+' '+answer+': mixed advisor '+name);
  for(const name of ['questionUnderlay','inputUnderlay'])if(row[name].differentBytes)errors.push(advisor+' '+answer+' blink'+blink+': '+name+' retained native/neon pixels');
  const pair=advisor+':'+answer;if(!blink)blinkPairs.set(pair,actual);else{row.blinkChange=differences(actual,blinkPairs.get(pair),cursorRect);if(!row.blinkChange.differentBytes)errors.push(advisor+' '+answer+': input blink visually lost');}
  results.push(row);
  if(answer==='KOVOVE'&&blink||answer===''&&!blink){render(frame);const figure=document.createElement('figure'),caption=document.createElement('figcaption'),copy=surface();caption.textContent=advisor+' — '+(answer||'prázdná odpověď')+' — kurzor '+(blink?'zapnutý':'vypnutý');copy.getContext('2d').drawImage(canvas,0,0);figure.append(caption,copy);document.getElementById('gallery').append(figure);}
 }
 const output={pass:errors.length===0,wholeProductionUI:true,executesDos:false,sourceHashes,sourceEvidence:'GUI_Security_Show / GUI_Security_DrawText / GUI_EditBox / GUI_EditBox_BlinkCursor',coverage:{advisors:4,answerStages:3,blinkPhases:2,animationPoses:[0,2,4],cases:results.length,mercenaryCompositionStress:true},poisonChangesDisplayedUnderlayOnly:true,nativeInkWitnessesPreserved:true,results,errors};
 document.getElementById('result').textContent=JSON.stringify(output);document.getElementById('status').textContent=output.pass?'PASS: celé HD pozadí, jediná vrstva písma a viditelné blikání.':'FAIL: '+errors.length+' security composition errors';document.body.dataset.pass=String(output.pass);
}catch(error){document.getElementById('result').textContent=JSON.stringify({pass:false,error:String(error),stack:error.stack});document.body.dataset.error='true';document.getElementById('status').textContent='Fixture error';}
document.body.dataset.done='true';
</script>'''

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    locale=json.loads((ROOT/'dist/locales/cs.json').read_text());assert locale['complete']
    question=json.loads((ROOT/'art/localization/cs-protect.json').read_text())['translations']['PROTECT.ENG:061']
    frames={}
    for folder in ['motion','extra-motion']:
        source=ROOT/'art/hd-v3/media'/folder
        for row in json.loads((source/'inventory.json').read_text())['resources']:
            if row['resource']!='PALACE.WSA':continue
            for frame in row['frames']:
                if frame['frame']!=0:continue
                raw=(source/frame['indexFile']).read_bytes();assert len(raw)==184*112;assert hashlib.sha256(raw).hexdigest()==frame['pixelSha256'];frames['PALACE.WSA:0']=base64.b64encode(raw).decode()
    assert len(frames)==1
    names=['fidelity/text-layout/security-canvas-review.py','fidelity/painted-polish/advisor-canvas-review.py','dist/painted-ui.mjs','dist/painted-scenes.mjs','dist/painted-text-layout.mjs','dist/locales/cs.json','dist/painted/native.json','dist/painted/interface.json','native/opendune/src/gui/security.c','native/opendune/src/gui/editbox.c','native/opendune/src/gui/gui.c','native/opendune/src/gui/widget.c','native/browser/hd_bridge.c']
    hashes={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in names}
    destination=args.output.resolve();assert destination.parent==(ROOT/'dist').resolve()
    content=TEMPLATE.replace('__SOURCE_FRAME__',SOURCE_FRAME).replace('__LOCALE__',json.dumps(locale,ensure_ascii=False,separators=(',',':'))).replace('__FIXTURES__',json.dumps(frames)).replace('__HASHES__',json.dumps(hashes)).replace('__QUESTION__',json.dumps(question,ensure_ascii=False))
    destination.write_text(content);print(json.dumps({'output':str(destination),'cases':24,'executesDos':False,'launchesServer':False}))

if __name__=='__main__':main()
