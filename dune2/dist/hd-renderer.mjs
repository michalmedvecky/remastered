// Dune II HD presentation, GPL-2.0-only. Native simulation and SDL input stay authoritative.
import {scale2xIndices,toRgba,prepareFrameDescriptor,composeNativeViewport,stampNativeSprite,mappedIndex} from './hd-core.mjs';

const SCALE=4, WIDTH=320, HEIGHT=200;
const luminance=(r,g,b)=>(r*54+g*183+b*19)/256;
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load HD artwork: '+src));image.src=new URL('./'+src,import.meta.url).href;});

export async function createHDRenderer(canvas,{mode='hd',onError=()=>{}}={}){
  const response=await fetch(new URL('./hd/manifest.json',import.meta.url));
  if(!response.ok)throw Error('HD asset manifest unavailable');
  const manifest=await response.json();
  if(manifest.schema!==1||manifest.scale!==4)throw Error('Unsupported HD asset format');
  const frames={tiles:{},units:{},ui:{}};
  for(const kind of Object.keys(frames))for(const[id,frame]of Object.entries(manifest.frames[kind]??{}))frames[kind][id]=prepareFrameDescriptor(frame);
  const atlases={};
  await Promise.all(Object.entries(manifest.atlases).map(async([key,value])=>{atlases[key]=await loadImage(value.src);}));
  const materialImages={};
  await Promise.all(Object.entries(manifest.uiMaterials??{}).map(async([key,value])=>{const image=await loadImage(typeof value==='string'?value:value.src);const c=surface(64,64),x=c.getContext('2d');x.drawImage(image,0,0,64,64);materialImages[key]=x.getImageData(0,0,64,64).data;}));
  canvas.width=WIDTH*SCALE;canvas.height=HEIGHT*SCALE;
  const ctx=canvas.getContext('2d',{alpha:false}),base=surface(canvas.width,canvas.height),baseCtx=base.getContext('2d',{alpha:false});
  const baseData=baseCtx.createImageData(base.width,base.height),up2=new Uint8Array(WIDTH*HEIGHT*4),up4=new Uint8Array(WIDTH*HEIGHT*16);
  const repair=surface(240,160),repairCtx=repair.getContext('2d'),repairData=repairCtx.createImageData(240,160);
  const variants=new Map(),variantKeys=new WeakMap(),sourceInfo=new WeakMap(),uiClips=new Map();
  const uiPrediction=new Uint16Array(WIDTH*HEIGHT),uiMask=new Uint8Array(WIDTH*HEIGHT);
  const VARIANT_BYTES=32*1024*1024,UI_CLIP_BYTES=16*1024*1024;
  let variantBytes=0,uiClipBytes=0,lastPaint=-Infinity,painted=0,worldFrames=0,mismatchPixels=0,unsupported=0,lastCommands=0,uiPainted=0,cursorPainted=false,paintCostMs=0,maxPaintMs=0,errors=0;
  let currentMode=mode,ready=true;
  const paletteAt=(palette,index)=>{const p=index*3;return[(palette[p]*65)>>4,(palette[p+1]*65)>>4,(palette[p+2]*65)>>4];};
  const descriptor=(id)=>frames.units[id]??frames.ui[id];

  function frameColors(desc){
    let info=sourceInfo.get(desc);if(info)return info;
    const used=[...new Set(desc.renderIndices??desc.indices)],colors=[];
    for(const code of used){
      const index=desc.paletteMode==='local16'?desc.palette[code]:code,p=index*3;
      const r=manifest.palette[p],g=manifest.palette[p+1],b=manifest.palette[p+2];
      colors[code]={r,g,b,inverseLuma:1/(luminance(r,g,b)+2)};
    }
    info={used,colors};sourceInfo.set(desc,info);return info;
  }

  function variant(desc,command,house,tile){
    const {used,colors}=frameColors(desc),mapping=[];let key=(desc.atlas??(tile?'tiles':'units'))+':'+desc.x+','+desc.y+':';
    for(const code of used){
      const index=mappedIndex(desc,code,command,house,tile),rgb=paletteAt(command.activePalette,index);
      const source=colors[code];mapping[code]={r:rgb[0],g:rgb[1],b:rgb[2],inverseLuma:source.inverseLuma,same:rgb[0]===source.r&&rgb[1]===source.g&&rgb[2]===source.b};
      key+=code+'='+rgb.join(',')+';';
    }
    if(variants.has(key)){const value=variants.get(key);variants.delete(key);variants.set(key,value);return value;}
    const atlas=atlases[desc.atlas??(tile?'tiles':'units')];
    if(!atlas)return null;
    const c=surface(desc.w,desc.h),x=c.getContext('2d',{willReadFrequently:true});
    x.drawImage(atlas,desc.x,desc.y,desc.w,desc.h,0,0,desc.w,desc.h);
    const pixels=x.getImageData(0,0,desc.w,desc.h),rgba=pixels.data;
    for(let y=0;y<desc.h;y++)for(let px=0;px<desc.w;px++){
      const at=(y*desc.w+px)*4;if(rgba[at+3]===0)continue;
      const code=desc.renderIndices?desc.renderIndices[y*desc.w+px]:desc.indices[Math.floor(y/SCALE)*desc.sourceW+Math.floor(px/SCALE)];
      const target=mapping[code];if(!target||target.same)continue;
      const gain=(luminance(rgba[at],rgba[at+1],rgba[at+2])+2)*target.inverseLuma;
      rgba[at]=Math.min(255,target.r*gain);rgba[at+1]=Math.min(255,target.g*gain);rgba[at+2]=Math.min(255,target.b*gain);
    }
    x.putImageData(pixels,0,0);variantKeys.set(c,key);
    const bytes=c.width*c.height*4;
    // Bound actual RGBA backing sizes too: credit sprites are larger than tiles.
    if(bytes<=VARIANT_BYTES){
      variants.set(key,c);variantBytes+=bytes;
      while(variants.size>192||variantBytes>VARIANT_BYTES){const oldest=variants.keys().next().value,value=variants.get(oldest);variantBytes-=value.width*value.height*4;variants.delete(oldest);}
    }
    return c;
  }

  function sprite(command,palette){
    const desc=descriptor(command.id);if(!desc)return;
    if((command.flags&0x300)===0x200)return; // original distortion is restored by the comparison mask
    const shadow=(command.flags&0x300)===0x300;
    const image=variant(desc,{...command,activePalette:palette},0,false);if(!image)return;
    const [cx,cy,cw,ch]=command.clip;ctx.save();ctx.beginPath();ctx.rect(cx*SCALE,cy*SCALE,cw*SCALE,ch*SCALE);ctx.clip();
    ctx.translate(command.x*SCALE,command.y*SCALE);
    if(command.flags&1){ctx.translate(command.width*SCALE,0);ctx.scale(-1,1);}
    if(command.flags&2){ctx.translate(0,command.height*SCALE);ctx.scale(1,-1);}
    ctx.imageSmoothingEnabled=true;
    if(shadow){ctx.globalAlpha=.27;ctx.filter='brightness(0)';}
    ctx.drawImage(image,0,0,command.width*SCALE,command.height*SCALE);ctx.restore();
  }

  function baseFrame(frame){
    scale2xIndices(frame.pixels,WIDTH,HEIGHT,up2);scale2xIndices(up2,WIDTH*2,HEIGHT*2,up4);
    toRgba(up4,frame.palette,baseData.data);
    // New material detail on the original HUD's bronze surfaces; text and hit boxes remain native.
    const brass=materialImages.brass;
    if(frame.worldVisible&&brass){
      for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
        if(y>=40*SCALE&&x<240*SCALE)continue;
        const at=(y*base.width+x)*4,r=baseData.data[at],g=baseData.data[at+1],b=baseData.data[at+2];
        if(r<65||r<g*1.12||g<b*1.25)continue;
        const q=(((y&63)*64)+(x&63))*4,k=.88+luminance(brass[q],brass[q+1],brass[q+2])/255*.25;
        baseData.data[at]=r*k;baseData.data[at+1]=g*k;baseData.data[at+2]=b*k;
      }
    }
    baseCtx.putImageData(baseData,0,0);ctx.drawImage(base,0,0);
  }

  function world(frame){
    const prediction=composeNativeViewport(frame,frames);unsupported=prediction.unsupportedCommands;lastCommands=frame.commands.length;
    ctx.save();ctx.beginPath();ctx.rect(0,40*SCALE,240*SCALE,160*SCALE);ctx.clip();
    for(let y=0;y<10;y++)for(let x=0;x<15;x++){
      const at=(x+y*15)*4,ground=frame.tiles[at],overlay=frame.tiles[at+1],house=frame.tiles[at+2];
      if(overlay===frame.veiledTileId){ctx.fillStyle='rgb('+paletteAt(frame.palette,12).join(',')+')';ctx.fillRect(x*64,(y*16+40)*4,64,64);continue;}
      for(const id of [ground,...(overlay?[overlay]:[])]){const desc=frames.tiles[id];if(!desc)continue;const image=variant(desc,{activePalette:frame.palette},house,true);if(image)ctx.drawImage(image,x*64,(y*16+40)*4);}
    }
    for(const command of frame.commands)sprite(command,frame.palette);
    ctx.restore();
    let different=0;const data=repairData.data;
    for(let y=0;y<160;y++)for(let x=0;x<240;x++){
      const source=x+(y+40)*320,p=(x+y*240)*4;
      if(frame.pixels[source]===prediction.pixels[source]){data[p+3]=0;continue;}
      const rgb=paletteAt(frame.palette,frame.pixels[source]);data[p]=rgb[0];data[p+1]=rgb[1];data[p+2]=rgb[2];data[p+3]=255;different++;
    }
    mismatchPixels=different;
    // Keep authoritative native messages, selection/placement marks, cursor and unsupported effects.
    repairCtx.putImageData(repairData,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(repair,0,40*SCALE,240*SCALE,160*SCALE);
    worldFrames++;
  }

  function ui(frame){
    let count=0;
    for(const command of frame.uiCommands??[]){
      // The bridge supplies the current pointer separately; never reuse an old one.
      if(command.id>=0&&command.id<=6)continue;
      if(command.id>=111&&command.id<=354)continue;
      const desc=descriptor(command.id);if(!desc||(command.flags&0x300))continue;
      if(command.width<=0||command.height<=0||command.width>320||command.height>200)continue;
      // World overlays already come from owner commands and the authoritative
      // mismatch mask. Old advisor/menu sprites must not be reused over fog.
      if(frame.worldVisible&&command.x<240&&command.y+command.height>40)continue;
      const left=Math.max(0,command.x),right=Math.min(WIDTH,command.x+command.width),top=Math.max(0,command.y),bottom=Math.min(HEIGHT,command.y+command.height);
      if(left>=right||top>=bottom)continue;
      // Only this command's bounded rectangle can be stamped or examined below.
      // Other old prediction values do not need clearing and are never consulted.
      for(let y=top;y<bottom;y++)uiPrediction.fill(65535,y*WIDTH+left,y*WIDTH+right);
      if(!stampNativeSprite(uiPrediction,desc,command))continue;
      let n=0,same=0,visibleDetail=0;
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
        const at=x+y*WIDTH,index=uiPrediction[at];if(index===65535)continue;n++;if(index===frame.pixels[at]){same++;const p=index*3;if(Math.max(frame.palette[p],frame.palette[p+1],frame.palette[p+2])>8)visibleDetail++;}
      }
      if(n<4||visibleDetail<4||same/n<.96)continue;
      // A stale buffered UI draw must never cover later native text or controls.
      const image=variant(desc,{...command,activePalette:frame.palette},0,false);if(!image)continue;
      const maskSize=command.width*command.height;
      for(let y=0;y<command.height;y++)for(let x=0;x<command.width;x++){
        const xx=x+command.x,yy=y+command.y,at=xx+yy*320;
        uiMask[y*command.width+x]=xx<0||xx>=WIDTH||yy<0||yy>=HEIGHT||uiPrediction[at]!==frame.pixels[at]?1:0;
      }
      const key=[command.serial,command.id,command.x,command.y,command.width,command.height,command.flags,...command.clip,variantKeys.get(image)].join('|');
      let cached=uiClips.get(key),sameMask=!!cached&&cached.mask.length===maskSize;
      // Exact byte comparison, not a hash: a collision must not cover native text.
      if(sameMask)for(let i=0;i<maskSize;i++)if(cached.mask[i]!==uiMask[i]){sameMask=false;break;}
      let clip;
      if(sameMask){clip=cached.canvas;uiClips.delete(key);uiClips.set(key,cached);}
      else{
        if(cached){uiClipBytes-=cached.bytes;uiClips.delete(key);}
        clip=surface(command.width*SCALE,command.height*SCALE);const cx=clip.getContext('2d');
        cx.save();if(command.flags&1){cx.translate(clip.width,0);cx.scale(-1,1);}if(command.flags&2){cx.translate(0,clip.height);cx.scale(1,-1);}cx.drawImage(image,0,0,clip.width,clip.height);cx.restore();
        cx.globalCompositeOperation='destination-out';
        // Merge adjacent rejected pixels into one erase span per row.
        for(let y=0;y<command.height;y++)for(let x=0;x<command.width;){
          if(!uiMask[y*command.width+x]){x++;continue;}
          const start=x;while(x<command.width&&uiMask[y*command.width+x])x++;
          cx.fillRect(start*SCALE,y*SCALE,(x-start)*SCALE,SCALE);
        }
        const bytes=clip.width*clip.height*4+maskSize;
        if(bytes<=UI_CLIP_BYTES){
          cached={canvas:clip,mask:uiMask.slice(0,maskSize),bytes};uiClips.set(key,cached);uiClipBytes+=bytes;
          while(uiClips.size>64||uiClipBytes>UI_CLIP_BYTES){const oldest=uiClips.keys().next().value;uiClipBytes-=uiClips.get(oldest).bytes;uiClips.delete(oldest);}
        }
      }
      ctx.drawImage(clip,command.x*SCALE,command.y*SCALE);count++;
    }
    uiPainted=count;
  }

  function cursor(frame){
    const pointer=frame.cursor;cursorPainted=false;
    if(!pointer?.visible||!Number.isInteger(pointer.id)||pointer.id<0||pointer.id>6)return;
    const desc=descriptor(pointer.id);if(!desc)return;
    if(![pointer.x,pointer.y,pointer.hotX,pointer.hotY].every(Number.isFinite))return;
    sprite({id:pointer.id,x:pointer.x-pointer.hotX,y:pointer.y-pointer.hotY,
      width:desc.sourceW,height:desc.sourceH,flags:0,clip:[0,0,WIDTH,HEIGHT]},frame.palette);
    cursorPainted=true;
  }

  function present(frame){
    if(!ready||currentMode!=='hd'){canvas.hidden=true;return;}
    const now=performance.now();if(now-lastPaint<32)return;lastPaint=now;
    try{
      baseFrame(frame);if(frame.worldVisible)world(frame);else{mismatchPixels=0;lastCommands=0;}
      ui(frame);cursor(frame);canvas.hidden=false;painted++;paintCostMs=performance.now()-now;maxPaintMs=Math.max(maxPaintMs,paintCostMs);
      if(painted%20===0)canvas.dataset.hdState=JSON.stringify(diagnostics());
    }catch(error){errors++;canvas.hidden=true;if(errors===1)onError(error);}
  }
  function setMode(value){currentMode=value==='original'?'original':'hd';canvas.hidden=true;lastPaint=-Infinity;}
  function diagnostics(){const paintMs=Math.round(paintCostMs*10)/10;return{mode:currentMode,ready,width:canvas.width,height:canvas.height,frames:painted,worldFrames,commands:lastCommands,uiCommands:uiPainted,cursorPainted,nativeOverlayPixels:mismatchPixels,unsupportedCommands:unsupported,cachedVariants:variants.size,variantBytes,cachedVariantBytes:variantBytes,cachedUIClips:uiClips.size,uiClipBytes,cachedUIClipBytes:uiClipBytes,paintMs,lastPaintMs:paintMs,maxPaintMs:Math.round(maxPaintMs*10)/10,errors,coverage:manifest.coverage};}
  setMode(mode);
  return{present,setMode,diagnostics};
}
