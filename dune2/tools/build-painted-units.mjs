// Deterministic packing of newly painted native Dune world sprites. GPL-2.0-only.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodePNG,encodePNG,alphaBounds} from './painted-png.mjs';
const root=new URL('../',import.meta.url),art=new URL('art/hd-v2/units/',root),dist=new URL('dist/painted/',root);
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFile(new URL(p,art));
const exists=async p=>{try{await fs.stat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const inventory=JSON.parse(await read('inventory.json')),groups=JSON.parse(await read('groups.json'));
const neutralTurrets=new Set([116,117,118,119,120,126,127,128,129,130,141,142,143,144,145,146,147,148,149,150]);
await fs.mkdir(dist,{recursive:true});await fs.mkdir(new URL('packed/',art),{recursive:true});

function gridCuts(image,axis,count){
 const length=axis==='x'?image.width:image.height,projection=new Uint32Array(length);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.pixels[(y*image.width+x)*4+3]>=128)projection[axis==='x'?x:y]++;
 const runs=[];let start=null;
 for(let i=0;i<=length;i++){if(projection[i]&&start===null)start=i;if(!projection[i]&&start!==null){runs.push([start,i]);start=null;}}
 const merged=[],smallGap=Math.max(6,Math.floor(length/count/10));
 for(const run of runs){const last=merged.at(-1);if(last&&run[0]-last[1]<=smallGap)last[1]=run[1];else merged.push(run.slice());}
 if(merged.length===count)return{cuts:[0,...merged.slice(0,-1).map((r,i)=>Math.floor((r[1]+merged[i+1][0])/2)),length],method:'transparent-gutter projection',runs:merged};
 return{cuts:Array.from({length:count+1},(_,i)=>Math.floor(i*length/count)),method:'equal-grid fallback',runs:merged};
}

function extract(image,rect){
 const [rx,ry,rw,rh]=rect,w=image.width,pixels=image.pixels.slice(),seen=new Uint8Array(image.width*image.height),queue=new Int32Array(rw*rh),components=[];
 let cleared=0;
 for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++){const p=(y*w+x)*4;if(pixels[p+3]<=8){if(pixels[p+3])cleared++;pixels.fill(0,p,p+4);}}
 // Identify real painted ink above the residual segmentation haze, retaining
 // multiple people/particles rather than assuming one connected component.
 for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++){
  const start=y*w+x;if(seen[start]||pixels[start*4+3]<24)continue;
  let head=0,tail=1,left=x,top=y,right=x+1,bottom=y+1;queue[0]=start;seen[start]=1;
  while(head<tail){const p=queue[head++],xx=p%w,yy=Math.floor(p/w);left=Math.min(left,xx);top=Math.min(top,yy);right=Math.max(right,xx+1);bottom=Math.max(bottom,yy+1);
   for(const n of [xx>rx?p-1:-1,xx<rx+rw-1?p+1:-1,yy>ry?p-w:-1,yy<ry+rh-1?p+w:-1])if(n>=0&&!seen[n]&&pixels[n*4+3]>=24){seen[n]=1;queue[tail++]=n;}
  }
  components.push({area:tail,bounds:[left,top,right-left,bottom-top]});
 }
 components.sort((a,b)=>b.area-a.area);if(!components.length)return null;
 const minimum=Math.max(4,Math.floor(components[0].area*.0005)),kept=components.filter(c=>c.area>=minimum);
 let left=rx+rw,top=ry+rh,right=rx,bottom=ry;
 for(const c of kept){const [x,y,cw,ch]=c.bounds;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+cw);bottom=Math.max(bottom,y+ch);}
 // One source-pixel fringe keeps true antialiasing at the outer contour. It is
 // not a native-pixel mask: interiors retain the entire newly drawn RGBA image.
 left=Math.max(rx,left-1);top=Math.max(ry,top-1);right=Math.min(rx+rw,right+1);bottom=Math.min(ry+rh,bottom+1);
 return{image:{width:image.width,height:image.height,pixels},crop:[left,top,right-left,bottom-top],cleanup:{alphaCutoff:8,clearedPixels:cleared,componentThreshold:24,minimumComponentArea:minimum,components:components.map(c=>({...c,kept:c.area>=minimum}))},touchesSheetEdge:left===0||top===0||right===image.width||bottom===image.height};
}

