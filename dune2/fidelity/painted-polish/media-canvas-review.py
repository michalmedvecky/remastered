#!/usr/bin/env python3
"""Write an inert canvas QA HTML fixture for the existing restricted preview server.
Example: python3 fidelity/painted-polish/media-canvas-review.py --output dist/media-qa.html
Open the resulting /dune2/media-qa.html in an owned private browser tab, inspect
body.dataset.done and #result, capture evidence, then remove the temporary HTML.
No server or original DOS binary is launched by this helper.
"""
from pathlib import Path
import argparse,base64,hashlib,json
ROOT=Path(__file__).resolve().parents[2]
TEMPLATE='''<!doctype html><meta charset=utf-8>
<style>body{margin:0;background:#15191c;color:#eee;font:14px sans-serif}#gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}figure{margin:0}canvas{display:block;width:100%;height:auto}figcaption{height:24px;line-height:24px}#result{display:none}</style>
<div id=gallery></div><pre id=result>pending</pre><script type=module>
import {createPaintedMedia} from './painted-media.mjs';
const fixtures=__NATIVE_FIXTURES__,manifestSHA256=__MANIFEST_SHA256__;
const nativeFrame=(name,index)=>{
 const key=(name.toUpperCase().endsWith('.WSA')?name.toUpperCase():name.toUpperCase()+'.WSA')+':'+index;
 if(!fixtures[key])throw Error('Missing verified native fixture '+key);
 const raw=Uint8Array.from(atob(fixtures[key]),c=>c.charCodeAt(0)),pixels=new Uint8Array(64000);
 for(let y=0;y<112;y++)pixels.set(raw.subarray(y*184,(y+1)*184),(48+y)*320+128);
 return{pixels,worldVisible:false};
};
const surface=(w=1280,h=800)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const check=(ok,message)=>{if(!ok)throw Error(message);};
try{
 const media=await createPaintedMedia(),manifest=media.manifest;
 check(Object.keys(manifest.resources).length===42&&manifest.motion.frames.length===264&&manifest.motion.coordinates.length===33,'Active42 manifest coverage');
 const cases=[['barrac',0],['barrac',1],['headqrts',5],['carryall',0],['carryall',1],['palace',10],['windtrap',0],['windtrap',5],['starport',16],['harvest',9],['gold-bb',3],['liteftry',2],['fartr',15],['fhark',20],['fordos',10],['fremen',1],['worm',0],['sardukar',7]],results=[];
 for(const[name,index]of cases){
  const f=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=surface(736,448);
  caption.textContent=name+' native frame '+index;f.append(caption,canvas);gallery.append(f);
  const c=canvas.getContext('2d');c.translate(-512,-192);
  const rendered=media.draw(c,nativeFrame(name,index),{scene:'mentat'});check(rendered.drawn,'Gallery phase '+name+':'+index);results.push(rendered);
 }
 const allCanvas=surface(),ac=allCanvas.getContext('2d',{willReadFrequently:true});
 let framesRendered=0,factoryFrames=0,bakedFramesCompared=0,bakedReverseCompared=0;
 const images=new Map();
 await Promise.all(Object.entries(manifest.atlases).filter(([id])=>id.startsWith('extra')).map(async([id,row])=>{
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=new URL(row.src,location.href);});images.set(id,image);
 }));
 const expected=surface(736,448),ec=expected.getContext('2d',{willReadFrequently:true});
 const compareBaked=(name,row,index)=>{
  // Independent expected composition: new base plus precisely one new RGBA
  // patch. Compare actual Canvas pixels, including the static area outside it.
  ec.clearRect(0,0,736,448);const base=row.frames[0];ec.drawImage(images.get(base.atlas),...base.rect,0,0,736,448);
  if(index){const p=row.frames[index];ec.drawImage(images.get(p.atlas),...p.rect,...p.nativeRect.map(v=>v*4));}
  const actual=ac.getImageData(512,192,736,448).data,want=ec.getImageData(0,0,736,448).data;
  for(let i=0;i<actual.length;i++)if(actual[i]!==want[i])throw Error('Baked Canvas byte mismatch '+name+':'+index+' byte '+i);
 };
 for(const[name,row]of Object.entries(manifest.resources)){
  for(let index=0;index<row.frameCount;index++){
   ac.clearRect(0,0,1280,800);const rendered=media.draw(ac,nativeFrame(name,index),{scene:'mentat'});
   check(rendered.drawn&&!rendered.missingMotionAssets.length&&rendered.resource===name&&rendered.samples===33,'Missing actual Canvas phase '+name+':'+index);framesRendered++;
   if(row.renderMode==='painted-frame-sequence'){compareBaked(name,row,index);bakedFramesCompared++;}
  }
  const factory=media.draw(ac,nativeFrame(name,0),{scene:'factory'});
  check(factory.drawn&&factory.resource===name&&factory.frame===0,'Factory base '+name);factoryFrames++;
  if(row.renderMode==='painted-frame-sequence')for(let index=row.frameCount-1;index>=0;index--){
   media.draw(ac,nativeFrame(name,index),{scene:'mentat'});compareBaked(name,row,index);bakedReverseCompared++;
  }
 }
 check(framesRendered===264&&factoryFrames===42&&bakedFramesCompared===103&&bakedReverseCompared===103,'Canvas coverage counts');
 result.textContent=JSON.stringify({manifestSHA256,results,allFrameCanvasCoverage:{resources:42,framesRendered,witnessCoordinates:33,factoryFrames,bakedFramesCompared,bakedReverseCompared,missingAssets:0,errors:0},diagnostics:media.diagnostics()});
}catch(error){result.textContent=JSON.stringify({error:String(error),stack:error.stack});document.body.dataset.error='true';}
document.body.dataset.done='true';
</script>'''

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--output',type=Path,required=True)
 args=parser.parse_args()
 frames={}
 resources=set()
 for folder,expected in [('motion',161),('extra-motion',103)]:
  source=ROOT/'art/hd-v3/media'/folder
  inventory=json.loads((source/'inventory.json').read_text())
  count=0
  for row in inventory['resources']:
   assert row['resource'] not in resources,'Duplicate source resource'
   resources.add(row['resource'])
   for frame in row['frames']:
    raw=(source/frame['indexFile']).read_bytes()
    assert len(raw)==184*112
    assert hashlib.sha256(raw).hexdigest()==frame['pixelSha256']
    frames[row['resource']+':'+str(frame['frame'])]=base64.b64encode(raw).decode()
    count+=1
  assert count==expected
 assert len(frames)==264 and len(resources)==42
 manifest_sha=hashlib.sha256((ROOT/'dist/painted/media.json').read_bytes()).hexdigest()
 destination=args.output.resolve()
 assert destination.parent==(ROOT/'dist').resolve(),'Temporary fixture must be directly inside dune2/dist'
 destination.write_text(TEMPLATE.replace('__NATIVE_FIXTURES__',json.dumps(frames,separators=(',',':'))).replace('__MANIFEST_SHA256__',json.dumps(manifest_sha)))
 print(json.dumps({'output':str(destination),'resources':42,'nativeFrames':264,'manifestSHA256':manifest_sha,'launchesServer':False,'executesDos':False}))
if __name__=='__main__':main()
