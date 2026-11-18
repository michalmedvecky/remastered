/* Dune II V1.07 source-bound landscape reconstruction, 2026-11-18.
 * Based on supplied executable 0x75f00 and GPL-2.0 OpenDUNE Map_CreateLandscape
 * (commit ebea79aeba025be2fe9004570e9255044aacc0be). See fidelity/terrain.
 * Native SAR rounding at 0x1d65a takes precedence over OpenDUNE C division.
 * No original DOS execution is implied by this implementation or its C oracle.
 */
import {AROUND,OFFSETS,STEPX,STEPY,LANDSCAPESPRITEMAP,MAPINFOS,CANBECOMESPICE} from './terrain-tables.mjs';

export const LANDSCAPE_SIZE=64;
const CELLS=4096;
const u16=value=>value&65535;
const pack=(x,y)=>u16(x|(y<<6));
const out=packed=>(packed&0xf000)!==0;
const center=tile=>({x:(tile.x&0xff00)|128,y:(tile.y&0xff00)|128});
const unpack=packed=>({x:((packed&63)<<8)|128,y:(((packed>>6)&63)<<8)|128});
const packPosition=tile=>u16((tile.x>>8)|((tile.y>>8)<<6));
const engineClass=type=>type===2||type===3?1:type===1||type===4||type===5?2:type===6||type===7?3:type;

