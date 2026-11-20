// Inert Canvas review generator; no server, emulator or original executable.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=path.join(root,'dist/terrain-field-qa.html');
const bankHash=createHash('sha256').update(fs.readFileSync(path.join(root,'dist/painted/native.json'))).digest('hex');
const html=String.raw`<!doctype html><meta charset=utf-8><title>Continuous painted terrain review</title><style>body{margin:0;padding:12px;background:#10171b;color:#e8e4d7;font:14px sans-serif}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0 12px}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0}figcaption{height:28px}canvas{display:block;width:100%;height:auto}pre{white-space:pre-wrap;max-height:200px;overflow:auto}details{margin-top:12px}</style><h1>Continuous new sand and mineral grains</h1><p>Exact original indexed references on the left; production HD renderer on the right. Native class IDs, visibility and harvesting inputs stay unchanged. No DOS/WASM execution.</p><div id=gallery class=gallery></div><pre id=result>pending</pre><script type=module>
import {createPaintedTerrain} from './painted-terrain.mjs';
const bank=await(await fetch('./painted/native.json')).json(),terrain=await createPaintedTerrain();
const globalClass=(x,y)=>x<14&&y<13?'rock':x>=14&&x<=17&&y>=11&&y<=14?'dune':x>=13&&x<=25&&y>=13&&y<=20?(x>=17&&x<=22&&y>=15&&y<=18?'dense':'spice'):'sand';
function tile(x,y){const type=globalClass(x,y);if(type==='sand')return 127;let bits=0;for(const[dx,dy,bit]of[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]]){const other=globalClass(x+dx,y+dy);if(type==='spice'?(other==='spice'||other==='dense'):other===type)bits|=bit;}return(type==='rock'?128:type==='dune'?144:type==='spice'?176:192)+bits;}
function frame(x,y){const tiles=new Uint16Array(17*12*4);for(let row=0;row<12;row++)for(let col=0;col<17;col++)tiles.set([tile(x+col,y+row),0,1,1],(row*17+col)*4);return{grid:{x,y,width:17,height:12},viewport:x+y*64,tiles,veiledTileId:123,debugScenario:false};}
const originalFrames=new Map(Object.entries(bank.frames.tiles).map(([id,row])=>[Number(id),{...row,codes:Uint8Array.from(atob(row.indicesBase64),c=>c.charCodeAt(0))}]));
function original(f){const canvas=document.createElement('canvas');canvas.width=272;canvas.height=192;const c=canvas.getContext('2d'),data=c.createImageData(272,192);for(let row=0;row<12;row++)for(let col=0;col<17;col++){const at=(row*17+col)*4,source=originalFrames.get(f.tiles[at]);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=((row*16+y)*272+col*16+x)*4,index=f.tiles[at+3]?source.palette[source.codes[y*16+x]]:12;for(let channel=0;channel<3;channel++)data.data[p+channel]=f.tiles[at+3]?bank.palette[index*3+channel]:0;data.data[p+3]=255;}}c.putImageData(data,0,0);const large=document.createElement('canvas');large.width=1088;large.height=768;const lc=large.getContext('2d');lc.imageSmoothingEnabled=false;lc.drawImage(canvas,0,0,1088,768);return large;}
function painted(f){const canvas=document.createElement('canvas');canvas.width=1088;canvas.height=768;const c=canvas.getContext('2d',{willReadFrequently:true}),start=performance.now();terrain.draw(c,f,{x:0,y:0,phase:'ground'});terrain.draw(c,f,{x:0,y:0,phase:'overlay'});return{canvas,elapsed:performance.now()-start};}
function show(label,canvas){const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=label;figure.append(caption,canvas);gallery.append(figure);}
function crop(canvas){const out=document.createElement('canvas');out.width=1024;out.height=768;const c=out.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(canvas,4*64,3*64,8*64,6*64,0,0,1024,768);return out;}
try{
 const a=frame(10,10),bytesBefore=Array.from(a.tiles).join(','),ref=original(a),first=painted(a),d1=terrain.diagnostics(),cached=painted({...a,commands:[{id:111,x:60,y:60}]}),d2=terrain.diagnostics();
 const b=frame(11,10),next=painted(b),ad=first.canvas.getContext('2d').getImageData(0,0,1088,768).data,bd=next.canvas.getContext('2d').getImageData(0,0,1088,768).data;
 let compared=0,maxDifference=0;
 // The shared visible interior is backed by a full committed one-tile fringe.
 for(let y=64;y<704;y++)for(let x=128;x<1024;x++)for(let channel=0;channel<3;channel++){const v=Math.abs(ad[(y*1088+x)*4+channel]-bd[(y*1088+x-64)*4+channel]);maxDifference=Math.max(maxDifference,v);compared++;}
 const fog=frame(10,10),cell=6*17+8;fog.tiles[cell*4+3]=0;const hidden=painted(fog).canvas.getContext('2d').getImageData(8*64,6*64,64,64).data;let hiddenColour=0;for(let p=0;p<hidden.length;p+=4)hiddenColour+=hidden[p]+hidden[p+1]+hidden[p+2];
 show('Original native ICONs and palette',ref);show('New HD sand, ridges and mineral overprint',first.canvas);show('Original close-up: normal/dense spice',crop(ref));show('HD close-up: continuous relief and fine grains',crop(first.canvas));
 const pass=maxDifference<=1&&hiddenColour===0&&bytesBefore===Array.from(a.tiles).join(',')&&terrain.diagnostics().unknownGroundIDs.length===0&&d1.rebuilds===d2.rebuilds;
 result.textContent=JSON.stringify({pass,source:{nativeBankSHA256:'__BANK_HASH__',nativeClasses:'map.c N1/E2/S4/W8 topology'},originalDosExecuted:false,coldBuildMs:first.elapsed,unchangedUnitsOnlyDrawMs:cached.elapsed,nextCameraBuildMs:next.elapsed,cache:{firstRebuilds:d1.rebuilds,afterUnitRebuilds:d2.rebuilds},overlap:{comparedRGBBytes:compared,maxDifference},fog:{hiddenRGBSum:hiddenColour},nativeDescriptorBytesUnchanged:bytesBefore===Array.from(a.tiles).join(','),materialField:d1.materialField,diagnostics:terrain.diagnostics()},null,2);document.body.dataset.done='true';document.body.dataset.pass=String(pass);
}catch(error){result.textContent=JSON.stringify({pass:false,error:error.stack});document.body.dataset.done='true';document.body.dataset.pass='false';}
</script>`;
fs.writeFileSync(target,html.replace('__BANK_HASH__',bankHash));
console.log(JSON.stringify({output:target,startsServer:false,executesDos:false}));