function fit(image,crop,width,height,target){
 const rgba=new Uint8Array(width*height*4),[sx,sy,sw,sh]=crop,[tx,ty,tw,th]=target;
 for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
  const x0=sx+x*sw/tw,x1=sx+(x+1)*sw/tw,y0=sy+y*sh/th,y1=sy+(y+1)*sh/th;let a=0,r=0,g=0,b=0;
  for(let yy=Math.floor(y0);yy<Math.ceil(y1);yy++)for(let xx=Math.floor(x0);xx<Math.ceil(x1);xx++){
   const weight=Math.max(0,Math.min(x1,xx+1)-Math.max(x0,xx))*Math.max(0,Math.min(y1,yy+1)-Math.max(y0,yy));if(!weight)continue;
   const p=(yy*image.width+xx)*4,v=image.pixels[p+3]/255*weight;a+=v;r+=image.pixels[p]*v;g+=image.pixels[p+1]*v;b+=image.pixels[p+2]*v;
  }
  if(a){const p=((y+ty)*width+x+tx)*4;rgba[p]=Math.round(r/a);rgba[p+1]=Math.round(g/a);rgba[p+2]=Math.round(b/a);rgba[p+3]=Math.round(a/((x1-x0)*(y1-y0))*255);}
 }
 return{width,height,pixels:rgba};
}
// Global256 turret art has fixed materials, including any cool steel highlights.
// Only the native local16 Devastator family retains its painted faction collar.
function semanticBlue(image,frame){const mask=new Uint8Array(image.width*image.height);if(!neutralTurrets.has(frame.id))for(let i=0;i<mask.length;i++){const p=i*4,r=image.pixels[p],g=image.pixels[p+1],b=image.pixels[p+2];mask[i]=image.pixels[p+3]&&b>40&&b>r*1.15&&b>g*1.1?255:0;}return Buffer.from(mask).toString('base64');}
function primitive(f){
 const width=f.sourceW*4,height=f.sourceH*4,pixels=new Uint8Array(width*height*4);if(!f.sourceInk)return{width,height,pixels};
 const [ix,iy,iw,ih]=f.sourceInk.map(v=>v*4),cx=ix+iw/2,cy=iy+ih/2,rx=iw/2,ry=ih/2;
 for(let y=iy;y<iy+ih;y++)for(let x=ix;x<ix+iw;x++){
  const d=Math.sqrt(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2),p=(y*width+x)*4,alpha=Math.max(0,Math.min(1,(1-d)*Math.min(rx,ry)+.5));if(!alpha)continue;
  if(f.id===174||f.id===175){pixels[p]=255;pixels[p+1]=Math.round(210-110*Math.min(1,d));pixels[p+2]=Math.round(70*(1-Math.min(1,d)));}else pixels[p]=pixels[p+1]=pixels[p+2]=255;
  pixels[p+3]=Math.round(alpha*255);
 }
 return{width,height,pixels};
}

const rendered=new Map(),audit=[];
for(const group of groups.groups){
 const corrected=new URL('raw/'+group.id+'-corrected.png',art),ordinary=new URL('raw/'+group.id+'.png',art),path=await exists(corrected)?corrected:ordinary;if(!await exists(path))continue;
 const bytes=await fs.readFile(path),image=decodePNG(bytes),raw=path.pathname.split('/').pop();
 // Two returned transparent sheets contain a low-confidence translucent white
 // matte (corner alpha74..93). Their true painted ink is alpha~248..253. Treat
 // that segmentation confidence explicitly; never colour-key pale steel.
 const alphaConfidence=['ornithopter','mini-deathhand'].includes(group.id)?{transparentThrough:128,opaqueFrom:248,reason:'Returned model alpha includes translucent white backdrop; original raw retained'}:null;
 if(alphaConfidence)for(let p=0;p<image.pixels.length;p+=4){const a=image.pixels[p+3];if(a<=128)image.pixels.fill(0,p,p+4);else image.pixels[p+3]=Math.round(Math.min(1,(a-128)/120)*255);}
 const gx=gridCuts(image,'x',group.columns),gy=gridCuts(image,'y',group.rows);
 let untouchedDevastator=null;
 if(group.id==='turrets'&&path.href===corrected.href){const bytes=await fs.readFile(ordinary),image=decodePNG(bytes);untouchedDevastator={bytes,image,raw:ordinary.pathname.split('/').pop(),gx:gridCuts(image,'x',group.columns),gy:gridCuts(image,'y',group.rows)};}
 for(let cell=0;cell<group.ids.length;cell++){
  const id=group.ids[cell],f=inventory.frames[id],selected=untouchedDevastator&&id>=136&&id<=140?untouchedDevastator:{bytes,image,raw,gx,gy},col=cell%group.columns,row=Math.floor(cell/group.columns),x=selected.gx.cuts[col],y=selected.gy.cuts[row],right=selected.gx.cuts[col+1],bottom=selected.gy.cuts[row+1];
  const cleaned=extract(selected.image,[x,y,right-x,bottom-y]);if(!cleaned||!f.sourceInk)throw Error('Missing painted object '+group.id+' cell'+cell+' id'+id);
  const packed=fit(cleaned.image,cleaned.crop,f.sourceW*4,f.sourceH*4,f.sourceInk.map(v=>v*4));
  const evidence={group:group.id,cell,raw:'art/hd-v2/units/raw/'+selected.raw,rawSHA256:sha(selected.bytes),reference:group.reference,referenceSHA256:group.referenceSha256,alphaConfidence,grid:{x:selected.gx,y:selected.gy},crop:cleaned.crop,cleanup:cleaned.cleanup,touchesSheetEdge:cleaned.touchesSheetEdge,...(neutralTurrets.has(id)&&path.href===corrected.href?{neutralTurretCorrection:'Original global256 turret has no house-remappable palette; invented cobalt collar replaced by fixed neutral steel'}:{})};
  rendered.set(id,{image:packed,status:'painted',evidence});audit.push({id,...evidence});
 }
}

