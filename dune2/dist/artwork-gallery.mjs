// Production-art inspection only. No WASM, game simulation or persistent storage.
// GPL-2.0-only; model artwork provenance accompanies the matching source archive.
import {recolourPainted} from './painted-core.mjs';
const $=id=>document.getElementById(id),root=$('art-gallery'),status=$('gallery-status');
const state={ready:false,house:1,unitTypes:0,structureTypes:0,worldFrames:0,terrainSurfaces:0,frameCards:0,animate:false,magnifyUnits:true,errors:[]};
const publish=()=>{root.dataset.galleryState=JSON.stringify(state);};
const report=error=>{state.errors.push(String(error.message??error));publish();status.classList.add('error');status.textContent='The artwork could not be loaded. Reload this page to try again.';console.error('Artwork gallery:',error);};
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const loadJSON=async name=>{const response=await fetch(new URL('./painted/'+name+'.json',import.meta.url));if(!response.ok)throw Error('Artwork manifest unavailable: '+name);return response.json();};
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Artwork atlas unavailable: '+src));image.src=new URL('./'+src,import.meta.url).href;});
const compass=['North','North-east','East','South-east','South','South-west','West','North-west'];
const surfaceNames={sand:'Sand',dune:'Dunes',rock:'Basalt rock',mountain:'Rock ridges',spice:'Spice',denseSpice:'Dense spice',concrete:'Concrete',concreteCracked:'Broken concrete',rubble:'Rubble',scorch:'Scorched ground'};
const structureNames=['Concrete slab','Concrete foundation','Palace','Light Factory','Heavy Factory','Hi-Tech Factory','IX Research Centre','WOR Trooper Facility','Construction Yard','Windtrap','Barracks','Starport','Spice Refinery','Repair Centre','Defensive Wall','Gun Turret','Rocket Turret','Spice Silos','Radar Outpost'];
const unitNames={20:'Turret Rocket',21:'Deviator Rocket',22:'Trooper Rocket'};
const groupNames={'hulls':'Tracked hull','turrets':'Tank turret','special-turrets':'Special turret','fire-dust':'Fire and dust','native-distortion-or-bullet-mask':'Analytic effect','wrecks':'Vehicle wreck','smoke-small-explosions':'Smoke and small blast','explosions-a':'Explosion','explosions-b':'Explosion','gas-worm':'Gas and worm effect','explicit-native-empty':'Empty native slot','harvest-spray':'Harvesting spray','light-vehicles':'Light vehicle','quad-south-four-wheel-correction':'Quad','accepted-pilot':'Trike','utility':'Utility vehicle','rockets':'Rocket','mini-deathhand':'Missile','carryall-frigate':'Aircraft','ornithopter':'Ornithopter','saboteur':'Saboteur','soldier':'Soldier','trooper':'Trooper','infantry-squad':'Infantry squad','trooper-squad':'Trooper squad'};
let units,buildings,terrain,native,palette6,phase=0,animationTick=0,lastTick=0;
const images=new Map(),rawImages=new Map(),variants=new Map(),nativeRows=new Map(),housePaint=new Map(),tileImages=new Map(),maskOutlines=new Map();
const unitCards=[],structureCards=[];

