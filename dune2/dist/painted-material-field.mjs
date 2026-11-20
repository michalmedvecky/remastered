// Continuous cosmetic terrain fields from native ICON identities/topology.
// Original RGB, simulation state and game RNG are never used or modified.
// GPL-2.0-only.
const TILE=16,PAD=4,NOISE_SIZE=512,NOISE_MASK=NOISE_SIZE-1;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mod=(v,n)=>((v%n)+n)%n;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const MATERIALS=['dune','spice','denseSpice'];
let grainNoise=null;

function makeNoise(){
 if(grainNoise)return grainNoise;
 const raw=new Uint8Array(NOISE_SIZE*NOISE_SIZE),soft=new Uint8Array(raw.length),hist=new Uint32Array(256);
 for(let y=0;y<NOISE_SIZE;y++)for(let x=0;x<NOISE_SIZE;x++){
  let n=(Math.imul(x,374761393)+Math.imul(y,668265263)+0x51ed270b)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;raw[y*NOISE_SIZE+x]=n>>>24;
 }
 // Correlate neighbouring samples into small mineral grains, then rank the
 // resulting distribution. The field is periodic in WORLD coordinates.
 for(let y=0;y<NOISE_SIZE;y++)for(let x=0;x<NOISE_SIZE;x++){
  const i=y*NOISE_SIZE+x,v=(raw[i]*4+raw[y*NOISE_SIZE+((x-1)&NOISE_MASK)]+raw[y*NOISE_SIZE+((x+1)&NOISE_MASK)]+raw[((y-1)&NOISE_MASK)*NOISE_SIZE+x]+raw[((y+1)&NOISE_MASK)*NOISE_SIZE+x])>>>3;
  soft[i]=v;hist[v]++;
 }
 const rank=new Uint8Array(256);let sum=0;for(let i=0;i<256;i++){rank[i]=Math.round((sum+hist[i]/2)/soft.length*255);sum+=hist[i];}
 for(let i=0;i<soft.length;i++)soft[i]=rank[soft[i]];
 grainNoise=soft;return soft;
}

function kind(id){return id>=144&&id<=159?'dune':id>=176&&id<=191?'spice':id>=192&&id<=207?'denseSpice':null;}
function bits(id){return id>=144&&id<=159?id-144:id>=176&&id<=191?id-176:id>=192&&id<=207?id-192:0;}
export function isFieldMaterial(id){return kind(id)!==null;}

function envelope(bits,x,y){
 let a=1;
 if(!(bits&1))a*=smooth(0,3.5,y+.5);
 if(!(bits&2))a*=smooth(0,3.5,15.5-x);
 if(!(bits&4))a*=smooth(0,3.5,15.5-y);
 if(!(bits&8))a*=smooth(0,3.5,x+.5);
 return a;
}

export function compileTerrainMaterials(descriptors){
 const records=new Map();
 for(const[idString,row]of Object.entries(descriptors)){
  const id=Number(idString),family=kind(id);if(!family)continue;
  const codes=row.indices??decode(row.indicesBase64),colours=Array.from(codes,c=>row.palette?.[c]??c);
  const material={id,family,bits:bits(id),dune:new Float32Array(256),spice:new Float32Array(256),denseSpice:new Float32Array(256)};
  for(let p=0;p<256;p++){
   const x=p&15,y=p>>>4,c=colours[p],e=envelope(material.bits,x,y);
   // 88/92 are genuine dune ridge inks, absent from ordinary sand127. A
   // same-position difference against sand127 instead measures unrelated grain.
   if(family==='dune')material.dune[p]=(c===88||c===92?1:0)*e;
   else{
    // Dense ICONs are already based on normal spice. Their cardinal bits
    // describe only the dark mineral component, not the underlying spice.
    material.spice[p]=(c>=216&&c<=220?1:0)*(family==='denseSpice'?1:e);
    if(family==='denseSpice')material.denseSpice[p]=(c===219||c===220?1:0)*e;
   }
  }
  records.set(id,material);
 }
 for(const id of [159,191,207])if(!records.has(id))throw Error('Missing native material endpoint '+id);
 return{records,noise:makeNoise()};
}

function blur(source,w,h){
 const temp=new Float32Array(source.length),out=new Float32Array(source.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)temp[y*w+x]=(source[y*w+Math.max(0,x-1)]+source[y*w+x]+source[y*w+Math.min(w-1,x+1)])/3;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)out[y*w+x]=(temp[Math.max(0,y-1)*w+x]+temp[y*w+x]+temp[Math.min(h-1,y+1)*w+x])/3;
 return out;
}
const interpolationAxes=new Map();
function interpolationAxis(size,scale){
 const key=size+':'+scale;if(interpolationAxes.has(key))return interpolationAxes.get(key);
 const left=new Uint16Array(size*scale),right=new Uint16Array(left.length),fraction=new Float32Array(left.length);
 for(let p=0;p<left.length;p++){const v=clamp((p+.5)/scale-.5,0,size-1);left[p]=Math.floor(v);right[p]=Math.min(size-1,left[p]+1);fraction[p]=v-left[p];}
 const axis={left,right,fraction};interpolationAxes.set(key,axis);if(interpolationAxes.size>8)interpolationAxes.delete(interpolationAxes.keys().next().value);return axis;
}

/** The renderer supplies the current committed grid, including its fringe.
 * One global feather replaces tile-local closing/edge clamping. At the outer
 * buffer only, the actual native connection bit may extend a canonical grain
 * sample; this reads no additional map state and reveals no hidden tile data.
 */