// The first atlas interpreted the south Quad as a Trike. This one-frame redraw
// restores four individual corner tires and the correct paired gun direction.
{
 const id=242,path=new URL('raw/quad-south-fix.png',art);
 if(await exists(path)){const bytes=await fs.readFile(path),image=decodePNG(bytes),f=inventory.frames[id],cleaned=extract(image,[0,0,image.width,image.height]);if(!cleaned)throw Error('Missing QuadS correction');
  rendered.set(id,{image:fit(cleaned.image,cleaned.crop,f.sourceW*4,f.sourceH*4,f.sourceInk.map(v=>v*4)),status:'painted',evidence:{group:'quad-south-four-wheel-correction',cell:0,raw:'art/hd-v2/units/raw/quad-south-fix.png',rawSHA256:sha(bytes),reference:'references/quad-south-fix.png',referenceSHA256:sha(await read('references/quad-south-fix.png')),crop:cleaned.crop,cleanup:cleaned.cleanup,correction:'Four corner tires; no erroneous centre/fifth tire'}});
 }
}

// The accepted pilot supplies the exact first three Trike facings, not aliases
// fabricated from another orientation. All original pose IDs remain distinct.
for(const [id,name]of [[243,'trike-n'],[244,'trike-ne'],[245,'trike-e']]){
 const path=new URL('pilot/'+name+'.png',art);if(!await exists(path))continue;const bytes=await fs.readFile(path),image=decodePNG(bytes),f=inventory.frames[id];
 if(image.width!==f.sourceW*4||image.height!==f.sourceH*4)throw Error('Pilot extent '+id);
 rendered.set(id,{image,status:'painted',evidence:{group:'accepted-pilot',cell:id-243,raw:'art/hd-v2/units/pilot/'+name+'.png',rawSHA256:sha(bytes),reference:f.nativePng,referenceSHA256:f.nativePngSha256,crop:[0,0,image.width,image.height],acceptedPilot:true}});
}
for(const id of groups.special){const f=inventory.frames[id];rendered.set(id,{image:primitive(f),status:f.sourceInk?'procedural-effect':'native-empty',evidence:{group:f.sourceInk?'native-distortion-or-bullet-mask':'explicit-native-empty',algorithm:f.sourceInk?'Analytic antialiased ellipse in original ink bounds; tiny bullets use warm core. Original distortion masks are not literal worm bodies.':'Original SHP contains no opaque pixels'}});}

