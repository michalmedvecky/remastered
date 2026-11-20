#!/usr/bin/env python3
"""Generate an inert full Czech production-UI typography/composition review.

Original advisor and credit fixture helpers are reused without changing them.
The page uses verified CP1250 font/SHP/CPS overlays and production decoding.
No original game, emulator, WASM or server is launched by this generator.
"""
from pathlib import Path
import argparse, base64, hashlib, importlib.util, json
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

def load(name):
    spec=importlib.util.spec_from_file_location(name.replace('-','_'),HERE/(name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

ADVISOR=load('advisor-canvas-review')
CREDITS=load('credits-canvas-review')

EXTRA_HELPERS=r'''
const byteMap=new Map();for(let byte=0;byte<254;byte++){try{byteMap.set(decodeNativeCharacter(byte,locale.encoding),byte);}catch{}}
function encodeNative(value){return Uint8Array.from([...value],char=>{if(!byteMap.has(char))throw Error('No CP1250 byte for '+char);return byteMap.get(char);});}
function appendNativeLine(frame,value,x,y,{fontName='NEW8P.FNT',font=2,offset=-1,colour=15}={}){
 const source=fonts.fonts[fontName],nativeBytes=encodeNative(value),glyphs=[],colours=[0,colour,12,12,...Array(12).fill(0)],run={text:decodeNativeText(nativeBytes,locale.encoding),textBytes:[...nativeBytes],x,y,width:0,height:source.height,fontHeight:source.height,font,colours,sourceSerial:++serial,serial,visibleInk:0,totalInk:0,ink:[],glyphs,clips:[]};
 for(let i=0;i<nativeBytes.length;i++){
  const char=nativeBytes[i],g=source.chars[char],data=bytes(g.nibblesBase64),glyph={char,x,y,width:g.width,height:source.height,fontHeight:source.height,font,advance:g.width+offset,index:i,colours,serial:run.serial+i/4294967296,sourceSerial:run.serial+i,visibleInk:0,totalInk:0,ink:[]};
  for(let yy=0;yy<g.usedLines;yy++)for(let xx=0;xx<g.width;xx++){
   const index=colours[data[yy*g.width+xx]],sx=x+xx,sy=y+g.unusedLines+yy;if(!index||sx<0||sx>=320||sy<0||sy>=200)continue;
   frame.pixels[sy*320+sx]=index;glyph.ink.push([xx,g.unusedLines+yy,index]);run.ink.push([sx-run.x,sy-run.y,index]);
  }
  glyph.visibleInk=glyph.totalInk=glyph.ink.length;glyph.clip=[x,y,g.width,source.height];glyphs.push(glyph);if(glyph.visibleInk)frame.textGlyphs.push(glyph);
  run.width=Math.max(run.width,x+g.width-run.x);run.visibleInk+=glyph.visibleInk;run.totalInk+=glyph.totalInk;x+=glyph.advance;
 }
 run.clip=[run.x,run.y,run.width,run.height];run.clips=[run.clip.slice()];frame.textRuns.push(run);frame.uiPixels=frame.pixels.slice();return run;
}
function makeMenuFrame(native,chrome,sourceFrames){
 const frame=makeCreditFrame(native,chrome,sourceFrames,'hud',{kind:'static',value:341});
 frame.borders=[];const border=(x,y,width,height,widgetIndex)=>{for(let yy=y;yy<y+height;yy++)frame.pixels.fill(12,yy*320+x,yy*320+x+width);frame.borders.push({x,y,width,height,widgetIndex,type:2,fill:true,pressed:false,serial:++serial,sourceSerial:serial});};
 // g_widgetProperties[16]=[5,48,30,134]; g_optionsWindowDesc literal offsets.
 border(40,48,240,134,16);
 const title='Dune II: Budování dynastie',width=[...encodeNative(title)].reduce((n,c)=>n+fonts.fonts['NEW8P.FNT'].chars[c].width-1,0);
 appendNativeLine(frame,title,160-Math.floor(width/2),54);
 const rows=[['Načíst hru',16,23,208],['Uložit hru',16,40,208],['Nastavení hry',16,57,208],['Restartovat misi',16,74,208],['Vybrat jiný rod',16,91,208],['Pokračovat ve hře',120,110,104],['Ukončit hraní',16,110,104]];
 for(const[value,dx,dy,w]of rows){border(40+dx,48+dy,w,15,19);appendNativeLine(frame,value,43+dx,50+dy);}
 frame.uiPixels=frame.pixels.slice();return frame;
}
'''

EXTRA_CASES=r'''
 const cursorResults=[];let initialLabels=null;
 for(const[x,y]of [[4,1],[35,12],[140,23],[310,1]]){
  const f=makeFrame(chrome,sourceFrames,{advisor:'a',mode:'briefing',pose:2,resource:'WIN1.WSA',phase:0,cursor:true,cursorX:x,cursorY:y});
  toRgba(f.uiPixels,f.palette,image.data);nc.putImageData(image,0,0);ctx.drawImage(nativeCanvas,0,0,1280,800);ui.draw(ctx,f);
  const labels=ui.diagnostics().textFit.labels;
  if(initialLabels===null)initialLabels=JSON.stringify(labels);else if(JSON.stringify(labels)!==initialLabels)errors.push('Cursor changed Czech full-run font size/spacing at '+x+','+y);
  cursorResults.push({x,y,literalRuns:f.textRuns.map(r=>r.text),fitViolations:ui.diagnostics().textFit.violations});
 }
 const render=frame=>{toRgba(frame.uiPixels,frame.palette,image.data);nc.putImageData(image,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(nativeCanvas,0,0,1280,800);ui.draw(ctx,frame);return ctx.getImageData(0,0,1280,800).data;};
 const menuFrame=makeMenuFrame(native,chrome,sourceFrames);render(menuFrame);const menuDiagnostic=ui.diagnostics(),menuLabels=menuDiagnostic.textFit.labels.map(r=>r.text);
 for(const value of ['Dune II: Budování dynastie','Restartovat misi','Vybrat jiný rod','Pokračovat ve hře'])if(!menuLabels.includes(value))errors.push('Missing literal Czech menu '+value);
 if(menuDiagnostic.textFit.violations)errors.push('Czech native options window overflow');
 {const figure=document.createElement('figure'),caption=document.createElement('figcaption'),copy=surface();caption.textContent='České herní volby — původní rozměry oken';copy.getContext('2d').drawImage(canvas,0,0);figure.append(caption,copy);galleryElement.append(figure);}
 const creditResults=[];
 for(const scene of ['hud','CHOAM.CPS']){
  const baseline=render(makeCreditFrame(native,chrome,sourceFrames,scene,{}, {counter:false})).slice();
  const stress=[{name:'background-only',kind:'background-only'},...Array.from([0,341,65535,999999],value=>({name:'static '+value,value,kind:'static'}))];
  for(const[old,next]of [[9,10],[99,100],[999,1000],[9999,10000],[99999,100000]])for(let offset=-7;offset<=7;offset++)stress.push({name:'roll '+old+'-'+next+' offset'+offset,kind:'roll',old,next,offset});
  stress.push({name:'partial last-slot copy',kind:'static',value:999999,partial:true});
  for(const spec of stress){
   const frame=makeCreditFrame(native,chrome,sourceFrames,scene,spec),actual=render(frame),delta=compareCredit(actual,baseline),diagnostic=ui.diagnostics(),row={scene,name:spec.name,fitViolations:diagnostic.textFit.violations,...delta};
   if(diagnostic.scene!==scene)errors.push(scene+' '+spec.name+': wrong scene');
   if(row.outsideAllowedPixels||row.rightBevelPixels||row.fitViolations)errors.push(scene+' '+spec.name+': Czech counter escaped safe field');
   if(spec.kind==='background-only'&&row.changedPixels)errors.push(scene+': source counter background erased paint');
   if(spec.kind==='static'&&!spec.partial){const text=numberText(spec.value);for(let column=0;column<6;column++)if((text[column]===' '&&row.columns[column]!==0)||(text[column]!==' '&&row.columns[column]===0))errors.push(scene+': unstable credit column '+column);}
   creditResults.push(row);
   if(scene==='hud'&&spec.name==='static 341'){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),copy=surface(520,80);caption.textContent='Kredity — šest pevných sloupců';copy.getContext('2d').drawImage(canvas,760,0,520,80,0,0,520,80);figure.append(caption,copy);galleryElement.append(figure);}
  }
 }
 const houseChoiceResults=[],englishChrome=await json('interface'),englishSources={tiles:{},units:{},ui:{}};
 for(const kind of Object.keys(englishSources))for(const[id,row]of Object.entries(native.frames[kind]))englishSources[kind][id]=prepareFrameDescriptor(row);
 const englishUI=await createPaintedUI({sourceFrames:englishSources});
 for(const[tag,painter,sourceChrome,translation]of [['cs',ui,chrome,locale.presentationLabels],['en',englishUI,englishChrome,{}]]){
  const scene=sourceChrome.scenes['HERALD.ENG'],pixels=bytes(scene.indicesBase64),palette=scene.palette6Base64?bytes(scene.palette6Base64):Uint8Array.from(native.palette),frame={pixels,uiPixels:pixels.slice(),palette,worldVisible:false,worldAvailable:false,playerHouse:1,uiCommands:[],textRuns:[],textGlyphs:[],borders:[],cursor:{visible:false,id:0,x:0,y:0,hotX:0,hotY:0}};
  toRgba(frame.uiPixels,frame.palette,image.data);nc.putImageData(image,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(nativeCanvas,0,0,1280,800);painter.draw(ctx,frame);
  const actual=ctx.getImageData(0,0,1280,800).data,diagnostic=painter.diagnostics(),expectedCanvas=surface(),expectedContext=expectedCanvas.getContext('2d',{willReadFrequently:true}),entry=sourceChrome.frames['house-choice'];
  // The retained new painting has transparent gaps around the crests/plates.
  // Independent composition starts with an opaque new background, never the
  // live native CPS containing its old letters, then adds the new atlas crop.
  const baseCrop=surface();baseCrop.getContext('2d',{willReadFrequently:true}).drawImage(atlases.get(entry.atlas),...entry.rect,0,0,1280,800);
  expectedContext.fillStyle='#010309';expectedContext.fillRect(0,0,1280,800);expectedContext.drawImage(baseCrop,0,0);
  const labels=[['Select your House',[12,9.5,296,17],[1,1,1,1]],['Atreides',[25.5,132,71,13],[3,2,3,2]],['Ordos',[122.5,132,71,13],[3,2,3,2]],['Harkonnen',[219.5,132,71,13],[3,2,3,2]]],checked=[];
  for(const[original,rect,insets]of labels){
   const value=translation[original]??original,observed=diagnostic.textFit.labels.find(r=>r.text===value);
   if(!observed){errors.push(tag+' house choice: missing '+value);continue;}
   if(JSON.stringify(observed.nativeRect)!==JSON.stringify(rect))errors.push(tag+' house choice: wrong gold-plate caption rectangle '+value);
   const[x,y,w,h]=observed.ink,[l,t,r,b]=insets;
   if(x<rect[0]+l-.001||y<rect[1]+t-.001||x+w>rect[0]+rect[2]-r+.001||y+h>rect[1]+rect[3]-b+.001)errors.push(tag+' house choice: caption escaped its actual plate '+value);
   checked.push({text:value,nativeRect:observed.nativeRect,ink:observed.ink});
  }
  const expected=expectedContext.getImageData(0,0,1280,800).data;let outsideCaptionDifferences=0,outsideMaxChannelDelta=0;
  const captionPixel=(x,y)=>checked.some(({ink:[l,t,w,h]})=>x>=Math.floor(l*4)&&y>=Math.floor(t*4)&&x<Math.ceil((l+w)*4)&&y<Math.ceil((t+h)*4));
  for(let p=0;p<actual.length;p+=4){if(captionPixel((p/4)%1280,Math.floor(p/4/1280)))continue;for(let c=0;c<4;c++)if(actual[p+c]!==expected[p+c]){outsideCaptionDifferences++;outsideMaxChannelDelta=Math.max(outsideMaxChannelDelta,Math.abs(actual[p+c]-expected[p+c]));}}
  if(outsideCaptionDifferences)errors.push(tag+' house choice: pixels outside new caption ink differ from the new base ('+outsideCaptionDifferences+' bytes, max delta '+outsideMaxChannelDelta+')');
  // Independently poison EVERY destination pixel while leaving the observed
  // native frame unchanged. A fully owned HERALD screen must erase this just
  // as completely as the original CPS letters, including transparent gaps.
  const poison=ctx.createImageData(1280,800);
  for(let i=0;i<poison.data.length;i+=4){const x=(i/4)%1280,y=Math.floor(i/4/1280);poison.data[i]=(x*37+y*19)&255;poison.data[i+1]=(x^y)&255;poison.data[i+2]=((x+y)&1)?255:0;poison.data[i+3]=255;}
  ctx.putImageData(poison,0,0);painter.draw(ctx,frame);const poisoned=ctx.getImageData(0,0,1280,800).data;let underlayDifferences=0;
  for(let i=0;i<actual.length;i++)if(actual[i]!==poisoned[i])underlayDifferences++;
  if(underlayDifferences)errors.push(tag+' house choice: owned screen retained its old/neon underlay ('+underlayDifferences+' bytes)');
  if(diagnostic.scene!=='HERALD.ENG'||diagnostic.textFit.violations)errors.push(tag+' house choice: scene or text-fit failure');
  houseChoiceResults.push({locale:tag,scene:diagnostic.scene,fitViolations:diagnostic.textFit.violations,labels:checked,baseOutsideCaptionDifferingBytes:outsideCaptionDifferences,baseOutsideCaptionMaxChannelDelta:outsideMaxChannelDelta,poisonUnderlayDifferingBytes:underlayDifferences,wholeCanvasUnderlayInvariance:true,mirrorsProductionTypography:false});
  const figure=document.createElement('figure'),caption=document.createElement('figcaption'),copy=surface();caption.textContent=tag+' — výběr rodu, skutečné zlaté jmenovky';copy.getContext('2d').drawImage(canvas,0,0);figure.append(caption,copy);galleryElement.append(figure);
 }
 const englishConfirmationResults=[],englishNames=['Harkonnen?','Atreides?','Ordos?'];
 for(const[house,resource]of [[0,'FHARK.WSA'],[1,'FARTR.WSA'],[2,'FORDOS.WSA']]){
  const frame=makeFrame(englishChrome,englishSources,{advisor:'m',mode:'confirmation',house,resource,phase:0,pose:2});
  toRgba(frame.uiPixels,frame.palette,image.data);nc.putImageData(image,0,0);ctx.drawImage(nativeCanvas,0,0,1280,800);englishUI.draw(ctx,frame);
  const diagnostic=englishUI.diagnostics(),labels=diagnostic.textFit.labels.map(r=>r.text),names=labels.filter(value=>englishNames.includes(value));
  if(names.length!==1||names[0]!==englishNames[house])errors.push('English confirmation picked wrong/ambiguous house name for '+resource+': '+names.join(','));
  if(!labels.includes('Yes')||!labels.includes('No'))errors.push('English confirmation lost Yes/No for '+resource);
  if(!diagnostic.media.last?.drawn||diagnostic.media.last?.resource!==resource)errors.push('English confirmation lost exact homeworld '+resource);
  if(diagnostic.textFit.violations)errors.push('English confirmation overflow '+resource);
  englishConfirmationResults.push({house,resource,expectedHouseName:englishNames[house],names,fitViolations:diagnostic.textFit.violations});
 }
'''

def template():
    text=ADVISOR.TEMPLATE
    text=text.replace("import {createPaintedUI} from './painted-ui.mjs';", "import {createPaintedUI} from './painted-ui.mjs';\nimport {decodeNativeText,decodeNativeCharacter} from './native-text.mjs';")
    text=text.replace('fonts=__FONTS__,sourceHashes=__HASHES__','fonts=__FONTS__,locale=__LOCALE__,sourceHashes=__HASHES__')
    text=text.replace('cursor=false,unknown=false,actorAdvisor=advisor','cursor=false,cursorX=210,cursorY=105,unknown=false,actorAdvisor=advisor')
    text=text.replace('x:210,y:105','x:cursorX,y:cursorY')
    text=text.replace("const source=fonts.fonts[fontName],colours=", "const nativeBytes=encodeNative(value);\n  const source=fonts.fonts[fontName],colours=")
    text=text.replace('serial,text:value,x,y,width:0','serial,text:decodeNativeText(nativeBytes,locale.encoding),textBytes:[...nativeBytes],x,y,width:0')
    text=text.replace('for(let i=0;i<value.length;i++){\n   const char=value.charCodeAt(i)', 'for(let i=0;i<nativeBytes.length;i++){\n   const char=nativeBytes[i]')
    text=text.replace("[['Our House needs a strong base on Arrakis.',1],['Build facilities and secure the spice fields.',12],['The spice must flow. We depend on you.',23]]", "[['Žluťoučký kůň úpěl ďábelské ódy.',1],['ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ áčďéěíňóřšťúůýž',12],['Těžte koření. Chraňte stavební dvůr.',23]]")
    text=text.replace("textLine('Select Subject:'", "textLine('Vyberte téma:'")
    text=text.replace("[['Briefing',64],['Advice',72],['Orders',80],['House Atreides',96],['House Harkonnen',104],['House Ordos',112],['Construction Yard',136]]", "[['Hlášení',64],['Rady',72],['Rozkazy',80],['Rod Atreidů',96],['Rod Harkonnenů',104],['Rod Ordosů',112],['Stavební dvůr',136]]")
    text=text.replace('try{\n const[native,chrome]', EXTRA_HELPERS+'\ntry{\n const[native,chrome]',1)
    credits=CREDITS.TEMPLATE
    helpers=credits[credits.index('const safe='):credits.index('\ntry{')]
    helpers=helpers.replace('let serial=0;','').replace('function makeFrame(', 'function makeCreditFrame(').replace('function compare(', 'function compareCredit(')
    text=text.replace(EXTRA_HELPERS,EXTRA_HELPERS+'\n'+helpers,1)
    marker=" const ui=await createPaintedUI({sourceFrames}),atlases=new Map();"
    assert marker in text
    text=text.replace(marker," for(const[id,row]of Object.entries(locale.uiFrames))sourceFrames.ui[id]=prepareFrameDescriptor({...native.frames.ui[id],...row});\n for(const[name,patch]of Object.entries(locale.scenes))if(chrome.scenes[name])chrome.scenes[name]={...chrome.scenes[name],...patch};\n const ui=await createPaintedUI({sourceFrames,locale}),atlases=new Map();")
    start=text.index(' const cases=[];');end=text.index(' const canvas=surface()',start)
    text=text[:start]+r'''
 const cases=[];for(const resource of ['WIN1.WSA','WIN2.WSA','LOSTBILD.WSA','LOSTVEHC.WSA'])for(const advisor of ['a','h','o'])cases.push({name:advisor+' český výsledek '+resource,advisor,mode:'briefing',pose:2,resource,phase:0,gallery:true});
 for(const[house,resource]of [[0,'FHARK.WSA'],[1,'FARTR.WSA'],[2,'FORDOS.WSA']])cases.push({name:'České potvrzení rodu '+house,advisor:'m',mode:'confirmation',house,resource,phase:0,pose:2,gallery:true});
 for(const advisor of ['a','h','o'])cases.push({name:advisor+' česká nápověda',advisor,mode:'help',pose:2,gallery:false});
''' +text[end:]
    marker='  if(spec.unknown){'
    text=text.replace(marker,r'''
  row.literalNativeRuns=frame.textRuns.map(run=>({text:run.text,bytes:run.textBytes}));
  for(const run of frame.textRuns)if(decodeNativeText(run.textBytes,locale.encoding)!==run.text)errors.push(spec.name+': CP1250 whole run mismatch');
  const expectedButtons=spec.mode==='confirmation'?['Ano','Ne']:spec.mode==='briefing'?[locale.bitmapLabels[379],locale.bitmapLabels[381]]:[];
  row.labels=diagnostic.textFit.labels.map(label=>label.text);
  for(const value of expectedButtons)if(!row.labels.includes(value))errors.push(spec.name+': Czech semantic caption missing '+value);
  if(spec.mode==='confirmation'){
   const names=['Harkonnenů?','Atreidů?','Ordosů?'],actualNames=row.labels.filter(value=>names.includes(value));row.expectedHouseName=names[spec.house];row.actualHouseNames=actualNames;
   if(actualNames.length!==1||actualNames[0]!==names[spec.house])errors.push(spec.name+': Czech confirmation picked wrong/ambiguous house name '+actualNames.join(','));
  }
''' +marker,1)
    text=text.replace(' const output={pass:',EXTRA_CASES+'\n const output={pass:',1)
    text=text.replace('wholeUI:true,coverage:',"wholeUI:true,locale:locale.locale,encoding:locale.encoding,cursorResults,menu:{labels:menuLabels,fitViolations:menuDiagnostic.textFit.violations},creditResults,houseChoiceResults,englishConfirmationResults,coverage:")
    text=text.replace('coverage:{advisorResources:4,briefingPoses:20,helpScreens:4,houseConfirmations:9,unknownBaseCases:1,crossAdvisorCases:1,cases:results.length}', 'coverage:{advisorResources:4,czechOutcomeCompositions:12,czechConfirmations:3,englishConfirmations:3,compactHelpScreens:3,diacriticSets:2,cursorPositions:4,nativeOptionsWindows:1,creditCases:creditResults.length,englishAndCzechHouseChoices:2,cases:results.length}')
    text=text.replace('<title>Whole advisor composition QA</title>','<title>České rozhraní — písmo a složení</title>')
    text=text.replace('<h1>Whole advisor composition</h1>','<h1>České rozhraní — písmo a složení</h1>')
    return text

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    locale=json.loads((ROOT/'dist/locales/cs.json').read_text());assert locale['complete'] and locale['encoding']=='windows-1250'
    fixtures={};wanted={'WIN1.WSA','WIN2.WSA','LOSTBILD.WSA','LOSTVEHC.WSA','FARTR.WSA','FHARK.WSA','FORDOS.WSA'}
    for folder in ['extra-motion','outcome-motion']:
        source=ROOT/'art/hd-v3/media'/folder
        for row in json.loads((source/'inventory.json').read_text())['resources']:
            if row['resource'] not in wanted:continue
            frame=row['frames'][0];raw=(source/frame['indexFile']).read_bytes();assert hashlib.sha256(raw).hexdigest()==frame['pixelSha256']
            fixtures[row['resource']+':0']=base64.b64encode(raw).decode()
    assert len(fixtures)==7
    names=['dist/locales/cs.json','dist/painted-ui.mjs','dist/painted-ui-core.mjs','dist/painted-scenes.mjs','dist/painted-credits.mjs','dist/native-text.mjs','dist/painted-typography.mjs','dist/painted-font-data.mjs','dist/painted-title-data.mjs','dist/painted/native.json','dist/painted/interface.json','dist/painted/icons.json','dist/painted/media.json','fidelity/painted-polish/advisor-canvas-review.py','fidelity/painted-polish/credits-canvas-review.py','fidelity/painted-polish/locale-canvas-review.py','native/opendune/src/table/windowdesc.c','native/opendune/src/gui/widget.c']
    hashes={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest()for name in names}
    destination=args.output.resolve();assert destination.parent==(ROOT/'dist').resolve()
    destination.write_text(template().replace('__FIXTURES__',json.dumps(fixtures,separators=(',',':'))).replace('__FONTS__',json.dumps({'fonts':locale['fonts']},separators=(',',':'))).replace('__LOCALE__',json.dumps(locale,separators=(',',':'))).replace('__HASHES__',json.dumps(hashes)))
    print(json.dumps(dict(output=str(destination),locale='cs',wholeAdvisorCases=18,englishConfirmations=3,nativeCounterCases=162,cursorCases=4,optionsWindows=1,englishAndCzechHouseChoices=2,executesDos=False,launchesServer=False)))

if __name__=='__main__':main()
