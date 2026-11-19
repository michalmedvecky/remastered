import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileSceneRecognition,recognizePaintedScene,isAdvisorSprite} from '../dist/painted-scenes.mjs';
import {prepareFrameDescriptor,stampNativeSprite} from '../dist/hd-core.mjs';

const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root));
const chrome=JSON.parse(read('dist/painted/interface.json')),native=JSON.parse(read('dist/painted/native.json'));
const compiled=compileSceneRecognition(chrome,{sourceFrames:native.frames});
const base=name=>Uint8Array.from(Buffer.from(chrome.scenes[name].indicesBase64,'base64'));
const sources=Object.fromEntries(Object.entries(native.frames.ui).map(([id,row])=>[id,prepareFrameDescriptor(row)]));
const recognised=(pixels,extra={})=>recognizePaintedScene({worldVisible:false,pixels,...extra},compiled);
function fill(pixels,[x,y,w,h],index){for(let yy=y;yy<y+h;yy++)pixels.fill(index,yy*320+x,yy*320+x+w);}
function stamp(pixels,id,x,y){const f=sources[id];stampNativeSprite(pixels,f,{x,y,width:f.sourceW,height:f.sourceH,flags:0,clip:[0,0,320,200]});}
function copy(pixels,source,[x,y,w,h],dx,dy){for(let yy=0;yy<h;yy++)pixels.set(source.subarray((y+yy)*320+x,(y+yy)*320+x+w),(dy+yy)*320+dx);}
function animate(pixels,key,pose){
 const p=chrome.frames['advisor-'+key].nativePatches,h=p.house;
 stamp(pixels,387+h*15+pose,p.eyes[0],p.eyes[1]);
 stamp(pixels,392+h*15+pose,p.mouth[0],p.mouth[1]);
 if(p.shoulder)stamp(pixels,397+h*15,p.shoulder[0],p.shoulder[1]);
 const other=p.book??p.ring;if(other)stamp(pixels,398+h*15+(pose%4),other[0],other[1]);
}

test('all four genuine advisor sources remain uniquely identified through every full native animation rectangle and speech/button replacement',()=>{
 assert.equal(compiled.advisorPoints.length,384);
 for(const key of ['h','a','o','m'])for(let pose=0;pose<5;pose++){
  const name='MENTAT'+key.toUpperCase()+'.CPS',pixels=base(name);animate(pixels,key,pose);
  // A complete native speech backing copy replaces top40. Full bottom widget
  // rectangles are excluded even where their original source sprite has alpha0.
  fill(pixels,[0,0,320,40],0);fill(pixels,[152,164,168,36],12);
  stamp(pixels,379,168,168);stamp(pixels,381,240,168);
  fill(pixels,[128,48,184,112],233);
  const result=recognised(pixels,{playerHouse:5});
  assert.equal(result.scene,name,name+' pose '+pose);assert.equal(result.method,'exact-static-advisor');assert.equal(result.score,1);
 }
});

test('MISC question/name strips are overlays, not whole scenes: all three house confirmations retain the complete Mercenary advisor and exact preview',()=>{
 const misc=base('MISC.ENG');
 for(const[house,wsa]of [[0,'fhark'],[1,'fartr'],[2,'fordos']])for(const pose of [0,2,4]){
  const pixels=base('MENTATM.CPS');animate(pixels,'m',pose);
  const raw=read('art/hd-v3/media/extra-motion/native/'+wsa+'/frame-000.idx');
  for(let y=0;y<112;y++)pixels.set(raw.subarray(y*184,(y+1)*184),(48+y)*320+128);
  copy(pixels,misc,[0,0,208,24],0,0);copy(pixels,misc,[0,24*(house+1),104,24],208,0);
  stamp(pixels,373,168,168);stamp(pixels,375,240,168);
  const oldMiscScore=chrome.scenes['MISC.ENG'].witnesses.filter(([x,y,index])=>pixels[y*320+x]===index).length/320;
  assert.equal(oldMiscScore,1,'old classifier was fooled by a perfectly copied overlay');
  const result=recognised(pixels,{playerHouse:5});assert.equal(result.scene,'MENTATM.CPS',wsa+' pose '+pose);assert.equal(result.method,'exact-static-advisor');
 }
 const miscOnly=recognised(misc);assert.notEqual(miscOnly.scene,'MISC.ENG');assert(!miscOnly.scene.startsWith('MENTAT'),'overlay atlas alone is not an advisor');
});