let x=2,y=2,rowHeight=0;const placements=new Map(),atlasWidth=2048;
for(let id=111;id<=354;id++){const f=inventory.frames[id],w=f.sourceW*4,h=f.sourceH*4;if(x+w+2>atlasWidth){x=2;y+=rowHeight+4;rowHeight=0;}placements.set(id,[x,y,w,h]);x+=w+4;rowHeight=Math.max(rowHeight,h);}
const atlasHeight=y+rowHeight+2,atlasPixels=new Uint8Array(atlasWidth*atlasHeight*4),frames={};
for(let id=111;id<=354;id++){
 const record=rendered.get(id);if(!record)continue;const f=inventory.frames[id],[ax,ay,w,h]=placements.get(id),im=record.image;
 for(let yy=0;yy<h;yy++)atlasPixels.set(im.pixels.subarray(yy*w*4,(yy+1)*w*4),((ay+yy)*atlasWidth+ax)*4);
 const png=encodePNG(w,h,im.pixels);await fs.writeFile(new URL('packed/'+id+'.png',art),png);
 frames[id]={atlas:'units0',rect:[ax,ay,w,h],sourceW:f.sourceW,sourceH:f.sourceH,pivot:f.pivot,sourceInk:f.sourceInk,sourceSHA256:f.sourceSHA256,sourceResource:f.sourceResource,sourceFrame:f.sourceFrame,paletteMode:f.paletteMode,sourcePalette:f.sourcePalette,sourceIndicesBase64:f.sourceIndicesBase64,sourceMaskBase64:f.sourceMaskBase64,factionMask:neutralTurrets.has(id)?'neutral-fixed-steel':'semantic-blue',factionMaskBase64:semanticBlue(im,f),status:record.status,outputSha256:sha(png),evidence:record.evidence};
}
const png=encodePNG(atlasWidth,atlasHeight,atlasPixels),digest=sha(png),filename='units0-'+digest.slice(0,16)+'.png';await fs.writeFile(new URL(filename,dist),png);
const missing=Array.from({length:244},(_,i)=>i+111).filter(id=>!frames[id]),statuses={};for(const f of Object.values(frames))statuses[f.status]=(statuses[f.status]??0)+1;
const source=await fs.readFile(new URL('native/opendune/src/table/unitinfo.c',root),'utf8'),starts=[...source.matchAll(/\{ \/\* (\d+) \*\/\s*\{ \/\* objectInfo \*\//g)],unitBindings=starts.map((m,i)=>{const block=source.slice(m.index,starts[i+1]?.index??source.length),value=name=>block.match(new RegExp('/\\* '+name+'\\s*\\*/\\s*([^,\\n]+)'))?.[1]?.trim();return{type:Number(m[1]),name:value('name')?.replace(/^"|"$/g,''),groundSpriteID:Number(value('groundSpriteID')),turretSpriteID:Number(value('turretSpriteID')),destroyedSpriteID:Number(value('destroyedSpriteID')),displayMode:value('displayMode'),movementType:value('movementType')};});
const manifest={schema:1,scale:4,source:inventory.source,atlases:{units0:{src:'painted/'+filename,width:atlasWidth,height:atlasHeight,sha256:digest,bytes:png.length}},frames,unitBindings,coverage:{expected:244,available:Object.keys(frames).length,complete:missing.length===0,missing,statuses,nativeUnitTypes:unitBindings.length},semantics:{art:'Whole newly painted RGBA drawings fitted to native ink extents; no original colour or silhouette mosaic',turrets:'Independent native turret IDs remain separate from all hulls',factionMask:'Semantic cobalt-blue pixels in actual painted RGBA; mask at full4x resolution',nativeEmpty:'Explicit zero-ink original frames, not failed decompilations or missing art',specialMasks:'Native Sonic/Sandworm distortion masks and tiny bullets are analytic effect shapes, not generic unit placeholders'}};
await fs.writeFile(new URL('units.json.tmp',dist),JSON.stringify(manifest,null,2)+'\n');await fs.rename(new URL('units.json.tmp',dist),new URL('units.json',dist));await fs.writeFile(new URL('packing.json',art),JSON.stringify({schema:1,manifestSha256:sha(Buffer.from(JSON.stringify(manifest,null,2)+'\n')),coverage:manifest.coverage,frames:Object.entries(frames).map(([id,f])=>({id:Number(id),status:f.status,...f.evidence}))},null,2)+'\n');
if(process.argv.includes('--require-complete'))for(const name of await fs.readdir(dist))if(/^units0-[a-f0-9]{16}\.png$/.test(name)&&name!==filename)await fs.unlink(new URL(name,dist));
console.log(JSON.stringify({coverage:manifest.coverage,atlas:filename,width:atlasWidth,height:atlasHeight,bytes:png.length}));
if(process.argv.includes('--require-complete')&&missing.length)throw Error('Missing painted native SHPs: '+missing.join(','));
