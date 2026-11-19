#!/usr/bin/env python3
"""Generate a source-bound full-advisor Canvas integration review page.

Run from dune2:
  python3 fidelity/painted-polish/advisor-canvas-review.py --output dist/advisor-qa.html

Serve through the existing restricted preview, open the temporary page in an
owned browser tab, read #result/body.dataset.done, save a screenshot, and remove
the temporary HTML. This helper runs no server, WASM, DOS executable or emulator.
"""
from pathlib import Path
import argparse, base64, hashlib, json

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = r'''<!doctype html><meta charset=utf-8><title>Whole advisor composition QA</title>
<style>body{margin:0;background:#101820;color:#eee;font:14px sans-serif}h1,p{margin:12px}#gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}figure{margin:0}canvas{display:block;width:100%;height:auto}figcaption{padding:4px}#result{display:none}</style>
<h1>Whole advisor composition</h1><p id=status>Loading verified source fixtures and production artwork…</p><div id=gallery></div><pre id=result>pending</pre>
<script type=module>
import {createPaintedUI} from './painted-ui.mjs';
import {prepareFrameDescriptor,stampNativeSprite,mappedIndex,toRgba} from './hd-core.mjs';
const fixtures=__FIXTURES__,fonts=__FONTS__,sourceHashes=__HASHES__;
const statusElement=document.getElementById('status'),galleryElement=document.getElementById('gallery'),resultElement=document.getElementById('result');
const surface=(w=1280,h=800)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const json=async name=>{const response=await fetch('./painted/'+name+'.json');if(!response.ok)throw Error('Missing '+name);return response.json();};
const sourceAtlas=async src=>{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='./'+src;});return image;};
const check=(ok,message)=>{if(!ok)throw Error(message);};
const regions={hair:[28,48,80,24],body:[4,148,60,48],leftWall:[2,40,12,96]};
const fullClip=[0,0,320,200],poses={h:387,a:402,o:417,m:462};
const houseIDs={h:0,a:1,o:2,m:5};
let serial=0;
function makeFrame(chrome,sourceFrames,{advisor,mode,pose=0,resource=null,phase=0,house=null,cursor=false,unknown=false,actorAdvisor=advisor}){
 const scene=chrome.scenes['MENTAT'+advisor.toUpperCase()+'.CPS'],pixels=bytes(scene.indicesBase64);
 const palette=bytes(scene.palette6Base64),owners=new Int32Array(64000).fill(-1),records=[],runs=[];
 const put=(x,y,index,record)=>{if(x>=0&&x<320&&y>=0&&y<200){pixels[y*320+x]=index;owners[y*320+x]=record;}};
 for(let y=48;y<160;y++)pixels.fill(233,y*320+128,y*320+312);
 if(unknown)for(let y=24;y<200;y++)for(let x=0;x<128;x++)pixels[y*320+x]=12;
 const wsa=resource&&bytes(fixtures[resource+':'+phase]);
 if(resource&&!wsa)throw Error('Missing source phase '+resource+':'+phase);
 if(wsa)for(let y=0;y<112;y++)pixels.set(wsa.subarray(y*184,(y+1)*184),(48+y)*320+128);
 if(mode==='confirmation'){
  const misc=bytes(chrome.scenes['MISC.ENG'].indicesBase64);
  for(let y=0;y<24;y++){pixels.set(misc.subarray(y*320,y*320+208),y*320);pixels.set(misc.subarray((24*(house+1)+y)*320,(24*(house+1)+y)*320+104),y*320+208);}
 }
 function sprite(id,x,y){
  const desc=sourceFrames.ui[id],record=records.length,command={id,x,y,width:desc.sourceW,height:desc.sourceH,flags:0,screen:0,clip:fullClip.slice(),nativeClip:fullClip.slice(),serial:++serial,sourceSerial:serial,house:houseIDs[advisor],palette:null,ink:[],totalInk:0};
  records.push({kind:'sprite',command});stampNativeSprite(pixels,desc,command);
  for(let yy=0;yy<desc.sourceH;yy++)for(let xx=0;xx<desc.sourceW;xx++){const at=yy*desc.sourceW+xx;if(desc.mask[at]){command.totalInk++;put(x+xx,y+yy,mappedIndex(desc,desc.indices[at],command),record);}}
 }
 const p=chrome.frames['advisor-'+actorAdvisor].nativePatches,first=poses[actorAdvisor];
 sprite(first+pose,...p.eyes.slice(0,2));sprite(first+5+(4-pose),...p.mouth.slice(0,2));
 if(p.shoulder)sprite(first+10,...p.shoulder.slice(0,2));
 const other=p.book??p.ring;if(other)sprite(first+11+pose%4,...other.slice(0,2));
 if(mode==='confirmation'){sprite(373,168,168);sprite(375,240,168);}
 else if(mode==='briefing'){sprite(379,168,168);sprite(381,240,168);}
 else sprite(377,200,168);
 function textLine(value,x,y,{fontName='NEW8P.FNT',font=2,offset=-1,colour=15,shadow=true}={}){
  const source=fonts.fonts[fontName],colours=[0,colour,shadow?12:0,shadow?12:0,...Array(12).fill(0)],glyphs=[],run={runId:++serial,sourceSerial:serial,serial,text:value,x,y,width:0,height:source.height,fontHeight:source.height,font,colours,visibleInk:0,totalInk:0,ink:[],glyphs,clips:[],clip:null};
  for(let i=0;i<value.length;i++){
   const char=value.charCodeAt(i),g=source.chars[char],data=bytes(g.nibblesBase64),glyph={char,x,y,width:g.width,height:source.height,fontHeight:source.height,font,advance:g.width+offset,index:i,serial:run.serial+i/4294967296,sourceSerial:run.serial+i,colours,visibleInk:0,totalInk:0,ink:[],clip:null},record=records.length;
   records.push({kind:'glyph',glyph,run});glyphs.push(glyph);
   for(let yy=0;yy<g.usedLines;yy++)for(let xx=0;xx<g.width;xx++){const index=colours[data[yy*g.width+xx]];if(index){glyph.totalInk++;put(x+xx,y+g.unusedLines+yy,index,record);}}
   run.width=Math.max(run.width,x+g.width-run.x);x+=glyph.advance;
  }
  run.clip=[run.x,run.y,run.width,run.height];run.clips=[run.clip.slice()];runs.push(run);
 }
 if(mode==='briefing'){
  for(const[line,y]of [['Our House needs a strong base on Arrakis.',1],['Build facilities and secure the spice fields.',12],['The spice must flow. We depend on you.',23]])textLine(line,4,y);
 }else if(mode==='help'){
  textLine('Select Subject:',144,50,{offset:-2,shadow:false,colour:12});
  for(const[line,y]of [['Briefing',64],['Advice',72],['Orders',80],['House Atreides',96],['House Harkonnen',104],['House Ordos',112],['Construction Yard',136]])textLine(line,144,y,{fontName:'NEW6P.FNT',font:1,offset:-2,shadow:false});
 }
 for(let at=0;at<64000;at++){const index=owners[at];if(index<0)continue;const r=records[index],x=at%320,y=Math.floor(at/320),item=r.command??r.glyph;item.ink.push([x-item.x,y-item.y,pixels[at]]);}
 const uiCommands=[],textGlyphs=[];
 for(const record of records){
  const item=record.command??record.glyph;item.visibleInk=item.ink.length;
  if(!item.visibleInk)continue;
  const xs=item.ink.map(p=>p[0]),ys=item.ink.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys);item.clip=[item.x+x0,item.y+y0,Math.max(...xs)-x0+1,Math.max(...ys)-y0+1];
  if(record.command)uiCommands.push(item);
  else{const run=record.run;run.visibleInk+=item.visibleInk;run.totalInk+=item.totalInk;for(const[x,y,index]of item.ink)run.ink.push([item.x+x-run.x,item.y+y-run.y,index]);textGlyphs.push(item);}
 }
 const uiPixels=pixels.slice(),pointer={id:0,visible:cursor,x:210,y:105,hotX:0,hotY:0};
 if(cursor){const desc=sourceFrames.ui[0];stampNativeSprite(pixels,desc,{x:210,y:105,width:desc.sourceW,height:desc.sourceH,flags:0,clip:fullClip});}
 return{version:2,pixels,uiPixels,palette,worldVisible:false,worldAvailable:false,playerHouse:houseIDs[advisor],uiCommands,textGlyphs,textRuns:runs.filter(r=>r.visibleInk),borders:[],cursor:pointer};
}
function compareRegion(actual,expected,rect){
 const[x,y,w,h]=rect.map(v=>v*4);let different=0,maximum=0;
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const p=(yy*1280+xx)*4;for(let c=0;c<4;c++){const delta=Math.abs(actual[p+c]-expected[p+c]);if(delta){different++;maximum=Math.max(maximum,delta);}}}
 return{differentBytes:different,maxChannelDifference:maximum,pixels:w*h};
}
try{
 const[native,chrome]=await Promise.all([json('native'),json('interface')]),sourceFrames={tiles:{},units:{},ui:{}};
 for(const kind of Object.keys(sourceFrames))for(const[id,row]of Object.entries(native.frames[kind]))sourceFrames[kind][id]=prepareFrameDescriptor(row);
 const ui=await createPaintedUI({sourceFrames}),atlases=new Map();await Promise.all(Object.entries(chrome.atlases).map(async([id,row])=>atlases.set(id,await sourceAtlas(row.src))));
 const expectedBases=new Map();for(const h of ['h','a','o','m']){const f=chrome.frames['advisor-'+h],c=surface(),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(atlases.get(f.atlas),...f.rect,0,0,1280,800);expectedBases.set(h,x.getImageData(0,0,1280,800).data);}
 const cases=[];for(const advisor of ['h','a','o','m']){
  for(let pose=0;pose<5;pose++)cases.push({name:advisor+' briefing pose'+pose,advisor,mode:'briefing',pose,resource:'HEADQRTS.WSA',phase:0,gallery:pose===2});
  cases.push({name:advisor+' help',advisor,mode:'help',pose:0,gallery:advisor==='m'});
 }
 for(const[house,resource]of [[0,'FHARK.WSA'],[1,'FARTR.WSA'],[2,'FORDOS.WSA']])for(const phase of [0,15,29])cases.push({name:'Mercenary confirms house'+house+' phase'+phase,advisor:'m',mode:'confirmation',house,resource,phase,pose:phase%5,cursor:phase===15,gallery:phase===15});
 cases.push({name:'stale Harkonnen actor on Atreides base',advisor:'a',actorAdvisor:'h',mode:'fallback',pose:2,gallery:true});
 cases.push({name:'unknown base retains native actor',advisor:'a',mode:'fallback',pose:2,unknown:true});
 const canvas=surface(),ctx=canvas.getContext('2d',{willReadFrequently:true}),image=ctx.createImageData(320,200),nativeCanvas=surface(320,200),nc=nativeCanvas.getContext('2d'),results=[],errors=[];
 for(const spec of cases){
  const frame=makeFrame(chrome,sourceFrames,spec);toRgba(frame.uiPixels,frame.palette,image.data);nc.putImageData(image,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(nativeCanvas,0,0,1280,800);ui.draw(ctx,frame);
  const diagnostic=ui.diagnostics(),actual=ctx.getImageData(0,0,1280,800).data,expected=expectedBases.get(spec.advisor),scene='MENTAT'+spec.advisor.toUpperCase()+'.CPS';
  const row={name:spec.name,scene:diagnostic.scene,expectedScene:spec.unknown?'native':scene,fitViolations:diagnostic.textFit.violations,body:{},media:spec.resource?{resource:diagnostic.media.last?.resource,frame:diagnostic.media.last?.frame,drawn:diagnostic.media.last?.drawn}:null};
  if(spec.unknown){
   const unchanged=surface(),uc=unchanged.getContext('2d',{willReadFrequently:true});uc.imageSmoothingEnabled=false;uc.drawImage(nativeCanvas,0,0,1280,800);const raw=uc.getImageData(0,0,1280,800).data;
   const patches=chrome.frames['advisor-a'].nativePatches;for(const[name,rect]of Object.entries(patches))if(Array.isArray(rect))row.body[name]=compareRegion(actual,raw,rect);
  }else if(spec.actorAdvisor){for(const[name,rect]of Object.entries(chrome.frames['advisor-'+spec.actorAdvisor].nativePatches))if(Array.isArray(rect))row.body[name]=compareRegion(actual,expected,rect);}
  else for(const[name,rect]of Object.entries(regions))row.body[name]=compareRegion(actual,expected,rect);
  if(row.scene!==row.expectedScene)errors.push(spec.name+': scene '+row.scene+' != '+row.expectedScene);
  for(const[name,comparison]of Object.entries(row.body))if(comparison.differentBytes)errors.push(spec.name+': partial/mixed '+name+' '+comparison.differentBytes+' differing bytes');
  if(spec.resource&&(!row.media?.drawn||row.media.resource!==spec.resource||row.media.frame!==spec.phase))errors.push(spec.name+': full UI media phase not matched');
  if(row.fitViolations)errors.push(spec.name+': text overflow');
  results.push(row);
  if(spec.gallery){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),copy=surface();caption.textContent=spec.name+' — '+row.scene;copy.getContext('2d').drawImage(canvas,0,0);figure.append(caption,copy);galleryElement.append(figure);}
 }
 const output={pass:errors.length===0,sourceHashes,executesDos:false,wholeUI:true,coverage:{advisorResources:4,briefingPoses:20,helpScreens:4,houseConfirmations:9,unknownBaseCases:1,crossAdvisorCases:1,cases:results.length},results,errors};
 resultElement.textContent=JSON.stringify(output);statusElement.textContent=output.pass?'PASS: whole bases, native poses, text and previews compose coherently.':'FAIL: '+errors.length+' composition errors';document.body.dataset.pass=String(output.pass);
}catch(error){resultElement.textContent=JSON.stringify({pass:false,error:String(error),stack:error.stack});document.body.dataset.error='true';statusElement.textContent='Fixture failed';}
document.body.dataset.done='true';
</script>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    frames = {}
    wanted = {'HEADQRTS.WSA': {0}, 'FARTR.WSA': {0, 15, 29}, 'FHARK.WSA': {0, 15, 29}, 'FORDOS.WSA': {0, 15, 29}}
    for folder in ['motion', 'extra-motion']:
        source = ROOT / 'art/hd-v3/media' / folder
        inventory = json.loads((source / 'inventory.json').read_text())
        for row in inventory['resources']:
            if row['resource'] not in wanted:
                continue
            for frame in row['frames']:
                if frame['frame'] not in wanted[row['resource']]:
                    continue
                raw = (source / frame['indexFile']).read_bytes()
                assert len(raw) == 184 * 112
                assert hashlib.sha256(raw).hexdigest() == frame['pixelSha256']
                frames[row['resource'] + ':' + str(frame['frame'])] = base64.b64encode(raw).decode()
    assert len(frames) == 10
    font_path = ROOT / 'art/hd-v3/icons/fonts.json'
    fonts = json.loads(font_path.read_text())
    fonts['fonts'] = {k: v for k, v in fonts['fonts'].items() if k in ['NEW6P.FNT', 'NEW8P.FNT']}
    hashes = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in ['dist/painted/native.json', 'dist/painted/interface.json', 'dist/painted/icons.json', 'dist/painted/media.json', 'art/hd-v3/icons/fonts.json']}
    destination = args.output.resolve()
    assert destination.parent == (ROOT / 'dist').resolve(), 'Temporary fixture must be directly inside dune2/dist'
    destination.write_text(TEMPLATE.replace('__FIXTURES__', json.dumps(frames, separators=(',', ':'))).replace('__FONTS__', json.dumps(fonts, separators=(',', ':'))).replace('__HASHES__', json.dumps(hashes)))
    print(json.dumps({'output': str(destination), 'nativeMediaFrames': len(frames), 'wholeAdvisorCases': 35, 'executesDos': False, 'launchesServer': False}))


if __name__ == '__main__':
    main()