export function seedLandscapeRandom(seed){return{bytes:[seed&255,(seed>>>8)&255,(seed>>>16)&255,(seed>>>24)&255],draws:0};}
export function landscapeRandom256(random){
  let[a,b,c]=random.bytes;
  const shifted=a>>>2,carry=(a>>>1)&1,oldC=c;
  c=((c<<1)|carry)&255;
  const oldB=b;b=((b<<1)|(oldC>>>7))&255;
  const feedback=(shifted-a-(1-(oldB>>>7)))&255;
  a=(a>>>1)|((feedback&1)<<7);
  random.bytes[0]=a;random.bytes[1]=b;random.bytes[2]=c;random.draws++;
  return a^b;
}
export function moveByLandscapeRandom(tile,distance,random){
  if(distance===0)return{...tile};
  let amount=landscapeRandom256(random);while(amount>distance)amount>>>=1;
  const orientation=landscapeRandom256(random);
  // Native bytes use IMUL followed by SAR 7, including NEG before Y multiply.
  const x=u16(tile.x+((STEPX[orientation]*amount)>>7)*16);
  const y=u16(tile.y+((-STEPY[orientation]*amount)>>7)*16);
  if(x>16384||y>16384)return{...tile};
  return center({x,y});
}
function createSpice(types,packed){
  if(types[packed]===8){types[packed]=9;createSpice(types,packed);return;}
  if(types[packed]===9){
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
      const next=pack((packed&63)+x,((packed>>>6)&63)+y);if(out(next))continue;
      if(!CANBECOMESPICE[types[next]])types[packed]=8;
      else if(types[next]!==9)types[next]=8;
    }
  }else if(CANBECOMESPICE[types[packed]])types[packed]=8;
}
function iconOffsets(types){
  const result=Array(CELLS).fill(0);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const i=x+y*64,t=types[i],n=y===0?t:types[i-64],e=x===63?t:types[i+1],s=y===63?t:types[i+64],w=x===0?t:types[i-1];
    const connects=v=>v===t||(t===4&&v===6)||(t===8&&v===9);
    let mask=(connects(n)?1:0)|(connects(e)?2:0)|(connects(s)?4:0)|(connects(w)?8:0);
    if(t===0)mask=0;else mask+=t===4?1:t===2?17:t===6?33:t===8?49:t===9?65:0;
    result[i]=mask;
  }
  return result;
}
export function mapInfo(scale=0){const index=Math.max(0,Math.min(2,Math.trunc(scale)));const a=MAPINFOS.slice(index*4,index*4+4);return{minX:a[0],minY:a[1],sizeX:a[2],sizeY:a[3]};}
export function isValidMapTile(tile,scale=0){if(!Number.isInteger(tile)||tile<0||tile>=4096)return false;const p=mapInfo(scale),x=tile&63,y=(tile>>>6)&63;return x>=p.minX&&x<p.minX+p.sizeX&&y>=p.minY&&y<p.minY+p.sizeY;}
export function generateLandscape(seed,{iconMap=null}={}){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Landscape seed must be an unsigned 32-bit integer.');
  const random=seedLandscapeRandom(seed),next=()=>landscapeRandom256(random),memory=Array(273).fill(0),types=Array(CELLS).fill(0);
  for(let i=0;i<272;i++)memory[i]=Math.min(next()&15,10);
  for(let count=(next()&15)+1;count>0;count--){const base=next();for(const delta of AROUND){const i=Math.max(0,Math.min(272,base+delta));memory[i]=(memory[i]+(next()&15))&15;}}
  for(let count=(next()&3)+1;count>0;count--){const base=next();for(const delta of AROUND)memory[Math.max(0,Math.min(272,base+delta))]=next()&3;}
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)types[pack(x*4,y*4)]=memory[y*16+x];
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)for(let k=0;k<21;k++){
    const at=((x+1)%2*21+k)*4,[x1,y1,x2,y2]=OFFSETS.slice(at,at+4);
    const p1=pack(x*4+x1,y*4+y1),p2=pack(x*4+x2,y*4+y2),middle=(p1+p2)>>>1;if(out(middle))continue;
    const a=pack((x*4+x1)&63,y*4+y1),b=pack((x*4+x2)&63,y*4+y2);
    // The original accesses one row beyond map storage. Its cleared-memory
    // value is modeled explicitly as zero, matching OpenDUNE's original-map fix.
    types[middle]=((types[a]??0)+(types[b]??0)+1)>>>1;
  }
  let current=Array(64).fill(0),previous;
  for(let y=0;y<64;y++){
    previous=current;current=types.slice(y*64,y*64+64);
    for(let x=0;x<64;x++){
      const middle=current[x];let total=middle;
      total+=(x===0||y===0)?middle:previous[x-1];
      total+=y===0?middle:previous[x];
      total+=(x===63||y===0)?middle:previous[x+1];
      total+=x===0?middle:current[x-1];total+=x===63?middle:current[x+1];
      total+=(x===0||y===63)?middle:types[y*64+x+63];
      total+=y===63?middle:types[y*64+x+64];
      total+=(x===63||y===63)?middle:types[y*64+x+65];
      types[x+y*64]=Math.floor(total/9);
    }
  }
  const rockThreshold=Math.max(8,Math.min(12,next()&15));let duneThreshold=((next()&3)-1)&65535;
  if(duneThreshold>rockThreshold-3)duneThreshold=rockThreshold-3;
  for(let i=0;i<CELLS;i++){const n=types[i];types[i]=n>rockThreshold+4?6:n>=rockThreshold?4:n<=duneThreshold?2:0;}
  const spiceGroups=next()&47;
  for(let count=spiceGroups;count>0;count--){
    let packed;
    do{const y=next()&63;packed=pack(next()&63,y);}while(!CANBECOMESPICE[types[packed]]);
    const origin=unpack(packed);
    for(let amount=next()&31;amount>0;amount--){
      do{packed=packPosition(moveByLandscapeRandom(origin,next()&63,random));}while(out(packed));
      createSpice(types,packed);
    }
  }
  const offsets=iconOffsets(types),group=iconMap?.[9]??154;
  const tileIds=offsets.map(value=>iconMap?(iconMap[group+value]&511):127+value);
  const landscapeTypes=tileIds.map(id=>id>=127&&id<=209?LANDSCAPESPRITEMAP[id-127]:4);
  return{seed,nativeTypes:types,landscapeTypes,engineClasses:landscapeTypes.map(engineClass),iconOffsets:offsets,tileIds,
    baselineTileIds:tileIds.slice(),blooms:Array(CELLS).fill(0),specials:Array(CELLS).fill(0),
    random,thresholds:{rock:rockThreshold,dune:duneThreshold},spiceGroups,
    fidelity:{algorithm:'native-source-verified',rounding:'V1.07-SAR',outOfMapInterpolation:'zero-cleared-memory-model',nativeRuntimeComparison:false}};
}
// Static ground-icon branches of native Map_GetLandscapeType. The full C core
// additionally resolves overlay flags and object-pool occupancy.
export function landscapeTypeForIcon(icon){if(icon===126)return 10;if(icon===208||icon===209)return 14;if(icon>33&&icon<108)return 11;return icon>=127&&icon<=209?LANDSCAPESPRITEMAP[icon-127]:4;}
function changeSpice(landscape,packed,direction){
  if(packed<0||packed>=4096||direction===0)return;
  const type=landscapeTypeForIcon(landscape.tileIds[packed]);
  if(type===9&&direction>0||type!==8&&type!==9&&direction<0||![0,2,8].includes(type)&&direction>0)return;
  const result=direction>0?(type===8?9:8):(type===9?8:0);
  landscape.tileIds[packed]=result===8?176:result===9?192:127;
  landscape.baselineTileIds[packed]=0x8000|landscape.tileIds[packed];
  for(const delta of [0,1,-1,-64,64])fixSpiceEdge(landscape,u16(packed+delta)&4095);
}
function fixSpiceEdge(landscape,packed){
  const type=landscapeTypeForIcon(landscape.tileIds[packed]);if(type!==8&&type!==9)return;
  let mask=0;
  for(const [i,delta]of [-64,1,64,-1].entries()){
    // Original 0x7a086 checks already-masked X/Y against 64; that branch
    // cannot fire. Reading a missing neighbor models cleared surrounding
    // storage as icon zero (= rock), rather than OpenDUNE's connected edge.
    const p=u16(packed+delta),neighbor=landscapeTypeForIcon(landscape.tileIds[p]);
    if(type===8?(neighbor===8||neighbor===9):neighbor===9)mask|=1<<i;
  }
  const id=(type===8?176:192)+mask;landscape.tileIds[packed]=id;landscape.baselineTileIds[packed]=0x8000|id;
}
export function fillCircleWithSpice(landscape,packed,radius=5){
  if(!radius)return;
  const x=packed&63,y=(packed>>>6)&63;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const cur=pack(x+dx,y+dy),xx=Math.abs((packed&63)-(cur&63)),yy=Math.abs((packed>>>6)-(cur>>>6));
    const distance=Math.max(xx,yy)+(Math.min(xx,yy)>>>1);
    if(distance>radius||distance===radius&&(landscapeRandom256(landscape.random)&1)===0)continue;
    if(cur<CELLS&&landscapeTypeForIcon(landscape.tileIds[cur])!==8)changeSpice(landscape,cur,1);
  }
  changeSpice(landscape,packed,1);
}
export function applyScenarioLandscape(landscape,mapSection={},scale=0){
  const ids=value=>String(value??'').split(',').filter(x=>x.trim().length>0).map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<4096);
  // Source order: explicit MAP cells, Bloom, Field, Special.
  for(const[key,value]of Object.entries(mapSection))if(key.startsWith('C')&&key.length>=8){const x=parseInt(key.slice(4,6),10),y=parseInt(key.slice(6),10);if(!Number.isFinite(x)||!Number.isFinite(y))continue;const tile=pack(x,y)&4095,values=String(value).split(',').map(Number);if(Number.isFinite(values[1])){landscape.tileIds[tile]=values[1]&511;if(landscape.baselineTileIds[tile]!==landscape.tileIds[tile])landscape.baselineTileIds[tile]|=0x8000;}landscape.explicitTileFlags??={};landscape.explicitTileFlags[tile]=(values[0]||0)&255;}
  for(const tile of ids(mapSection.Bloom)){landscape.tileIds[tile]=208;landscape.baselineTileIds[tile]|=0x8000;landscape.blooms[tile]=1;}
  for(const tile of ids(mapSection.Field))fillCircleWithSpice(landscape,tile,5);
  for(const tile of ids(mapSection.Special)){landscape.tileIds[tile]=209;landscape.baselineTileIds[tile]|=0x8000;landscape.specials[tile]=1;}
  landscape.landscapeTypes=landscape.tileIds.map(landscapeTypeForIcon);
  landscape.engineClasses=landscape.landscapeTypes.map(engineClass);
  landscape.mapInfo=mapInfo(scale);
  return landscape;
}
