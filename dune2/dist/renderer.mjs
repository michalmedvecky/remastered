const TILE=16, MAP={x:0,y:40,w:240,h:160}, MINI={x:255,y:43,w:64,h:64};
const colors={0:'#bd9146',1:'#b18a43',2:'#8c7b53',3:'#655943',8:'#be6e31',9:'#ac4d25',10:'#a19a78'};
export class Renderer {
  constructor(canvas,content){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.content=content;this.images={};this.camera={x:0,y:0};this.hover=null;this.drag=null;this.flash=[];this.lastTick=0;this.ctx.imageSmoothingEnabled=false;}
  async load(){
    const graphics=this.content.graphics??{};
    const urls=new Set([...Object.values(graphics.atlases??{}),...Object.values(graphics.images??{}),...Object.values(graphics.houseAtlases??{}).flatMap(Object.values)].filter(v=>typeof v==='string'));
    await Promise.all([...urls].map(url=>new Promise(resolve=>{const img=new Image();img.onload=()=>{this.images[url]=img;resolve();};img.onerror=resolve;img.src=url;})));
  }
  image(name){return this.images[this.content.graphics?.images?.[name]];}
  frame(sprite){return sprite?this.content.graphics?.frames?.[sprite.atlas]?.[sprite.frame]:null;}
  sprite(ctx,sprite,x,y,house=0,scale=1){
    if(!sprite)return false; const frame=this.frame(sprite),g=this.content.graphics;
    const url=g?.houseAtlases?.[sprite.atlas]?.[house]??g?.atlases?.[sprite.atlas];const img=this.images[url];
    if(!frame||!img)return false;
    ctx.drawImage(img,frame.x,frame.y,frame.w,frame.h,Math.round(x),Math.round(y),Math.round(frame.w*scale),Math.round(frame.h*scale));return true;
  }
  portraitCanvas(entityOrType,kind='unit',house=0){
    const def=typeof entityOrType==='object'&&entityOrType.kind?this.definition(entityOrType):typeof entityOrType==='object'?entityOrType:this.content[kind==='unit'?'units':'structures'].find(d=>d.id===entityOrType);
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    const portrait=def?.portrait_name??def?.portraitName??def?.portrait;
    const ps={atlas:'portraits',frame:typeof portrait==='string'?portrait.toLowerCase():''};
    let frame=this.frame(ps);
    if(!frame&&portrait){ps.frame=String(portrait).toUpperCase();frame=this.frame(ps);}
    if(frame){const scale=Math.min(64/frame.w,48/frame.h);this.sprite(ctx,ps,(64-frame.w*scale)/2,(48-frame.h*scale)/2,house,scale);}
    else if(def?.sprite){frame=this.frame(def.sprite);if(frame){const scale=Math.min(3,54/frame.w,40/frame.h);this.sprite(ctx,def.sprite,(64-frame.w*scale)/2,(48-frame.h*scale)/2,house,scale);}}
    else {ctx.fillStyle='#bfa568';ctx.font='22px Georgia';ctx.textAlign='center';ctx.fillText(def?.name?.slice(0,1)??'?',32,32);}
    return canvas;
  }
  definition(e){return this.content[e.kind==='unit'?'units':'structures'].find(d=>d.id===e.type);}
  center(x,y){this.camera.x=Math.max(0,Math.min(49,Math.floor(x-7.5)));this.camera.y=Math.max(0,Math.min(54,Math.floor(y-5)));}
  pan(dx,dy){this.camera.x=Math.max(0,Math.min(49,this.camera.x+dx));this.camera.y=Math.max(0,Math.min(54,this.camera.y+dy));}
  point(clientX,clientY){const r=this.canvas.getBoundingClientRect();return{x:(clientX-r.left)/r.width*320,y:(clientY-r.top)/r.height*200};}
  worldPoint(p){if(p.x<MAP.x||p.x>=MAP.w||p.y<MAP.y||p.y>=200)return null;return{x:Math.floor(p.x/16)+this.camera.x,y:Math.floor((p.y-40)/16)+this.camera.y};}
  minimapPoint(p){if(p.x<MINI.x||p.x>=MINI.x+64||p.y<MINI.y||p.y>=MINI.y+64)return null;return{x:p.x-MINI.x,y:p.y-MINI.y};}
  entityAt(state,tile){return state.entities.filter(e=>e.hp>0&&(e.house===state.house||state.map.visible[Math.floor(e.x/256)+Math.floor(e.y/256)*64])).reverse().find(e=>{const tx=Math.floor(e.x/256),ty=Math.floor(e.y/256);return e.kind==='structure'?tile.x>=tx&&tile.x<tx+(e.w??this.definition(e)?.width??1)&&tile.y>=ty&&tile.y<ty+(e.h??this.definition(e)?.height??1):tx===tile.x&&ty===tile.y;});}
  draw(state,{selected=[],mode=null,placement=null,message=''}={}){
    const c=this.ctx,g=this.content.graphics??{};c.imageSmoothingEnabled=false;c.fillStyle='#000';c.fillRect(0,0,320,200);
    const screen=this.image('screen');if(screen)c.drawImage(screen,0,0,320,200);
    c.save();c.beginPath();c.rect(0,40,240,160);c.clip();
    const terrain=g.terrain??{};
    for(let vy=0;vy<10;vy++)for(let vx=0;vx<15;vx++){
      const tx=this.camera.x+vx,ty=this.camera.y+vy,id=tx+ty*64,x=vx*16,y=40+vy*16,cl=state.map.terrain[id];
      if(!state.map.seen[id]){c.fillStyle='#090a07';c.fillRect(x,y,16,16);continue;}
      const family=cl===8?'spice':cl===9?'thickSpice':cl===2?'rock':cl===3?'mountain':cl===10?'concrete':cl===1?'dune':'sand';
      const variants=terrain[family]??terrain[family.toLowerCase()]??terrain.sand??[];
      let frame=Array.isArray(variants)?variants[(tx*7+ty*13)%Math.max(1,variants.length)]:variants;
      if(frame&&typeof frame==='object')frame=frame.center??frame.frame;
      // Original ICON.MAP group9 neighbor mask: N1/E2/S4/W8.
      const bases={2:128,1:144,3:160,8:176,9:192};
      if(bases[cl]!==undefined){let mask=0;const connects=v=>cl===2?(v===2||v===3):cl===8?(v===8||v===9):v===cl;for(const [dx,dy,bit]of[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]]){const nx=tx+dx,ny=ty+dy;if(nx<0||nx>=64||ny<0||ny>=64||connects(state.map.terrain[nx+ny*64]))mask|=bit;}frame=bases[cl]+mask;}
      c.fillStyle=colors[cl]??colors[0];c.fillRect(x,y,16,16);
      if(frame!==undefined)this.sprite(c,{atlas:'tiles',frame},x,y,state.house);
      if((state.map.concrete?.[id]??-1)>=0&&cl!==10){c.strokeStyle='#baa777';c.lineWidth=.5;c.strokeRect(x+.5,y+.5,15,15);c.beginPath();c.moveTo(x+8,y);c.lineTo(x+8,y+16);c.moveTo(x,y+8);c.lineTo(x+16,y+8);c.stroke();}
      if(!state.map.visible[id]){c.fillStyle='#0008';c.fillRect(x,y,16,16);}
    }
    const entities=state.entities.filter(e=>e.hp>0).sort((a,b)=>(a.kind==='structure'?0:1)-(b.kind==='structure'?0:1)||a.y-b.y||a.id-b.id);
    for(const e of entities){
      const id=Math.max(0,Math.min(4095,Math.floor(e.x/256)+Math.floor(e.y/256)*64));
      if(e.house!==state.house&&!state.map.visible[id])continue;
      const def=this.definition(e),w=e.w??def?.width??1,h=e.h??def?.height??1;
      let x=(e.x/256-this.camera.x)*16,y=40+(e.y/256-this.camera.y)*16;
      if(x< -80||x>300||y< -40||y>260)continue;
      let sprite=def?.sprite;
      const face=e.orientation!==undefined?(e.orientation&7):Math.floor(((e.facing??0)+16)/32)%8;
      if(def?.spriteFacings?.[face]!==undefined)sprite={...sprite,frame:def.spriteFacings[face]};
      const frame=this.frame(sprite);
      if(e.kind==='structure'){
        x-=8;y-=8;
        if(!this.sprite(c,sprite,x,y,e.house)){c.fillStyle=this.houseColor(e.house);c.fillRect(x+1,y+1,w*16-2,h*16-2);c.strokeStyle='#eed6a0';c.strokeRect(x+3,y+3,w*16-6,h*16-6);}
      }else {
        const sx=x-(frame?.w??12)/2,sy=y-(frame?.h??12)/2;
        const mirror=!!def?.spriteMirrors?.[face];
        if(mirror){c.save();c.translate(Math.round(x),0);c.scale(-1,1);this.sprite(c,sprite,-(frame?.w??12)/2,sy,e.house);c.restore();}
        else if(!this.sprite(c,sprite,sx,sy,e.house)){c.fillStyle=this.houseColor(e.house);c.fillRect(x-4,y-4,8,8);c.strokeStyle='#eee1b9';c.strokeRect(x-4,y-4,8,8);}
        let turret=def?.turretSprite;if(def?.turretFacings?.[face]!==undefined)turret={...turret,frame:def.turretFacings[face]};
        const tf=this.frame(turret);if(tf){if(mirror){c.save();c.translate(Math.round(x),0);c.scale(-1,1);this.sprite(c,turret,-tf.w/2,y-tf.h/2,e.house);c.restore();}else this.sprite(c,turret,x-tf.w/2,y-tf.h/2,e.house);}
      }
      const left=e.kind==='structure'?x:x-8,top=e.kind==='structure'?y:y-8,ww=e.kind==='structure'?w*16:16,hh=e.kind==='structure'?h*16:16;
      if(selected.includes(e.id)){c.strokeStyle=e.house===state.house?'#fff2aa':'#ee785a';c.lineWidth=1;const a=4;c.beginPath();for(const [xx,yy,dx,dy]of[[left,top,1,1],[left+ww,top,-1,1],[left,top+hh,1,-1],[left+ww,top+hh,-1,-1]]){c.moveTo(xx+a*dx,yy);c.lineTo(xx,yy);c.lineTo(xx,yy+a*dy);}c.stroke();}
      if(selected.includes(e.id)||e.hp<e.maxHp){c.fillStyle='#0c1109';c.fillRect(left,top-4,ww,3);c.fillStyle=e.hp/e.maxHp>.5?'#7fbd45':e.hp/e.maxHp>.25?'#e1b849':'#d85339';c.fillRect(left,top-4,Math.max(1,Math.round(ww*e.hp/e.maxHp)),2);}
      if(e.kind==='unit'&&e.type===16&&e.cargo>0){c.fillStyle='#b77337';c.fillRect(left,top+hh+2,Math.round(16*e.cargo/100),1);}
    }
    for(const p of state.projectiles??[]){const x=(p.x/256-this.camera.x)*16,y=40+(p.y/256-this.camera.y)*16;c.fillStyle='#ffe599';c.fillRect(Math.round(x)-1,Math.round(y)-1,2,2);}
    if(this.hover&&placement){const def=this.content.structures.find(d=>d.id===placement.type),w=def?.width??1,h=def?.height??1;const x=(this.hover.x-this.camera.x)*16,y=40+(this.hover.y-this.camera.y)*16;c.fillStyle=placement.valid?'#8be06955':'#f05a4055';c.fillRect(x,y,w*16,h*16);c.strokeStyle=placement.valid?'#a5e578':'#f17c5e';c.strokeRect(x+.5,y+.5,w*16-1,h*16-1);if(def?.sprite){c.globalAlpha=.55;this.sprite(c,def.sprite,x,y,state.house);c.globalAlpha=1;}}
    else if(this.hover&&mode){const x=(this.hover.x-this.camera.x)*16,y=40+(this.hover.y-this.camera.y)*16;c.strokeStyle=mode==='attack'?'#ec7660':'#f1d681';c.strokeRect(x+.5,y+.5,15,15);c.beginPath();c.moveTo(x+8,y+3);c.lineTo(x+8,y+13);c.moveTo(x+3,y+8);c.lineTo(x+13,y+8);c.stroke();}
    if(this.drag){const r=this.drag;c.strokeStyle='#e3d489';c.strokeRect(r.x,r.y,r.w,r.h);c.fillStyle='#eadc9122';c.fillRect(r.x,r.y,r.w,r.h);}
    c.restore();
    this.drawMini(c,state,selected);
    const e=state.entities.find(e=>selected.includes(e.id)&&e.hp>0),house=state.houses.find(h=>h.id===state.house);
    c.fillStyle='#4f2e03';c.fillRect(258,3,59,11);c.font='bold 8px monospace';c.textAlign='right';c.fillStyle='#ffdb5f';c.fillText(String(Math.round(house?.displayCredits??house?.credits??0)).padStart(5,' '),315,12);c.textAlign='left';
    c.fillStyle='#4b3106';c.fillRect(4,23,311,12);c.font='7px monospace';c.fillStyle='#f2cf64';c.fillText((message||this.latestMessage(state)||'Awaiting orders.').slice(0,50),7,31);
    if(e){const def=this.definition(e);const pc=this.portraitCanvas(e);c.drawImage(pc,253,113,64,48);c.font='6px monospace';c.fillStyle='#d8bc78';c.textAlign='center';c.fillText((def?.name??'Object').slice(0,16),285,170);c.fillStyle='#202414';c.fillRect(255,174,60,3);c.fillStyle='#90b352';c.fillRect(255,174,60*e.hp/e.maxHp,3);c.fillStyle='#c1a462';c.font='5px monospace';c.fillText(e.house===state.house?(e.order?.type??e.order?.action??'Awaiting orders').slice(0,19):'ENEMY TARGET',285,186);if(e.cargo)c.fillText(`Cargo ${e.cargo}/100`,285,194);c.textAlign='left';}
    else{c.font='6px monospace';c.textAlign='center';c.fillStyle='#a18e55';c.fillText('SELECT A UNIT',285,134);c.fillText('OR STRUCTURE',285,145);c.fillStyle=this.houseColor(state.house);c.fillRect(276,160,18,3);c.textAlign='left';}
    this.lastTick=state.tick;
  }
  latestMessage(state){return state.events?.filter(e=>e.house===undefined||e.house===state.house).at(-1)?.message??'';}
  houseColor(id){return this.content.houses.find(h=>h.id===id)?.color??['#bc4031','#527ec1','#68a74d','#bb8b5f','#9546a9','#a77b43'][id]??'#c79842';}
  drawMini(c,state,selected){
    c.fillStyle='#11120c';c.fillRect(MINI.x-1,MINI.y-1,66,66);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=x+y*64;c.fillStyle=state.map.seen[i]?(colors[state.map.terrain[i]]??colors[0]):'#0b0e08';c.fillRect(MINI.x+x,MINI.y+y,1,1);}
    for(const e of state.entities){const x=Math.floor(e.x/256),y=Math.floor(e.y/256),i=x+y*64;if(e.hp>0&&(e.house===state.house||state.map.visible[i])){c.fillStyle=this.houseColor(e.house);c.fillRect(MINI.x+x,MINI.y+y,e.kind==='structure'?Math.max(1,e.w??1):1,e.kind==='structure'?Math.max(1,e.h??1):1);}}
    c.strokeStyle='#f3e9c9';c.strokeRect(MINI.x+this.camera.x+.5,MINI.y+this.camera.y+.5,14,9);
  }
  campaign(canvas,campaign,options,selected){
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#15140d';c.fillRect(0,0,640,400);const map=this.image('map');if(map)c.drawImage(map,0,0,640,400);else{const p=this.image('planet');if(p)c.drawImage(p,0,0,640,400);}
    c.fillStyle='#100e0b33';c.fillRect(0,0,640,400);
    for(const o of options){const x=(o.x??o.regionX??80)*2,y=(o.y??o.regionY??65)*2;const on=o.scenarioId===selected;c.beginPath();c.arc(x,y,on?13:9,0,Math.PI*2);c.fillStyle=on?'#f6d791':'#a67d3c';c.fill();c.strokeStyle='#ffffcb';c.lineWidth=2;c.stroke();c.fillStyle='#22180a';c.textAlign='center';c.font='bold 12px monospace';c.fillText(String(o.choice??o.choiceIndex??options.indexOf(o)+1),x,y+4);c.fillStyle='#e7d3a0';c.font='10px monospace';c.fillText(`REGION ${o.region??o.regionId??options.indexOf(o)+1}`,x,y+29);}
    c.textAlign='left';
  }
}