test('actual native UI ink and cursor alpha may occlude anchors; a bounding box cannot hide unobserved mismatches',()=>{
 const pixels=base('MENTATA.CPS'),ink=[];
 for(let y=50;y<70;y++)for(let x=0;x<24;x++){pixels[y*320+x]=222;ink.push([x,y-50,222]);}
 const overlay={x:0,y:50,width:24,height:20,screen:0,visibleInk:ink.length,ink};
 assert.equal(recognised(pixels,{uiCommands:[overlay]}).scene,'MENTATA.CPS');
 assert.equal(recognised(pixels,{uiCommands:[{...overlay,ink:ink.slice(0,1)}]}).scene,'native','unobserved mismatches are not guessed away');
 const uiPixels=base('MENTATO.CPS'),raw=uiPixels.slice(),cursor=sources[0],left=2,top=48;
 for(let y=0;y<cursor.sourceH;y++)for(let x=0;x<cursor.sourceW;x++)if(cursor.mask[y*cursor.sourceW+x])raw[(top+y)*320+left+x]=255;
 const pointer={id:0,x:left,y:top,hotX:0,hotY:0,visible:true};
 assert.equal(recognised(raw,{uiPixels,cursor:pointer}).scene,'MENTATO.CPS','real cursor-free underlay');
 assert.equal(recognised(raw,{cursor:pointer}).scene,'MENTATO.CPS','raw fallback masks the actual native cursor shape');
});

test('all four security input compositions retain exact whole advisors through the native filled window, typing, blink and restore',()=>{
 const outer=[10,170,300,23],inner=[14,174,292,15],font=JSON.parse(read('dist/locales/cs.json')).fonts['NEW8P.FNT'];
 const inside=(p,r)=>p.x>=r[0]&&p.x<r[0]+r[2]&&p.y>=r[1]&&p.y<r[1]+r[3];
 assert(compiled.advisorExclusions.some(r=>r.every((v,i)=>v===outer[i])),'exact native Security_Show widget9 border');
 assert(!compiled.advisorPoints.some(p=>inside(p,outer)),'filled interior is not immutable CPS evidence');
 assert.equal(compiled.advisorPoints.length,384,'independent static evidence remains full-sized');
 function border(pixels,rect,fillInterior){
  const[x,y,w,h]=rect,ink=[];if(fillInterior)fill(pixels,rect,20);
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(xx===0||xx===w-1||yy===0||yy===h-1){const c=yy===0?26:16;pixels[(y+yy)*320+x+xx]=c;ink.push([xx,yy,c]);}
  return{x,y,width:w,height:h,screen:0,fill:fillInterior,visibleInk:ink.length,ink};
 }
 for(const key of ['h','a','o','m'])for(const[phase,answer]of ['', 'stredni','105mm kanon'].entries()){
  const name='MENTAT'+key.toUpperCase()+'.CPS',pixels=base(name);animate(pixels,key,phase);
  fill(pixels,[0,0,320,40],0);fill(pixels,[128,48,184,112],233);
  const borders=[border(pixels,outer,true),border(pixels,inner,false)];
  let pen=16;for(const c of answer){const glyph=font.chars[c.charCodeAt(0)],data=Buffer.from(glyph.nibblesBase64,'base64');for(let y=0;y<glyph.usedLines;y++)for(let x=0;x<glyph.width;x++)if(data[y*glyph.width+x]===1)pixels[(176+glyph.unusedLines+y)*320+pen+x]=15;pen+=glyph.width-1;}
  fill(pixels,[pen,176,1,11],phase&1?15:20);
  const result=recognised(pixels,{playerHouse:2,borders});assert.equal(result.scene,name,name+' security '+phase);assert.equal(result.method,'exact-static-advisor');assert.equal(result.matches,result.samples);
  const wrong=pixels.slice(),point=compiled.advisorPoints.find(p=>p.values[compiled.advisors.indexOf(name)]!==222);wrong[point.at]=222;
  assert.equal(recognised(wrong,{borders:[...borders,{x:0,y:40,width:320,height:160,fill:true,ink:[],visibleInk:1}]}).scene,'native','arbitrary filled-border box cannot hide corruption outside known security window');
  const restored=base(name);animate(restored,key,phase);assert.equal(recognised(restored).scene,name,name+' after native restore');
 }
});

test('unknown or partially mixed scenes never select a nearest advisor, and advisor patch identity comes from the original SHP resource',()=>{
 assert.equal(recognised(new Uint8Array(64000)).scene,'native');
 const hybrid=base('MENTATH.CPS'),a=base('MENTATA.CPS');copy(hybrid,a,[0,120,128,80],0,120);
 assert.equal(recognised(hybrid).scene,'native','mixed body has no exact whole source');
 const faceOnly=new Uint8Array(64000);animate(faceOnly,'m',4);assert.equal(recognised(faceOnly).scene,'native');
 for(const[id,row]of Object.entries(native.frames.ui))assert.equal(isAdvisorSprite(Number(id),compiled),/^MENSHP[AHOM]\.SHP$/.test(row.resource),'source identity '+id);
 assert.equal(recognizePaintedScene({worldVisible:true,pixels:base('MENTATA.CPS')},compiled).scene,'hud','committed world remains authoritative');
});
