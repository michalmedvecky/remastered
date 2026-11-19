// Whole-object painted Dune II presentation. GPL-2.0-only.
// Native simulation and framebuffer remain authoritative for game state/input.
import {toRgba, prepareFrameDescriptor, composeNativeViewport, mappedIndex} from './hd-core.mjs';
import {paintedMode, visibleNativeFrame, effectiveHouse, factionColour, recolourPainted, highlightAmount, rgbaBytesBounded, distortPaintedRGBA} from './painted-core.mjs';
import {createPaintedTerrain} from './painted-terrain.mjs';
import {createPaintedUI} from './painted-ui.mjs';
import {intersectRect, sameUIPixels, uiPresentationSignature} from './painted-ui-core.mjs';
import {createCamera, cameraInputOffsetQ8} from './painted-camera.mjs';

const SCALE = 4, W = 320, H = 200, WORLD = [0,40,240,160];
const makeSurface = (w,h) => {const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const readJSON = async file => {const response=await fetch(new URL('./'+file,import.meta.url));if(!response.ok)throw Error('Painted asset unavailable: '+file);return response.json();};
const loadImage = file => new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Painted atlas unavailable: '+file));image.src=new URL('./'+file,import.meta.url).href;});
const hasPaint = (desc,tile=false) => desc?.paletteMode==='local16'&&desc.palette?.some((index,code)=>index>=144&&index<=(tile?159:152)&&desc.indices.some((value,i)=>value===code&&desc.mask[i]));

export async function createPaintedRenderer(canvas,{mode='painted',locale=null,onError=()=>{},setViewOffset=()=>{}}={}) {
  const [original,units,buildings,terrain] = await Promise.all([
    readJSON('painted/native.json'),readJSON('painted/units.json'),readJSON('painted/buildings.json'),createPaintedTerrain(),
  ]);
  if(original.schema!==1||units.schema!==1||buildings.schema!==1||units.scale!==4||buildings.scale!==4)throw Error('Unsupported painted asset schema');
  for(const[id,patch]of Object.entries(locale?.uiFrames??{}))if(original.frames.ui[id])original.frames.ui[id]={...original.frames.ui[id],...patch};
  const frames={tiles:{},units:{},ui:{}};
  for(const kind of Object.keys(frames))for(const[id,desc]of Object.entries(original.frames[kind]))frames[kind][id]=prepareFrameDescriptor(desc);
  const ui = await createPaintedUI({sourceFrames: frames,locale});
  const atlases={};
  await Promise.all([['unit',units],['building',buildings]].flatMap(([bank,manifest])=>Object.entries(manifest.atlases).map(async([key,row])=>{atlases[bank+':'+key]=await loadImage(row.src);})));
  canvas.width=W*SCALE;canvas.height=H*SCALE;
  const ctx=canvas.getContext('2d',{alpha:false}),base=makeSurface(W,H),baseCtx=base.getContext('2d',{alpha:false});
  // Native snapshots are immutable. Rebuild their art layers once, then move
  // this same coherent scene on requestAnimationFrame without advancing DOS time.
  const worldLayer=makeSurface(272*SCALE,192*SCALE),worldCtx=worldLayer.getContext('2d',{alpha:false,willReadFrequently:true});
  const uiLayer=makeSurface(W*SCALE,H*SCALE),uiCtx=uiLayer.getContext('2d');
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  const camera=createCamera({reducedMotion:motionPreference.matches});
  const baseData=baseCtx.createImageData(W,H),repair=makeSurface(240,160),repairCtx=repair.getContext('2d'),repairData=repairCtx.createImageData(240,160);
  const variants=new Map(),nativeVariants=new Map(),housePaint=new WeakMap(),emissionMasks=new WeakMap();
  const repairSuppressed = new Uint8Array(240 * 160), frameHistory = [];
  let currentMode=paintedMode(mode),painted=0,worldFrames=0,errors=0,lastCommands=0,paintedCommands=0;
  let latestFrame=null,dirty=false,animation=0,worldKey=null,worldRect=WORLD,worldOrigin={x:0,y:40};
  let lastCamera=null,nativeFrames=0,worldCost=0,uiCost=0,presentCost=0,lastAnimationAt=null;
  let uiFrame=null,uiSignature=null,uiCacheHits=0,uiRefreshes=0;
  const animationIntervals=[],cameraSamples=[];
  let mismatchPixels=0,missingPaint=0,unsupported=0,variantBytes=0,nativeBytes=0,paintCost=0,maxPaint=0,lastTiles=0;
  let latestPalette='',latestPaletteBytes=null;
  let hdDistortions = 0;
  let slabRepairs = [];
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

  function drawSprite(command,frame,ctx=worldCtx) {
    const source=frameDescriptor(command.id);if(!source){missingPaint++;return;}
    if (command.id <= 6 && ui.worldControl(ctx, command, frame)) return;
    const effect=command.flags&0x300;
    if(effect===0x200){drawDistortion(command,frame,source);return;}
    const art=units.frames[command.id],shadow=effect===0x300;
    let image;
    if(art){const house=effectiveHouse(source,command,frame.playerHouse);image=paintedImage('unit',art,source,house,frame.palette,command);paintedCommands++;}
    else{image=originalImage(source,command,frame.palette);if(command.id>6)missingPaint++;}
    if(!image)return;
    const[x,y,w,h]=command.clip??WORLD;ctx.save();ctx.beginPath();ctx.rect(x*SCALE,y*SCALE,w*SCALE,h*SCALE);ctx.clip();
    ctx.translate(command.x*SCALE,command.y*SCALE);
    if(command.flags&1){ctx.translate(command.width*SCALE,0);ctx.scale(-1,1);}
    if(command.flags&2){ctx.translate(0,command.height*SCALE);ctx.scale(1,-1);}
    ctx.imageSmoothingEnabled=!!art;
    if(shadow){ctx.globalAlpha=.32;ctx.filter='brightness(0)';}
    ctx.drawImage(image,0,0,command.width*SCALE,command.height*SCALE);ctx.restore();
  }

  function drawDistortion(command, frame, source, ctx=worldCtx) {
    if (!command.blurOffset || command.blurIncrement !== 256 || command.blurSeed !== 0) return;
    const art = units.frames[command.id];
    if (!art) return;
    const bounds = intersectRect([command.x, command.y, command.width, command.height], command.clip ?? worldRect);
    const clipped = bounds && intersectRect(bounds, worldRect);
    if (!clipped) return;
    const [x, y, width, height] = clipped.map(n => n * SCALE), pad = command.blurOffset * SCALE;
    const sx=x-worldOrigin.x*SCALE,sy=y-worldOrigin.y*SCALE;
    const w = Math.min(width + pad, worldLayer.width - sx);
    const mask = makeSurface(w, height), maskCtx = mask.getContext('2d');
    const image = paintedImage('unit', art, source, 1, frame.palette, command);
    maskCtx.translate(command.x * SCALE - x, command.y * SCALE - y);
    if(command.flags&1){maskCtx.translate(command.width*SCALE,0);maskCtx.scale(-1,1);}
    if(command.flags&2){maskCtx.translate(0,command.height*SCALE);maskCtx.scale(1,-1);}
    maskCtx.drawImage(image, 0, 0, command.width * SCALE, command.height * SCALE);
    const rgba = maskCtx.getImageData(0, 0, w, height).data;
    const alpha = Uint8Array.from({length:w*height},(_,i)=>i%w<width?rgba[i*4+3]:0);
    const data = ctx.getImageData(sx, sy, w, height);
    data.data.set(distortPaintedRGBA(data.data, w, height, alpha, pad, !!(command.flags & 1)));
    ctx.putImageData(data, sx, sy); hdDistortions++;
  }

  function drawBuildings(frame,overlay=false,ctx=worldCtx) {
    let count=0;
    const cols=frame.grid?.width??15,rows=frame.grid?.height??10;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const at=(row*cols+col)*4;if(!frame.debugScenario&&(!frame.tiles[at+3]||frame.tiles[at+1]===frame.veiledTileId))continue;
      const id=frame.tiles[at+(overlay?1:0)],art=buildings.tiles[id];if(!art||overlay&&!id)continue;
      const source=frames.tiles[id];if(!source){missingPaint++;continue;}
      const image=paintedImage('building',art,source,frame.tiles[at+2],frame.palette);if(!image){missingPaint++;continue;}
      ctx.drawImage(image,(worldOrigin.x+col*16)*SCALE,(worldOrigin.y+row*16)*SCALE,64,64);count++;
    }
    return count;
  }

  function world(frame) {
    const start=performance.now(),ctx=worldCtx,fringe=frame.overscan;
    const expanded=fringe?.width===17&&fringe?.height===12&&fringe.tiles?.length===816;
    const tilesFrame=expanded?{...frame,tiles:fringe.tiles,grid:fringe}:frame;
    worldOrigin=expanded?{x:-16,y:24}:{x:0,y:40};
    worldRect=expanded?[-16,24,272,192]:WORLD;
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,worldLayer.width,worldLayer.height);
    ctx.translate(-worldOrigin.x*SCALE,-worldOrigin.y*SCALE);
    const prediction=composeNativeViewport(visibleNativeFrame(frame),frames);unsupported=prediction.unsupportedCommands;
    hdDistortions = 0;
    missingPaint=prediction.missingFrames;paintedCommands=0;lastCommands=frame.commands.length;
    ctx.save();ctx.beginPath();ctx.rect(...worldRect.map(n=>n*SCALE));ctx.clip();
    terrain.draw(ctx,tilesFrame,{scale:SCALE,phase:'ground',...worldOrigin});lastTiles=drawBuildings(tilesFrame);
    lastTiles+=drawBuildings(tilesFrame,true);terrain.draw(ctx,tilesFrame,{scale:SCALE,phase:'overlay',...worldOrigin});
    for(const command of frame.commands){
      // Native observers retain the current full sprite pose before viewport
      // clipping. Only expand that known world window, never a custom clip.
      const clip=command.clip;
      const worldClip=!clip||clip.every((n,i)=>n===WORLD[i]);
      drawSprite(expanded&&worldClip?{...command,clip:worldRect}:command,frame);
    }
    ctx.restore();
    unsupported = Math.max(0, unsupported - hdDistortions);
    repairSuppressed.fill(0);
    const excluded = ui.suppressionRects(frame);
    for (const command of frame.commands) if ((command.flags & 0x300) === 0x200 && command.blurOffset && command.blurIncrement === 256 && command.blurSeed === 0) excluded.push([command.x, command.y, command.width, command.height]);
    for (const rect of excluded) {
      const clipped = intersectRect(rect, WORLD);
      if (!clipped) continue;
      const left = Math.floor(clipped[0]), right = Math.ceil(clipped[0]+clipped[2]);
      for(let row=Math.floor(clipped[1])-40;row<Math.ceil(clipped[1]+clipped[3])-40;row++)repairSuppressed.fill(1,row*240+left,row*240+right);
    }
    let different=0;const rgba=repairData.data, interiorRepairs=new Uint16Array(150);
    for(let y=0;y<160;y++)for(let x=0;x<240;x++){
      const at=x+(y+40)*W,q=(x+y*240)*4;
      if(repairSuppressed[x+y*240]||frame.pixels[at]===prediction.pixels[at]){rgba[q+3]=0;continue;}
      const p=frame.pixels[at]*3;rgba[q]=(frame.palette[p]*65)>>4;rgba[q+1]=(frame.palette[p+1]*65)>>4;rgba[q+2]=(frame.palette[p+2]*65)>>4;rgba[q+3]=255;different++;
      if((x&15)>0&&(x&15)<15&&(y&15)>0&&(y&15)<15)interiorRepairs[(y>>4)*15+(x>>4)]++;
    }
    slabRepairs=[];
    for(let cell=0;cell<150;cell++)if(terrain.manifest.tiles[frame.tiles[cell*4]]?.kind==='slab')slabRepairs.push({cell,id:frame.tiles[cell*4],interiorRepairPixels:interiorRepairs[cell]});
    mismatchPixels=different;repairCtx.putImageData(repairData,0,0);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(repair,0,160,960,640);worldFrames++;
    ctx.setTransform(1,0,0,1,0,0);worldCost=performance.now()-start;
  }

  function drawCursor(frame) {
    if (ui.cursor(ctx, frame)) return;
    const pointer=frame.cursor,source=frameDescriptor(pointer?.id);
    if(!pointer?.visible||!source||pointer.id<0||pointer.id>6)return;
    const image=originalImage(source,null,frame.palette);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,(pointer.x-pointer.hotX)*4,(pointer.y-pointer.hotY)*4,source.sourceW*4,source.sourceH*4);
  }

  function schedule(){if(!animation&&currentMode==='painted'&&!document.hidden)animation=requestAnimationFrame(render);}
  function setMode(value){
    currentMode=paintedMode(value);canvas.hidden=true;camera.reset(latestFrame,performance.now(),'graphics-mode');setViewOffset(0,0,latestFrame?.viewport??0);lastCamera=null;
    if(animation)cancelAnimationFrame(animation);animation=0;worldKey=null;dirty=!!latestFrame;lastAnimationAt=null;
    if(currentMode==='painted')schedule();
  }
  function diagnostics(){return{mode:currentMode,ready:true,art:'approved whole-object RGBA',generatedArt:true,width:1280,height:800,frames:painted,nativeFrames,worldFrames,commands:lastCommands,paintedCommands,buildingTiles:lastTiles,nativeOverlayPixels:mismatchPixels,hdDistortions,missingPaint,unsupportedCommands:unsupported,variantBytes,nativeBytes,paintMs:Math.round(paintCost*10)/10,maxPaintMs:Math.round(maxPaint*10)/10,worldMs:Math.round(worldCost*10)/10,uiMs:Math.round(uiCost*10)/10,presentMs:Math.round(presentCost*10)/10,uiCacheHits,uiRefreshes,errors,camera:{...camera.diagnostics(),sample:lastCamera,intervals:animationIntervals.slice(),samples:cameraSamples.slice()},coverage:{units:units.coverage,buildings:buildings.coverage,terrain:terrain.manifest.coverage},terrain:terrain.diagnostics(),ui:ui.diagnostics(),history:frameHistory.slice()};}
  function prepareSnapshot(frame){
    const now=performance.now();
    const paletteChanged=!latestPaletteBytes||latestPaletteBytes.some((v,i)=>v!==frame.palette[i]);
    if(paletteChanged){latestPaletteBytes=frame.palette.slice();latestPalette=Array.from(frame.palette).join(',');}
    if(frame.worldVisible){
      const b=frame.overscan;
      const key=[frame.worldEpoch,frame.worldRevision,frame.viewport,b?.x,b?.y,b?.width,b?.height,frame.debugScenario?1:0,latestPalette].join(':');
      if(key!==worldKey){world(frame);worldKey=key;}
    }else{worldKey=null;mismatchPixels=0;lastCommands=0;paintedCommands=0;lastTiles=0;slabRepairs=[];hdDistortions=0;unsupported=0;}
    const uiStart=performance.now();
    const signature=uiPresentationSignature(frame);
    if(signature===uiSignature&&sameUIPixels(uiFrame,frame))uiCacheHits++;
    else{
      toRgba(frame.uiPixels??frame.pixels,frame.palette,baseData.data);baseCtx.putImageData(baseData,0,0);
      uiCtx.setTransform(1,0,0,1,0,0);uiCtx.clearRect(0,0,uiLayer.width,uiLayer.height);
      uiCtx.imageSmoothingEnabled=false;uiCtx.drawImage(base,0,0,1280,800);
      if(frame.worldVisible)uiCtx.clearRect(0,160,960,640);
      ui.draw(uiCtx,frame);uiFrame=frame;uiSignature=signature;uiRefreshes++;
    }
    uiCost=performance.now()-uiStart;
    frameHistory.push({tick:frame.gameTick,world:frame.worldVisible,revision:frame.worldRevision??0,commitTick:frame.worldCommitTick??0,gameplayActive:frame.gameplayActive,repair:mismatchPixels,tiles:lastTiles,slabs:slabRepairs,errors});
    if(frameHistory.length>120)frameHistory.shift();
    paintCost=performance.now()-now;maxPaint=Math.max(maxPaint,paintCost);
  }
  function render(now){
    animation=0;
    if(currentMode!=='painted'||!latestFrame||document.hidden)return;
    try{
      if(dirty){prepareSnapshot(latestFrame);dirty=false;}
      const start=performance.now(),frame=latestFrame,c=lastCamera=camera.sample(now);
      if(lastAnimationAt!==null){const dt=now-lastAnimationAt;if(dt>0&&dt<100){animationIntervals.push(Math.round(dt*100)/100);if(animationIntervals.length>120)animationIntervals.shift();}}
      lastAnimationAt=now;
      ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
      if(frame.worldVisible){
        const sx=(-worldOrigin.x-c.offsetX)*SCALE,sy=(40-worldOrigin.y-c.offsetY)*SCALE;
        ctx.imageSmoothingEnabled=true;ctx.drawImage(worldLayer,sx,sy,960,640,0,160,960,640);
      }
      ctx.drawImage(uiLayer,0,0);drawCursor(frame);
      const offset=cameraInputOffsetQ8(c);setViewOffset(offset.x,offset.y,frame.viewport);
      if(c.moving){cameraSamples.push({at:Math.round(now*100)/100,x:c.displayX,y:c.displayY,nativeX:c.nativeX,nativeY:c.nativeY,revision:frame.worldRevision});if(cameraSamples.length>120)cameraSamples.shift();}
      canvas.hidden=false;painted++;presentCost=performance.now()-start;
      if(painted%20===0)canvas.dataset.paintedState=JSON.stringify(diagnostics());
      if(c.moving)schedule();
    }catch(error){errors++;canvas.hidden=true;if(errors===1)onError(error);}
  }
  function present(frame){
    nativeFrames++;latestFrame=frame;
    if(currentMode!=='painted'){canvas.hidden=true;return;}
    const accepted=camera.acceptNative(frame,performance.now());
    const displayed=lastCamera?.active&&lastCamera.epoch===accepted.epoch?lastCamera:accepted;
    const offset=cameraInputOffsetQ8(displayed,accepted);
    setViewOffset(offset.x,offset.y,frame.viewport);dirty=true;schedule();
  }
  const onMotionChange=event=>{camera.setReducedMotion(event.matches,performance.now());schedule();};
  const onVisibilityChange=()=>{camera.reset(latestFrame,performance.now(),'visibility');setViewOffset(0,0,latestFrame?.viewport??0);lastCamera=null;lastAnimationAt=null;if(document.hidden){if(animation)cancelAnimationFrame(animation);animation=0;}else{dirty=!!latestFrame;schedule();}};
  motionPreference.addEventListener('change',onMotionChange);
  document.addEventListener('visibilitychange',onVisibilityChange);
  function dispose(){
    if(animation)cancelAnimationFrame(animation);animation=0;
    motionPreference.removeEventListener('change',onMotionChange);document.removeEventListener('visibilitychange',onVisibilityChange);
    latestFrame=null;uiFrame=null;variants.clear();nativeVariants.clear();setViewOffset(0,0,0);
  }
  setMode(mode);return{present,setMode,diagnostics,dispose};
}
