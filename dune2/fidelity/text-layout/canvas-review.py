#!/usr/bin/env python3
"""Emit a focused production-Canvas check of Czech clipping and bevel clearance.

No game, WASM, emulator or server is launched. Native font observations follow
GUI_Widget_TextButton2_Draw, options WindowDesc, Mentat help and CHOAM caption
calls. Temporary output must be placed directly in dist/ and removed afterward.
"""
from pathlib import Path
import argparse,hashlib,json
ROOT=Path(__file__).resolve().parents[2]
TEMPLATE=r'''<!doctype html><meta charset=utf-8><title>Czech text clipping regression</title>
<style>body{background:#101820;color:#eee;font:14px sans-serif;margin:16px}#gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}canvas{display:block;width:100%;height:auto}figcaption{padding:6px}#result{display:none}</style>
<h1>České popisky: celá první písmena a bezpečné okraje</h1><p id=status>Loading…</p><div id=gallery></div><pre id=result>pending</pre><script type=module>
import{createPaintedUI}from'./painted-ui.mjs';
import{prepareFrameDescriptor,toRgba}from'./hd-core.mjs';
import{decodeNativeCharacter,decodeNativeText}from'./native-text.mjs';
__HELPERS__
const sourceHashes=__HASHES__,strings=__STRINGS__,locale=__LOCALE__;
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)),json=async name=>(await fetch('./painted/'+name+'.json')).json();
const surface=(w=1280,h=800)=>Object.assign(document.createElement('canvas'),{width:w,height:h}),check=(v,m)=>{if(!v)throw Error(m);};
const alphabet=new Map();for(let c=0;c<254;c++){try{alphabet.set(decodeNativeCharacter(c,locale.encoding),c);}catch{}}
const encode=value=>Uint8Array.from([...value],c=>{check(alphabet.has(c),'Native Czech byte '+c);return alphabet.get(c);});
const value=id=>strings['DUNE.ENG:'+String(id).padStart(3,'0')];
try{
 const[native,chrome]=await Promise.all([json('native'),json('interface')]);for(const[name,patch]of Object.entries(locale.scenes))if(chrome.scenes[name])chrome.scenes[name]={...chrome.scenes[name],...patch};
 const sourceFrames={tiles:{},units:{},ui:{}};for(const kind of Object.keys(sourceFrames))for(const[id,row]of Object.entries(native.frames[kind]))sourceFrames[kind][id]=prepareFrameDescriptor(kind==='ui'&&locale.uiFrames[id]?{...row,...locale.uiFrames[id]}:row);
 const ui=await createPaintedUI({sourceFrames,locale}),noSemantic=await createPaintedUI({sourceFrames,locale:{...locale,bitmapLabels:{...locale.bitmapLabels,9:'',377:''}}});
 const canvas=surface(),ctx=canvas.getContext('2d',{willReadFrequently:true}),rawCanvas=surface(320,200),rawContext=rawCanvas.getContext('2d'),data=rawContext.createImageData(320,200),errors=[],results=[];
 const render=(frame,painter=ui)=>{toRgba(frame.uiPixels,frame.palette,data.data);rawContext.putImageData(data,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(rawCanvas,0,0,1280,800);painter.draw(ctx,frame);return ctx.getImageData(0,0,1280,800).data;};
 const base=(scene,world=false)=>{const s=chrome.scenes[scene];return blankFrame(bytes(s.indicesBase64),s.palette6Base64?bytes(s.palette6Base64):Uint8Array.from(native.palette),world);};
 const text=(frame,v,options)=>addText(frame,{font:locale.fonts[options.fontName??'NEW6P.FNT'],encode,value:v,...options});
 const cases=[];
 for(const[id,label,rect]of [[30,'Zrušit',[258,110,58,11]],[34,'Opravit',[258,76,60,10]],[3,'Ústup',[258,99,60,10]],[1,'Útok',[258,77,60,10]],[6,'Těžit',[258,88,60,10]]])for(const dx of [-2,0,2]){
  const f=base('SCREEN.CPS',true);addBorder(f,rect);const r=text(f,value(id),{centerX:rect[0]+rect[2]/2+dx,y:rect[1]+1,offset:-1});
  cases.push({name:label+' native copy offset '+dx,frame:finishFrame(f),labels:[{text:label,safe:[rect[0]+4,rect[1]+2,rect[2]-8,rect[3]-4],cap:4.2}],crop:[250,70,70,55],gallery:dx===0});
 }
 for(const[id,percent]of [[41,0],[38,0],[46,42],[46,100]]){
  const f=base('SCREEN.CPS',true),caption=value(id).replace('%d',String(percent)).replace('%%','%');addBorder(f,[258,87,60,35],5);addSprite(f,sourceFrames.ui[65],65,260,89);
  text(f,caption,{centerX:288,y:113,offset:-1,foreground:id===38?239:15});
  cases.push({name:'Tall production portrait '+caption,frame:finishFrame(f),labels:[{text:caption,safe:[264,114,48,6],cap:4.2,minCap:3.5}],crop:[254,83,66,43],gallery:true});
 }
 {
  const f=base('SCREEN.CPS',true);addBorder(f,[40,48,240,134],16);
  const rows=[[92,16,23,208],[93,16,40,208],[94,16,57,208],[103,16,74,208],[104,16,91,208],[96,120,110,104],[95,16,110,104]],labels=[];
  for(const[id,x,y,w]of rows){const rect=[40+x,48+y,w,15];addBorder(f,rect);text(f,value(id),{fontName:'NEW8P.FNT',fontId:2,x:rect[0]+3,y:rect[1]+2,offset:-1});labels.push({text:value(id),safe:[rect[0]+9,rect[1]+4,w-18,7],cap:5});}
  cases.push({name:'Options menu native windows',frame:finishFrame(f),labels,crop:[40,48,240,134],gallery:true});
 }
 {
  const f=base('SCREEN.CPS',true);addBorder(f,[40,48,240,134],16);const labels=[];
  for(const[id,y]of [[105,22],[106,39],[113,56],[105,73],[105,90],[102,110]]){const rect=[id===102?136:192,48+y,id===102?136:80,15];addBorder(f,rect);text(f,value(id),{fontName:'NEW8P.FNT',fontId:2,x:rect[0]+3,y:rect[1]+2,offset:-1});labels.push({text:value(id),safe:[rect[0]+9,rect[1]+4,rect[2]-18,7],cap:5});}
  cases.push({name:'Options states and slowest speed',frame:finishFrame(f),labels,crop:[40,48,240,134],gallery:true});
 }
 {
  const f=base('FAME.CPS'),labels=[];
  for(const[id,x]of [[327,51],[326,178]]){const rect=[x,180,91,10];addBorder(f,rect);text(f,value(id),{centerX:x+45,y:181,offset:-1});labels.push({text:value(id),safe:[x+4,182,83,6],cap:4.2,minCap:3});}
  cases.push({name:'Hall of Fame compact ten-pixel buttons',frame:finishFrame(f),labels,crop:[44,174,232,22],gallery:true});
 }
 for(const quantity of [false,true]){
  const f=base('CHOAM.CPS'),font=locale.fonts['NEW8P.FNT'],costWidth=nativeWidth(font,value(178),encode,-2),qtyWidth=nativeWidth(font,value(180),encode,-2),copyRect=[128,21,182,14],cost=value(177).replace('%3d','300'),qty=value(179).replace('%2d',' 2');
  const name=value(251);text(f,name,{fontName:'NEW8P.FNT',fontId:2,x:128,y:23,offset:-2,foreground:12,shadow:false,copyRect});text(f,cost,{fontName:'NEW8P.FNT',fontId:2,x:310-costWidth,y:23,offset:-2,foreground:12,shadow:false,copyRect});
  if(quantity)text(f,qty,{fontName:'NEW8P.FNT',fontId:2,x:310-costWidth-qtyWidth-2,y:23,offset:-2,foreground:12,shadow:false,copyRect});
  cases.push({name:'Factory caption'+(quantity?' with quantity':''),frame:finishFrame(f),labels:[name,cost,...(quantity?[qty]:[])].map(text=>({text,safe:[134,17,172,10],cap:6})),crop:[120,7,196,33],gallery:true});
 }
 {
  const f=base('MENTATA.CPS');text(f,value(48),{fontName:'NEW8P.FNT',fontId:2,x:144,y:50,offset:-2,foreground:12,shadow:false,copyRect:[128,48,184,112]});cases.push({name:'Mentat subject heading',frame:finishFrame(f),labels:[{text:value(48),safe:[144,50,168,11]}],crop:[128,46,184,24],gallery:true});
 }
 for(const[id,scene,x,y]of [[377,'MENTATA.CPS',200,168],[9,'SCREEN.CPS',104,1]]){
  const f=base(scene,scene==='SCREEN.CPS'),s=sourceFrames.ui[id];addSprite(f,s,id,x,y);cases.push({name:'Semantic '+locale.bitmapLabels[id],frame:finishFrame(f),semantic:true,labels:[{text:locale.bitmapLabels[id],safe:[x+9,y+4,s.sourceW-18,s.sourceH-8],cap:5.2}],crop:[Math.max(0,x-4),Math.max(0,y-4),Math.min(320-x+4,s.sourceW+8),Math.min(200-y+4,s.sourceH+8)],gallery:true});
 }
 const inSafe=(x,y,[l,t,w,h])=>x>=l*4&&y>=t*4&&x<(l+w)*4&&y<(t+h)*4;
 for(const spec of cases){
  const actual=render(spec.frame),diagnostic=ui.diagnostics(),repeat=render(spec.frame),reference=render(widenTextCoverage(spec.frame)),baseline=render(blankCaptions(spec.frame),spec.semantic?noSemantic:ui);let different=0,changedCaptionPixels=0,outside=0,repeatDifference=0,repeatMaximumDelta=0;const changedLocations=[],repeatLocations=[];
  for(let p=0;p<actual.length;p+=4){let changed=false;for(let c=0;c<4;c++)if(actual[p+c]!==repeat[p+c]){repeatDifference++;changed=true;repeatMaximumDelta=Math.max(repeatMaximumDelta,Math.abs(actual[p+c]-repeat[p+c]));}if(changed)repeatLocations.push([(p/4)%1280,Math.floor(p/4/1280)]);}
  for(let i=0;i<actual.length;i++)if(actual[i]!==reference[i])different++;
  for(let p=0;p<actual.length;p+=4){if(![0,1,2,3].some(c=>actual[p+c]!==baseline[p+c]))continue;changedCaptionPixels++;const x=(p/4)%1280,y=Math.floor(p/4/1280);if(!spec.labels.some(label=>inSafe(x,y,label.safe))){outside++;changedLocations.push([x,y]);}}
  const available=[...diagnostic.textFit.labels],labels=[];for(const wanted of spec.labels){const at=available.findIndex(r=>r.text===wanted.text),found=at<0?null:available.splice(at,1)[0];if(!found){errors.push(spec.name+': missing literal '+wanted.text);continue;}const[x,y,w,h]=found.ink,[l,t,sw,sh]=wanted.safe;if(x<l-.001||y<t-.001||x+w>l+sw+.001||y+h>t+sh+.001)errors.push(spec.name+': text ink touches a bevel/bottom edge '+wanted.text);if(wanted.cap&&found.fontSize>wanted.cap*4+.02)errors.push(spec.name+': oversized cap '+wanted.text);if(wanted.minCap&&found.fontSize<wanted.minCap*4-.02)errors.push(spec.name+': compact caption became illegibly small '+wanted.text);labels.push({text:wanted.text,firstCharacter:[...wanted.text][0],nativeRect:found.nativeRect,ink:found.ink,safe:wanted.safe,fontSize:found.fontSize});}
  if(different)errors.push(spec.name+': native-coverage and full-reference renders differ ('+different+' bytes)');if(repeatDifference)errors.push(spec.name+': first and identical-repeat raster differ ('+repeatDifference+' bytes)');if(!changedCaptionPixels)errors.push(spec.name+': caption has no visible ink');if(outside)errors.push(spec.name+': '+outside+' caption pixels outside safe interior');if(diagnostic.textFit.violations)errors.push(spec.name+': fit violation');
  const outsideBounds=changedLocations.length?[Math.min(...changedLocations.map(p=>p[0])),Math.min(...changedLocations.map(p=>p[1])),Math.max(...changedLocations.map(p=>p[0]))+1,Math.max(...changedLocations.map(p=>p[1]))+1]:null;
  const repeatBounds=repeatLocations.length?[Math.min(...repeatLocations.map(p=>p[0])),Math.min(...repeatLocations.map(p=>p[1])),Math.max(...repeatLocations.map(p=>p[0]))+1,Math.max(...repeatLocations.map(p=>p[1]))+1]:null;
  const row={name:spec.name,fullInitialLetters:different===0,referenceDifferenceBytes:different,sameFrameRepeatDifferenceBytes:repeatDifference,sameFrameRepeatChangedPixels:repeatLocations.length,sameFrameRepeatMaximumChannelDelta:repeatMaximumDelta,sameFrameRepeatPhysicalBounds:repeatBounds,changedCaptionPixels,outsideSafeCaptionPixels:outside,outsideSafePhysicalBounds:outsideBounds,fitViolations:diagnostic.textFit.violations,labels,nativeRuns:spec.frame.textRuns.map(r=>({text:r.text,x:r.x,y:r.y,width:r.width,fontHeight:r.fontHeight,clips:r.clips,firstGlyph:{char:r.glyphs[0].char,x:r.glyphs[0].x,y:r.glyphs[0].y,width:r.glyphs[0].width,height:r.glyphs[0].height,advance:r.glyphs[0].advance,visibleInk:r.glyphs[0].visibleInk}}))};results.push(row);
  if(spec.gallery){render(spec.frame);const figure=document.createElement('figure'),caption=document.createElement('figcaption'),crop=spec.crop.map(v=>v*4),copy=surface(crop[2],crop[3]);copy.getContext('2d').drawImage(canvas,...crop,0,0,crop[2],crop[3]);caption.textContent=spec.name+' — '+(row.fullInitialLetters?'celá první písmena':'CHYBA OŘEZU');figure.append(caption,copy);document.getElementById('gallery').append(figure);}
 }
 const output={pass:errors.length===0,wholeProductionUI:true,executesDos:false,sourceHashes,coverage:{cases:results.length,hudOriginOffsets:[-2,0,2],hudLabels:['Zrušit','Opravit','Ústup','Útok','Těžit'],tallProductionPortraits:4,optionsWindows:2,fameCompactButtons:2,factoryHeaders:2,subjectHeaders:1,semanticButtons:2},results,errors};document.getElementById('result').textContent=JSON.stringify(output);document.getElementById('status').textContent=output.pass?'PASS: celá písmena, bezpečné okraje.':'FAIL: '+errors.length+' errors';document.body.dataset.pass=String(output.pass);
}catch(error){document.getElementById('result').textContent=JSON.stringify({pass:false,error:String(error),stack:error.stack});document.body.dataset.error='true';}
document.body.dataset.done='true';
</script>'''
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
 locale=json.loads((ROOT/'dist/locales/cs.json').read_text());assert locale['complete'];strings=json.loads((ROOT/'art/localization/cs-core.json').read_text())['translations']
 names=['fidelity/text-layout/fixtures.mjs','fidelity/text-layout/canvas-review.py','dist/painted-ui.mjs','dist/painted-ui-core.mjs','dist/painted-core.mjs','dist/painted-text-layout.mjs','dist/painted-typography.mjs','dist/painted-font-data.mjs','dist/painted/native.json','dist/painted/interface.json','dist/painted/icons.json','dist/painted/media.json','dist/locales/cs.json','native/opendune/src/gui/widget_draw.c','native/opendune/src/gui/gui.c','native/opendune/src/gui/mentat.c','native/opendune/src/table/widgetinfo.c','native/opendune/src/table/windowdesc.c','native/opendune/src/table/strings.h'];hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()for p in names}
 destination=args.output.resolve();assert destination.parent==(ROOT/'dist').resolve();destination.write_text(TEMPLATE.replace('__HELPERS__',(ROOT/'fidelity/text-layout/fixtures.mjs').read_text()).replace('__HASHES__',json.dumps(hashes)).replace('__STRINGS__',json.dumps(strings,ensure_ascii=False)).replace('__LOCALE__',json.dumps(locale,ensure_ascii=False,separators=(',',':'))));print(json.dumps(dict(output=str(destination),cases=27,executesDos=False,launchesServer=False)))
if __name__=='__main__':main()