function sourceFor(kind,id){const key=kind+':'+id;if(nativeRows.has(key))return nativeRows.get(key);const value=native.frames[kind]?.[id];if(!value)return null;const row={...value,indices:decode(value.indicesBase64),mask:decode(value.maskBase64)};nativeRows.set(key,row);return row;}
function hasFaction(kind,id){const key=kind+':'+id;if(housePaint.has(key))return housePaint.get(key);const src=sourceFor(kind,id),last=kind==='tiles'?159:152;let found=false;if(src?.paletteMode==='local16'&&src.palette)for(let i=0;i<src.indices.length;i++){const c=src.palette[src.indices[i]];if(src.mask[i]&&c>=144&&c<=last){found=true;break;}}housePaint.set(key,found);return found;}
function artImage(kind,id){
 const bank=kind==='unit'?units:buildings,art=(kind==='unit'?bank.frames:bank.tiles)[id];if(!art)throw Error('Missing painted '+kind+' '+id);
 const key=kind+':'+id;let canvas=rawImages.get(key);
 if(!canvas){const rect=art.rect??[art.x,art.y,art.w,art.h],atlas=images.get(kind+':'+art.atlas);if(!atlas)throw Error('Missing atlas '+art.atlas);canvas=surface(rect[2],rect[3]);canvas.getContext('2d').drawImage(atlas,...rect,0,0,rect[2],rect[3]);rawImages.set(key,canvas);}
 if(kind==='unit'&&id>=159&&id<=161){
  if(maskOutlines.has(id))return maskOutlines.get(id);const outline=surface(canvas.width,canvas.height),ctx=outline.getContext('2d'),source=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),data=ctx.createImageData(canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const p=(y*canvas.width+x)*4,a=source.data[p+3];let edge=0;for(const[dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy,other=xx<0||yy<0||xx>=canvas.width||yy>=canvas.height?0:source.data[(yy*canvas.width+xx)*4+3];edge=Math.max(edge,Math.abs(a-other));}if(edge){data.data[p]=138;data.data[p+1]=204;data.data[p+2]=212;data.data[p+3]=Math.min(255,edge*2);}}
  ctx.putImageData(data,0,0);maskOutlines.set(id,outline);return outline;
 }
 if(state.house===1||!hasFaction(kind==='unit'?'units':'tiles',id))return canvas;
 const tintKey=key+':'+state.house;if(variants.has(tintKey))return variants.get(tintKey);
 const tinted=surface(canvas.width,canvas.height),ctx=tinted.getContext('2d');ctx.drawImage(canvas,0,0);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height);rgba.data.set(recolourPainted(rgba.data,palette6,state.house));ctx.putImageData(rgba,0,0);variants.set(tintKey,tinted);return tinted;
}
function card(name,badge,{small=false}={}){
 const figure=document.createElement('figure');figure.className='art-card';const well=document.createElement('div');well.className='art-stage';const canvas=surface(small?128:256,small?128:256);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',name+' artwork');well.append(canvas);const caption=document.createElement('figcaption');caption.className='art-caption';const top=document.createElement('div');top.className='caption-top';const title=document.createElement('h3');title.textContent=name;const tag=document.createElement('span');tag.className='badge';tag.textContent=badge;top.append(title,tag);const note=document.createElement('p');note.className='caption-note';caption.append(top,note);figure.append(well,caption);return{figure,canvas,caption,note};
}
function sprite(ctx,id,x,y,{flipX=false,flipY=false}={}){const frame=units.frames[id];if(!frame)throw Error('Missing unit frame '+id);const image=artImage('unit',id),pivot=frame.pivot??[frame.sourceW/2,frame.sourceH/2];ctx.save();ctx.translate(x,y);ctx.scale(flipX?-1:1,flipY?-1:1);ctx.drawImage(image,-pivot[0]*4,-pivot[1]*4);ctx.restore();}
function unitPose(binding){
 const mode=binding.displayMode,n=state.animate?phase:0;
 if(mode==='DISPLAYMODE_INFANTRY_3_FRAMES')return{id:binding.groundSpriteID+[0,1,0,2][n%4],direction:0};
 if(mode==='DISPLAYMODE_INFANTRY_4_FRAMES')return{id:binding.groundSpriteID+n%4,direction:0};
 if(mode==='DISPLAYMODE_ORNITHOPTER')return{id:binding.groundSpriteID+[2,1,0,1][n%4],direction:0};
 if(binding.type===25)return{id:218+n%5,direction:0,surfaceEffect:true};
 if(mode==='DISPLAYMODE_SINGLE_FRAME')return{id:binding.groundSpriteID,direction:0};
 const count=binding.movementType==='MOVEMENT_WINGER'&&mode==='DISPLAYMODE_UNIT'?3:5,direction=n%count;
 return{id:binding.groundSpriteID+direction,direction};
}
function turretOffset(id,dir){if(id===141)return[0,-2];if(id===146)return[0,-3];if(id===126)return[[0,-5],[0,-5],[2,-3],[2,-1],[-1,-3],[-2,-1],[-2,-3],[-1,-5]][dir];if(id===136)return[[0,-4],[-1,-3],[2,-4],[0,-3],[-1,-3],[0,-3],[-2,-4],[1,-3]][dir];return[0,0];}
function drawUnit(item){
 const {binding,canvas}=item,ctx=canvas.getContext('2d'),pose=unitPose(binding);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(128,128);ctx.scale(state.magnifyUnits?2:1,state.magnifyUnits?2:1);sprite(ctx,pose.id,0,0);
 let facing=pose.direction;
 if(binding.turretSpriteID>=0){facing=item.turretFacing??pose.direction;const offsets=[0,1,2,3,4,3,2,1],offset=turretOffset(binding.turretSpriteID,facing);sprite(ctx,binding.turretSpriteID+offsets[facing],offset[0]*4,offset[1]*4,{flipX:facing>4});}
 ctx.restore();item.phaseLabel.textContent=binding.type===25?'Surface / swallow artwork':binding.turretSpriteID>=0?'Turret: '+compass[facing]:state.animate?'Cycling stored art states':'Default artwork';
}
function paintSurface(ctx,name,x,y,column=0,row=0){const rect=terrain.surfaces[name];if(!rect)throw Error('Missing terrain surface '+name);const uvx=(column*64)%rect.w,uvy=(row*64)%rect.h;ctx.drawImage(images.get('terrain:surfaces'),rect.x+uvx,rect.y+uvy,64,64,x,y,64,64);}
function groundTile(id,column,row){
 const key=id+':'+column+':'+row+':'+state.house;if(tileImages.has(key))return tileImages.get(key);const entry=terrain.tiles[id];if(!entry)throw Error('Missing shared terrain tile '+id);const canvas=surface(64,64),ctx=canvas.getContext('2d');
 if(entry.base==='black'){ctx.fillStyle='#000';ctx.fillRect(0,0,64,64);}else paintSurface(ctx,entry.base??'rock',0,0,column,row);
 for(const layer of entry.layers??[]){const mask=surface(64,64),mc=mask.getContext('2d');paintSurface(mc,layer.surface,0,0,column,row);mc.globalCompositeOperation='destination-in';const r=layer.mask;mc.drawImage(images.get('terrain:masks'),r.x,r.y,r.w,r.h,0,0,64,64);ctx.drawImage(mask,0,0);}
 if(entry.overlay){const r=entry.overlay.variants[state.house]??entry.overlay.variants[0];if(r)ctx.drawImage(images.get('terrain:overlays'),r.x,r.y,r.w,r.h,0,0,64,64);}
 tileImages.set(key,canvas);return canvas;
}
function structurePhase(item){return state.animate?phase%item.row.states.length:Math.min(2,item.row.states.length-1);}
function drawStructure(item){
 const s=item.row,index=structurePhase(item),record=s.states[index],ctx=item.canvas.getContext('2d'),cols=s.width/16,rows=s.height/16;ctx.clearRect(0,0,256,256);const x=(256-s.width*4)/2,y=(256-s.height*4)/2;
 for(let i=0;i<cols*rows;i++){const id=record.tileIds[i]??record.tileIds[0],col=i%cols,row=Math.floor(i/cols),image=buildings.tiles[id]?artImage('building',id):groundTile(id,col,row);ctx.drawImage(image,x+col*64,y+row*64);}
 item.phaseLabel.textContent=item.type===14?'Connection '+(index+1)+' / '+s.states.length:item.type<2?['Partial slab','Rubble','Intact slab'][index]:[15,16].includes(item.type)&&index>=2?compass[index-2]:index===0?'Construction':index===1?'Rubble':'Active state '+(index-1);
}
function drawAll({refreshFrames=true}={}){for(const item of unitCards)drawUnit(item);for(const item of structureCards)drawStructure(item);if(refreshFrames&&$('frame-bank').open)drawFrameBank();publish();}
function populateUnits(){
 for(const binding of units.unitBindings){const effect=units.frames[binding.groundSpriteID]?.status==='procedural-effect',weapon=binding.type>=18&&binding.type<=24,name=unitNames[binding.type]??binding.name;const item=card(name,binding.type===25?'Surface effect':binding.type===24?'Mask outline':effect?'Analytic projectile':weapon?'Projectile':binding.movementType==='MOVEMENT_WINGER'?'Aircraft':'Unit');item.binding=binding;item.figure.dataset.unitType=String(binding.type);item.figure.dataset.nativeName=binding.name;
  item.note.textContent=binding.type===25?'Painted surface / swallow poses. Submerged movement is a native destination distortion.':binding.type===24?'Destination-effect mask outline only. The live engine supplies the sonic distortion.':effect?'Small projectile drawn analytically within its native sprite bounds.':binding.type===8?'Shares launcher artwork; the hull and turret remain independent layers.':binding.turretSpriteID>=0?'Native hull and independent turret, with recovered attachment offsets.':binding.type===14?'The Raider uses the native Trike artwork.':'Original pose proportions with new painted contours and shading.';
  const actions=document.createElement('div');actions.className='card-actions';item.phaseLabel=document.createElement('span');item.phaseLabel.className='phase-label';
  if(binding.turretSpriteID>=0){const button=document.createElement('button');button.textContent='Turn turret';button.setAttribute('aria-label','Turn '+name+' turret');button.addEventListener('click',()=>{item.turretFacing=((item.turretFacing??unitPose(binding).direction)+1)%8;drawUnit(item);publish();});actions.append(button);}
  actions.append(item.phaseLabel);item.caption.append(actions);$('unit-grid').append(item.figure);unitCards.push(item);
 }
}
function populateStructures(){
 for(const[type,row]of Object.entries(buildings.structures)){const id=Number(type),item=card(structureNames[id]??row.name,id===14?'Wall':id<2?'Foundation':[15,16].includes(id)?'Defence':'Building');item.type=id;item.row=row;item.figure.dataset.structureType=type;item.figure.dataset.nativeName=row.name;item.note.textContent=(row.width/16)+' × '+(row.height/16)+' native tile footprint. '+(id<2?'Painted ground states.':id===14?'All saved native connection shapes.':'Canonical pieces from the production building bank.');item.phaseLabel=document.createElement('span');item.phaseLabel.className='phase-label';const actions=document.createElement('div');actions.className='card-actions';actions.append(item.phaseLabel);item.caption.append(actions);$('structure-grid').append(item.figure);structureCards.push(item);}
}
function populateSurfaces(){for(const[name,rect]of Object.entries(terrain.surfaces)){const item=card(surfaceNames[name]??name,'Terrain');item.figure.dataset.surface=name;item.canvas.width=rect.w;item.canvas.height=rect.h;item.canvas.getContext('2d').drawImage(images.get('terrain:surfaces'),rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);item.note.textContent='Continuous painted ground plane. No faction recolouring.';$('surface-grid').append(item.figure);}}
const frameCards=[];
function drawFrameBank(){
 if(!frameCards.length)for(const[id,frame]of Object.entries(units.frames)){const distortion=Number(id)>=159&&Number(id)<=161,label=distortion?'Distortion mask':Number(id)===353?'Special native shape':groupNames[frame.evidence?.group]??'Painted sprite',badge=distortion?'Outline':frame.status==='native-empty'?'Empty':frame.status==='procedural-effect'?'Analytic':'Painted',item=card(label,badge,{small:true});item.id=Number(id);item.figure.dataset.spriteFrame=id;item.note.textContent='Native frame '+id+(distortion?' · mask outline, not a body':frame.status==='native-empty'?' · explicitly empty':frame.status==='procedural-effect'?' · derived effect':'');$('frame-grid').append(item.figure);frameCards.push(item);}
 for(const item of frameCards){const ctx=item.canvas.getContext('2d');ctx.clearRect(0,0,128,128);sprite(ctx,item.id,64,64);}
 state.frameCards=frameCards.length;
}
async function start(){
 [units,buildings,terrain,native]=await Promise.all(['units','buildings','terrain','native'].map(loadJSON));if(units.unitBindings.length!==27||Object.keys(buildings.structures).length!==19||Object.keys(units.frames).length!==244||Object.keys(terrain.surfaces).length!==10)throw Error('Unexpected artwork coverage');
 palette6=Uint8Array.from(native.palette,v=>Math.round(v*16/65));if(palette6.length!==768)throw Error('Invalid original colour palette');
 const requests=[];for(const[kind,bank]of [['unit',units],['building',buildings]])for(const[id,atlas]of Object.entries(bank.atlases))requests.push(loadImage(atlas.src).then(image=>images.set(kind+':'+id,image)));for(const[id,atlas]of Object.entries(terrain.assets))requests.push(loadImage(atlas.src).then(image=>images.set('terrain:'+id,image)));await Promise.all(requests);
 populateUnits();populateStructures();populateSurfaces();state.unitTypes=unitCards.length;state.structureTypes=structureCards.length;state.worldFrames=Object.keys(units.frames).length;state.terrainSurfaces=Object.keys(terrain.surfaces).length;state.atlases=images.size;drawAll();state.ready=true;for(const id of ['gallery-house','gallery-animate','gallery-magnify'])$(id).disabled=false;root.classList.remove('loading');status.textContent='Production artwork loaded. Choose a faction or cycle the saved states.';publish();
 $('gallery-house').addEventListener('change',event=>{state.house=Number(event.target.value);variants.clear();tileImages.clear();try{drawAll();}catch(error){report(error);}});
 $('gallery-animate').addEventListener('change',event=>{state.animate=event.target.checked;phase=0;lastTick=performance.now();try{drawAll();}catch(error){report(error);}});
 $('gallery-magnify').addEventListener('change',event=>{state.magnifyUnits=event.target.checked;try{drawAll();}catch(error){report(error);}});
 $('frame-bank').addEventListener('toggle',()=>{if($('frame-bank').open)try{drawFrameBank();publish();}catch(error){report(error);}});
 document.addEventListener('visibilitychange',()=>{lastTick=performance.now();});
 const tick=now=>{if(state.animate&&!document.hidden&&now-lastTick>=500){phase++;lastTick=now;animationTick++;state.inspectionSteps=animationTick;try{drawAll({refreshFrames:false});}catch(error){report(error);state.animate=false;$('gallery-animate').checked=false;}}requestAnimationFrame(tick);};requestAnimationFrame(tick);
}
start().catch(report);
