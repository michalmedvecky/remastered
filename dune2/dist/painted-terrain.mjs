// Painted semantic ground. Native tile identities, original topology and input stay authoritative.
// GPL-2.0-only. Art provenance and state limits accompany painted/terrain.json.
const SCALE=4,W=240*SCALE,H=160*SCALE,TILE=16*SCALE;
const mod=(a,b)=>((a%b)+b)%b;
export function terrainWorldOffset(viewport){return{x:(viewport&63)*TILE,y:((viewport>>>6)&63)*TILE};}
export function terrainSurfaceUV(viewport,column,row,pixelX=0,pixelY=0,period=512){const p=terrainWorldOffset(viewport);return{x:mod(p.x+column*TILE+pixelX,period),y:mod(p.y+row*TILE+pixelY,period)};}
export function terrainCellVisible(frame,index){const p=index*4;return !!frame.debugScenario||!!frame.tiles[p+3]&&frame.tiles[p+1]!==(frame.veiledTileId??frame.veiledTileID??123);}
const surface=(document,w,h)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;};
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Painted terrain image unavailable: '+src));image.src=src;});

// A committed fringe uses absolute map tile coordinates, including negative
// cells at map edges. Never wrap those through the packed 6-bit viewport.
export function terrainGrid(frame){
 const grid=frame?.grid??{x:frame?.viewport&63,y:(frame?.viewport>>>6)&63,width:15,height:10};
 if(!['x','y','width','height'].every(k=>Number.isInteger(grid[k]))||grid.width<1||grid.height<1||grid.width>17||grid.height>12||frame?.tiles?.length!==grid.width*grid.height*4)throw Error('Invalid committed terrain grid');
 return grid;
}

