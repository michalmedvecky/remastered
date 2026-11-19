// Whole-object painted Dune II presentation. GPL-2.0-only.
// Native simulation and framebuffer remain authoritative for game state/input.
import {toRgba, prepareFrameDescriptor, composeNativeViewport, mappedIndex} from './hd-core.mjs';
import {paintedMode, visibleNativeFrame, effectiveHouse, factionColour, recolourPainted, highlightAmount, rgbaBytesBounded} from './painted-core.mjs';
import {createPaintedTerrain} from './painted-terrain.mjs';

const SCALE = 4, W = 320, H = 200, WORLD = [0,40,240,160];
const makeSurface = (w,h) => {const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const readJSON = async file => {const response=await fetch(new URL('./'+file,import.meta.url));if(!response.ok)throw Error('Painted asset unavailable: '+file);return response.json();};
const loadImage = file => new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Painted atlas unavailable: '+file));image.src=new URL('./'+file,import.meta.url).href;});
const hasPaint = (desc,tile=false) => desc?.paletteMode==='local16'&&desc.palette?.some((index,code)=>index>=144&&index<=(tile?159:152)&&desc.indices.some((value,i)=>value===code&&desc.mask[i]));

export async function createPaintedRenderer(canvas,{mode='painted',onError=()=>{}}={}) {
  const [original,units,buildings,terrain] = await Promise.all([
    readJSON('painted/native.json'),readJSON('painted/units.json'),readJSON('painted/buildings.json'),createPaintedTerrain(),
  ]);
  if(original.schema!==1||units.schema!==1||buildings.schema!==1||units.scale!==4||buildings.scale!==4)throw Error('Unsupported painted asset schema');
  const frames={tiles:{},units:{},ui:{}};
  for(const kind of Object.keys(frames))for(const[id,desc]of Object.entries(original.frames[kind]))frames[kind][id]=prepareFrameDescriptor(desc);
  const atlases={};
  await Promise.all([['unit',units],['building',buildings]].flatMap(([bank,manifest])=>Object.entries(manifest.atlases).map(async([key,row])=>{atlases[bank+':'+key]=await loadImage(row.src);})));
  canvas.width=W*SCALE;canvas.height=H*SCALE;
  const ctx=canvas.getContext('2d',{alpha:false}),base=makeSurface(W,H),baseCtx=base.getContext('2d',{alpha:false});
  const baseData=baseCtx.createImageData(W,H),repair=makeSurface(240,160),repairCtx=repair.getContext('2d'),repairData=repairCtx.createImageData(240,160);
  const variants=new Map(),nativeVariants=new Map(),housePaint=new WeakMap(),emissionMasks=new WeakMap();
  let currentMode=paintedMode(mode),lastPaint=-Infinity,painted=0,worldFrames=0,errors=0,lastCommands=0,paintedCommands=0;
  let mismatchPixels=0,missingPaint=0,unsupported=0,variantBytes=0,nativeBytes=0,paintCost=0,maxPaint=0,lastTiles=0;
  let latestPalette='',latestPaletteBytes=null;
  const frameDescriptor=id=>frames.units[id]??frames.ui[id];
  const isHousePaint=(desc,tile=false)=>{if(!housePaint.has(desc))housePaint.set(desc,hasPaint(desc,tile));return housePaint.get(desc);};

  function originalImage(desc,command,palette) {
    const paletteMap=command?.palette?.join(',')??'',remap=(command?.flags&0x300)===0x100?command.remap?.join(',')??'':'';
    const key=desc.resource+':'+desc.resourceFrame+':'+latestPalette+':'+paletteMap+':'+remap+':'+(command?.remapCount??0);
    if(nativeVariants.has(key)){const image=nativeVariants.get(key);nativeVariants.delete(key);nativeVariants.set(key,image);return image;}
    const image=makeSurface(desc.sourceW,desc.sourceH),context=image.getContext('2d'),data=context.createImageData(image.width,image.height);
    for(let i=0;i<desc.indices.length;i++){
      if(!desc.mask[i])continue;const index=mappedIndex(desc,desc.indices[i],command),p=index*3,q=i*4;
      data.data[q]=(palette[p]*65)>>4;data.data[q+1]=(palette[p+1]*65)>>4;data.data[q+2]=(palette[p+2]*65)>>4;data.data[q+3]=255;
    }
    context.putImageData(data,0,0);nativeVariants.set(key,image);nativeBytes=rgbaBytesBounded(nativeVariants,128,8*1024*1024);return image;
  }

  function paintedImage(bank,art,source,house,palette,command=null) {
    const rect=art.rect??[art.x,art.y,art.w,art.h],paint=isHousePaint(source,bank==='building')&&(bank==='building'||!!command?.palette),amount=highlightAmount(command);
    const effective=paint?house:1,colourKey=effective===1?'blue':factionColour(palette,effective).join(',');
    const cycle=bank==='building'&&art.paletteCycle223&&art.emissionMaskBase64?[palette[669],palette[670],palette[671]]:null;
    const key=[bank,art.atlas,...rect,effective,colourKey,amount,amount?palette.slice(45,48).join(','):'',cycle?.join(',')??''].join(':');
    if(variants.has(key)){const image=variants.get(key);variants.delete(key);variants.set(key,image);return image;}
    const atlas=atlases[bank+':'+art.atlas];if(!atlas)return null;
    const image=makeSurface(rect[2],rect[3]),context=image.getContext('2d',{willReadFrequently:true});
    context.drawImage(atlas,...rect,0,0,image.width,image.height);
    if(effective!==1||amount||cycle?.some(v=>v)){
      const data=context.getImageData(0,0,image.width,image.height);
      if(effective!==1||amount)data.data.set(recolourPainted(data.data,palette,effective,{highlight:amount}));
      if(cycle?.some(v=>v)){
        // Native223 drives a semantic mask fitted to the NEW curved apertures,
        // never the original low-resolution pixels or their colour blocks.
        let mask=emissionMasks.get(art);
        if(!mask){mask=Uint8Array.from(atob(art.emissionMaskBase64),c=>c.charCodeAt(0));if(mask.length!==image.width*image.height)throw Error('Invalid painted aperture mask');emissionMasks.set(art,mask);}
        for(let i=0;i<mask.length;i++){
          const q=i*4;if(!mask[i]||!data.data[q+3])continue;
          for(let c=0;c<3;c++)data.data[q+c]+=((cycle[c]*65)>>4)*(mask[i]/255)*.45;
        }
      }
      context.putImageData(data,0,0);
    }
    variants.set(key,image);variantBytes=rgbaBytesBounded(variants,256,32*1024*1024);return image;
  }

  function drawSprite(command,frame) {
    const source=frameDescriptor(command.id);if(!source){missingPaint++;return;}
    const effect=command.flags&0x300;if(effect===0x200)return; // native destination distortion is repaired below
    const art=units.frames[command.id],shadow=effect===0x300;
    let image;
    if(art){const house=effectiveHouse(source,command,frame.playerHouse);image=paintedImage('unit',art,source,house,frame.palette,command);paintedCommands++;}
    else{image=originalImage(source,command,frame.palette);if(command.id>6)missingPaint++;}
    if(!image)return;
    const[x,y,w,h]=command.clip??[0,40,240,160];ctx.save();ctx.beginPath();ctx.rect(x*SCALE,y*SCALE,w*SCALE,h*SCALE);ctx.clip();
    ctx.translate(command.x*SCALE,command.y*SCALE);
    if(command.flags&1){ctx.translate(command.width*SCALE,0);ctx.scale(-1,1);}
    if(command.flags&2){ctx.translate(0,command.height*SCALE);ctx.scale(1,-1);}
    ctx.imageSmoothingEnabled=!!art;
    if(shadow){ctx.globalAlpha=.32;ctx.filter='brightness(0)';}
    ctx.drawImage(image,0,0,command.width*SCALE,command.height*SCALE);ctx.restore();
  }

  function drawBuildings(frame,overlay=false) {
    let count=0;
    for(let row=0;row<10;row++)for(let col=0;col<15;col++){
      const at=(row*15+col)*4;if(!frame.debugScenario&&(!frame.tiles[at+3]||frame.tiles[at+1]===frame.veiledTileId))continue;
      const id=frame.tiles[at+(overlay?1:0)],art=buildings.tiles[id];if(!art||overlay&&!id)continue;
      const source=frames.tiles[id];if(!source){missingPaint++;continue;}
      const image=paintedImage('building',art,source,frame.tiles[at+2],frame.palette);if(!image){missingPaint++;continue;}
      ctx.drawImage(image,col*64,(40+row*16)*4,64,64);count++;
    }
    return count;
  }

  function world(frame) {
    const prediction=composeNativeViewport(visibleNativeFrame(frame),frames);unsupported=prediction.unsupportedCommands;
    missingPaint=prediction.missingFrames;paintedCommands=0;lastCommands=frame.commands.length;
    ctx.save();ctx.beginPath();ctx.rect(0,160,960,640);ctx.clip();
    terrain.draw(ctx,frame,{scale:SCALE,phase:'ground'});lastTiles=drawBuildings(frame);
    lastTiles+=drawBuildings(frame,true);terrain.draw(ctx,frame,{scale:SCALE,phase:'overlay'});
    for(const command of frame.commands)drawSprite(command,frame);
    ctx.restore();
    let different=0;const rgba=repairData.data;
    for(let y=0;y<160;y++)for(let x=0;x<240;x++){
      const at=x+(y+40)*W,q=(x+y*240)*4;
      if(frame.pixels[at]===prediction.pixels[at]){rgba[q+3]=0;continue;}
      const p=frame.pixels[at]*3;rgba[q]=(frame.palette[p]*65)>>4;rgba[q+1]=(frame.palette[p+1]*65)>>4;rgba[q+2]=(frame.palette[p+2]*65)>>4;rgba[q+3]=255;different++;
    }
    mismatchPixels=different;repairCtx.putImageData(repairData,0,0);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(repair,0,160,960,640);worldFrames++;
  }

  function drawCursor(frame) {
    const pointer=frame.cursor,source=frameDescriptor(pointer?.id);
    if(!pointer?.visible||!source||pointer.id<0||pointer.id>6)return;
    const image=originalImage(source,null,frame.palette);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,(pointer.x-pointer.hotX)*4,(pointer.y-pointer.hotY)*4,source.sourceW*4,source.sourceH*4);
  }

  function setMode(value){currentMode=paintedMode(value);canvas.hidden=true;lastPaint=-Infinity;}
  function diagnostics(){return{mode:currentMode,ready:true,art:'approved whole-object RGBA',generatedArt:true,width:1280,height:800,frames:painted,worldFrames,commands:lastCommands,paintedCommands,buildingTiles:lastTiles,nativeOverlayPixels:mismatchPixels,missingPaint,unsupportedCommands:unsupported,variantBytes,nativeBytes,paintMs:Math.round(paintCost*10)/10,maxPaintMs:Math.round(maxPaint*10)/10,errors,coverage:{units:units.coverage,buildings:buildings.coverage,terrain:terrain.manifest.coverage},terrain:terrain.diagnostics()};}
  function present(frame){
    if(currentMode!=='painted'){canvas.hidden=true;return;}
    const now=performance.now();if(now-lastPaint<32)return;lastPaint=now;
    try{
      if(!latestPaletteBytes||latestPaletteBytes.some((v,i)=>v!==frame.palette[i])){latestPaletteBytes=frame.palette.slice();latestPalette=Array.from(frame.palette).join(',');}
      toRgba(frame.pixels,frame.palette,baseData.data);baseCtx.putImageData(baseData,0,0);
      ctx.imageSmoothingEnabled=false;ctx.drawImage(base,0,0,1280,800);
      if(frame.worldVisible)world(frame);else{mismatchPixels=0;lastCommands=0;paintedCommands=0;lastTiles=0;}
      drawCursor(frame);canvas.hidden=false;painted++;paintCost=performance.now()-now;maxPaint=Math.max(maxPaint,paintCost);
      if(painted%20===0)canvas.dataset.paintedState=JSON.stringify(diagnostics());
    }catch(error){errors++;canvas.hidden=true;if(errors===1)onError(error);}
  }
  setMode(mode);return{present,setMode,diagnostics};
}