export function buildTerrainMaterialField(frame,compiled,{maskScale=2}={}){
 const g=frame.grid??{x:frame.viewport&63,y:frame.viewport>>>6,width:15,height:10};
 if(!Number.isInteger(maskScale)||maskScale<1||maskScale>4||frame.tiles?.length!==g.width*g.height*4)throw Error('Invalid material field grid');
 const w=g.width*TILE,h=g.height*TILE,records=new Array(g.width*g.height),visible=new Uint8Array(records.length),active=new Set();
 const veil=frame.veiledTileId??frame.veiledTileID??123;
 for(let i=0;i<records.length;i++){
  const p=i*4,ground=frame.tiles[p],overlay=frame.tiles[p+1],id=isFieldMaterial(overlay)?overlay:ground;
  visible[i]=Number(!!frame.debugScenario||!!frame.tiles[p+3]&&overlay!==veil);
  const row=visible[i]?compiled.records.get(id):null;records[i]=row;
  if(row){active.add(row.family==='dune'?'dune':'spice');if(row.family==='denseSpice')active.add('denseSpice');}
 }
 if(!active.size)return{active:false,width:w,height:h,maskScale,masks:{},fields:{},worldX:g.x*TILE,worldY:g.y*TILE,stats:{}};
 const pw=w+PAD*2,ph=h+PAD*2,planes=Object.fromEntries([...active].map(name=>[name,new Float32Array(pw*ph)])),planeEntries=Object.entries(planes);
 for(let yy=-PAD;yy<h+PAD;yy++)for(let xx=-PAD;xx<w+PAD;xx++){
  const cx=clamp(Math.floor(xx/TILE),0,g.width-1),cy=clamp(Math.floor(yy/TILE),0,g.height-1),row=records[cy*g.width+cx];if(!row)continue;
  const lp=mod(yy,TILE)*TILE+mod(xx,TILE),p=(yy+PAD)*pw+xx+PAD;
  const outside=xx<0||xx>=w||yy<0||yy>=h;
  const required=(yy<0?1:0)|(xx>=w?2:0)|(yy>=h?4:0)|(xx<0?8:0);
  for(const[name,plane]of planeEntries){
   let src=row;
   if(outside){
    const connection=name==='spice'&&row.family==='denseSpice'?15:row.bits;
    if((connection&required)!==required)continue;
    if(name==='dune'&&row.family==='dune')src=compiled.records.get(159);
    else if(name==='spice'&&row.family!=='dune')src=compiled.records.get(row.family==='denseSpice'&&(row.bits&required)===required?207:191);
    else if(name==='denseSpice'&&row.family==='denseSpice')src=compiled.records.get(207);
    else continue;
   }
   plane[p]=src[name][lp];
  }
 }
 const fields={},masks={},stats={},mw=w*maskScale,mh=h*maskScale,noise=compiled.noise,ax=interpolationAxis(w,maskScale),ay=interpolationAxis(h,maskScale),span=TILE*maskScale;
 for(const[name,raw]of planeEntries){
  const feather=blur(blur(raw,pw,ph),pw,ph),field=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const row=records[(y>>>4)*g.width+(x>>>4)],allowed=row&&(name==='dune'?row.family==='dune':name==='spice'?row.family!=='dune':row.family==='denseSpice');
   if(allowed)field[y*w+x]=feather[(y+PAD)*pw+x+PAD];
  }
  const alpha=new Uint8ClampedArray(mw*mh);let sum=0,max=0,low=0;
  const shift=name==='denseSpice'?173:0,worldBaseX=g.x*TILE*maskScale+shift*3,worldBaseY=g.y*TILE*maskScale+shift;
  const factor=name==='denseSpice'?1.12:.76,cap=name==='denseSpice'?.65:.8,strength=name==='denseSpice'?.82:.73;
  for(let y=0;y<mh;y++){
   const y0=ay.left[y]*w,y1=ay.right[y]*w,fy=ay.fraction[y],rowStart=Math.floor(y/span)*g.width,outY=y*mw,noiseY=((worldBaseY+y)&NOISE_MASK)*NOISE_SIZE;
   for(let cellX=0;cellX<g.width;cellX++){
    const row=records[rowStart+cellX],allowed=row&&(name==='dune'?row.family==='dune':name==='spice'?row.family!=='dune':row.family==='denseSpice');
    if(!allowed){low+=span;continue;}
    for(let x=cellX*span,end=x+span;x<end;x++){
     const l=ax.left[x],r=ax.right[x],fx=ax.fraction[x],a=field[y0+l]+(field[y0+r]-field[y0+l])*fx,b=field[y1+l]+(field[y1+r]-field[y1+l])*fx,density=a+(b-a)*fy;
     let opacity;
     if(name==='dune')opacity=Math.min(1,density*2.3)*.48;
     else{
      const coverage=Math.min(cap,density*factor),grain=noise[noiseY+((worldBaseX+x)&NOISE_MASK)]/255,t=(grain-coverage+.055)/.11;
      const mineral=t<=0?1:t>=1?0:1-t*t*(3-2*t);
      // Fine newly coloured grains retain the continuous sand underneath.
      opacity=(mineral*strength+coverage*.025)*Math.min(1,density*7);
     }
     const value=Math.round(opacity*255);alpha[outY+x]=value;sum+=value;if(value>max)max=value;if(value<24)low++;
    }
   }
  }
  fields[name]=field;masks[name]={width:mw,height:mh,alpha};stats[name]={meanOpacity:sum/alpha.length/255,maxOpacity:max/255,lowOpacityPixels:low,samples:alpha.length};
 }
 return{active:true,width:w,height:h,maskScale,masks,fields,worldX:g.x*TILE,worldY:g.y*TILE,stats};
}