export async function createPaintedTerrain({manifestURL=new URL('./painted/terrain.json',import.meta.url)}={}){
 const response=await fetch(manifestURL);if(!response.ok)throw Error('Painted terrain manifest unavailable');const manifest=await response.json();if(manifest.schema!==1||manifest.scale!==4)throw Error('Unsupported painted terrain format');
 const doc=document,atlases={};await Promise.all(Object.entries(manifest.assets).map(async([name,item])=>{atlases[name]=await loadImage(new URL('./'+item.src,import.meta.url).href);}));
 const textures={},patterns={};for(const[name,rect]of Object.entries(manifest.surfaces)){const canvas=surface(doc,rect.w,rect.h),ctx=canvas.getContext('2d');ctx.drawImage(atlases.surfaces,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);textures[name]=canvas;}
 delete atlases.surfaces; // Cropped semantic planes own their backing; release the duplicated full atlas.
 const ground=surface(doc,W,H),overlays=surface(doc,W,H),working=surface(doc,W,H),tileWorking=surface(doc,TILE,TILE),fogSprites=new Map(),classMasks=new Map();
 const gc=ground.getContext('2d',{alpha:false}),oc=overlays.getContext('2d'),wc=working.getContext('2d'),tc=tileWorking.getContext('2d');
 for(const name of Object.keys(textures))patterns[name]=gc.createPattern(textures[name],'repeat');
 let lastKey=null,rebuilds=0,draws=0,unknownGround=[],unknownOverlay=[],visibleIDs=[],lastViewport=0,pw=W,ph=H;
 const otherOwner=new Set(manifest.coverage.otherOwnerIDs);
 function resetMask(name){let canvas=classMasks.get(name);if(!canvas){canvas=surface(doc,pw,ph);classMasks.set(name,canvas);}const ctx=canvas.getContext('2d');ctx.clearRect(0,0,pw,ph);return ctx;}
 function paintPlane(ctx,name,world,width=pw,height=ph){ctx.save();ctx.translate(-world.x,-world.y);ctx.fillStyle=patterns[name];ctx.fillRect(world.x,world.y,width,height);ctx.restore();}
 function addMask(collection,name,x,y,mask){let ctx=collection.get(name);if(!ctx){ctx=resetMask(name);collection.set(name,ctx);}if(mask)ctx.drawImage(atlases.masks,mask.x,mask.y,mask.w,mask.h,x,y,TILE,TILE);else{ctx.fillStyle='#fff';ctx.fillRect(x,y,TILE,TILE);}}
 function paintMasked(ctx,name,mask,world){wc.clearRect(0,0,pw,ph);wc.globalCompositeOperation='source-over';paintPlane(wc,name,world);wc.globalCompositeOperation='destination-in';wc.drawImage(mask,0,0);wc.globalCompositeOperation='source-over';ctx.drawImage(working,0,0);}
 function fog(id){if(fogSprites.has(id))return fogSprites.get(id);const entry=manifest.tiles[id],mask=entry?.fogMask;if(!mask)return null;const canvas=surface(doc,TILE,TILE),ctx=canvas.getContext('2d');ctx.drawImage(atlases.masks,mask.x,mask.y,mask.w,mask.h,0,0,TILE,TILE);ctx.globalCompositeOperation='source-in';ctx.fillStyle='#000';ctx.fillRect(0,0,TILE,TILE);fogSprites.set(id,canvas);return canvas;}
 function stampOverlay(ctx,entry,x,y,house){const rect=entry.overlay.variants[house]??entry.overlay.variants[0];if(rect)ctx.drawImage(atlases.overlays,rect.x,rect.y,rect.w,rect.h,x,y,TILE,TILE);}
 // Rare native overlays may themselves be landscape/slab IDs. Render a complete
 // painted tile using the same global UV, rather than silently restoring old art.
 function standalone(entry,column,row,world){const local={x:world.x+column*TILE,y:world.y+row*TILE};tc.clearRect(0,0,TILE,TILE);if(entry.base==='black'){tc.fillStyle='#000';tc.fillRect(0,0,TILE,TILE);}else paintPlane(tc,entry.base??'rock',local,TILE,TILE);for(const layer of entry.layers){wc.clearRect(0,0,TILE,TILE);wc.globalCompositeOperation='source-over';paintPlane(wc,layer.surface,local,TILE,TILE);wc.globalCompositeOperation='destination-in';const m=layer.mask;wc.drawImage(atlases.masks,m.x,m.y,m.w,m.h,0,0,TILE,TILE);wc.globalCompositeOperation='source-over';tc.drawImage(working,0,0,TILE,TILE,0,0,TILE,TILE);}return tileWorking;}
 function ensure(frame){
  const grid=terrainGrid(frame),cols=grid.width,rows=grid.height;
  const viewport=frame.viewport|0,key=[grid.x,grid.y,cols,rows,frame.debugScenario?1:0,frame.veiledTileId??frame.veiledTileID??123,...frame.tiles].join(',');if(key===lastKey)return;lastKey=key;lastViewport=viewport;rebuilds++;unknownGround=[];unknownOverlay=[];const seen=new Set(),masks=new Map(),world={x:grid.x*TILE,y:grid.y*TILE},black=[],groundMarks=[];
  if(pw!==cols*TILE||ph!==rows*TILE){pw=cols*TILE;ph=rows*TILE;for(const c of [ground,overlays,working,...classMasks.values()]){c.width=pw;c.height=ph;}}
  gc.globalCompositeOperation='source-over';gc.clearRect(0,0,pw,ph);paintPlane(gc,'rock',world);oc.clearRect(0,0,pw,ph);
  const veiled=frame.veiledTileId??frame.veiledTileID??123;
  for(let row=0;row<rows;row++)for(let column=0;column<cols;column++){
   const p=(row*cols+column)*4,id=frame.tiles[p],overlay=frame.tiles[p+1],house=frame.tiles[p+2],x=column*TILE,y=row*TILE,entry=manifest.tiles[id];seen.add(id);if(overlay)seen.add(overlay);
   if(!terrainCellVisible(frame,row*cols+column)){black.push([x,y]);continue;}
   if(entry){if(entry.base==='black')black.push([x,y]);else if(entry.base!=='rock')addMask(masks,entry.base,x,y);for(const layer of entry.layers)addMask(masks,layer.surface,x,y,layer.mask);if(entry.overlay)groundMarks.push([entry,x,y,house]);}
   else if(!otherOwner.has(id))unknownGround.push(id); // Known building/wall IDs intentionally retain painted rock below new cutouts.
  }
  for(const name of ['sand','rock','dune','mountain','spice','denseSpice','concrete','concreteCracked','rubble','scorch'])if(masks.has(name))paintMasked(gc,name,masks.get(name).canvas,world);
  for(const[entry,x,y,house]of groundMarks)stampOverlay(gc,entry,x,y,house);
  gc.fillStyle='#000';for(const[x,y]of black)gc.fillRect(x,y,TILE,TILE);
  if(!frame.debugScenario)for(let row=0;row<rows;row++)for(let column=0;column<cols;column++){
   const p=(row*cols+column)*4,id=frame.tiles[p+1],house=frame.tiles[p+2],x=column*TILE,y=row*TILE;if(!terrainCellVisible(frame,row*cols+column)){oc.fillStyle='#000';oc.fillRect(x,y,TILE,TILE);continue;}if(!id)continue;const entry=manifest.tiles[id];
   if(entry?.kind==='fog'){const img=fog(id);if(img)oc.drawImage(img,x,y);}
   else if(entry?.overlay)stampOverlay(oc,entry,x,y,house);
   else if(entry)oc.drawImage(standalone(entry,column,row,world),x,y);
   else if(!otherOwner.has(id))unknownOverlay.push(id);
  }
  visibleIDs=[...seen].sort((a,b)=>a-b);
 }
 function draw(ctx,frame,{scale=4,phase='both',x=0,y=40}={}){if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid painted terrain scale');if(!['ground','overlay','both'].includes(phase))throw Error('Unknown terrain layer phase');ensure(frame);const width=pw/SCALE*scale,height=ph/SCALE*scale;ctx.save();ctx.beginPath();ctx.rect(x*scale,y*scale,width,height);ctx.clip();ctx.imageSmoothingEnabled=true;if(phase!=='overlay')ctx.drawImage(ground,x*scale,y*scale,width,height);if(phase!=='ground')ctx.drawImage(overlays,x*scale,y*scale,width,height);ctx.restore();draws++;}
 function diagnostics(){return{ready:true,ownedStates:manifest.coverage.ownedCount,surfaces:Object.keys(textures).length,rebuilds,draws,viewport:lastViewport,gridPixels:[pw,ph],visibleIDs,unknownGroundIDs:[...new Set(unknownGround)],unknownOverlayIDs:[...new Set(unknownOverlay)],worldUV:true,generatedRGBA:true,sourceColourTint:false,cachedClassMaskBytes:classMasks.size*pw*ph*4};}
 return{draw,descriptors:manifest.descriptors,manifest,diagnostics};
}
