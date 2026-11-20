import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeNativeText,decodeNativeCharacter} from '../dist/native-text.mjs';
import {glyphCharacter,fitTextBox,observedTextRuns} from '../dist/painted-ui-core.mjs';
import {PERIOD_FONT_DATA,periodGlyph,measurePeriodText} from '../dist/painted-typography.mjs';
import {prepareFrameDescriptor} from '../dist/hd-core.mjs';
import {compileConfirmationRecognition,recognizeConfirmationHouse} from '../dist/painted-scenes.mjs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root))),locale=read('dist/locales/cs.json');
const bytesByCharacter=new Map();for(let byte=0;byte<254;byte++){try{bytesByCharacter.set(decodeNativeCharacter(byte,'windows-1250'),byte);}catch{}}
const encode=value=>Uint8Array.from([...value],char=>{assert(bytesByCharacter.has(char),'Czech byte exists: '+char);return bytesByCharacter.get(char);});
const alphabet='áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ';
test('Czech observed bytes decode through the production helper without CP437 corruption',()=>{
 const value='Příliš žluťoučký kůň úpěl ďábelské ódy. '+alphabet,bytes=encode(value);
 assert.equal(decodeNativeText(bytes,locale.encoding),value);assert.notEqual(decodeNativeText(bytes,'cp437'),value);
 for(let i=0;i<bytes.length;i++)assert.equal(glyphCharacter(bytes[i],locale.encoding),value[i]);
 assert.throws(()=>decodeNativeText([256],locale.encoding));assert.throws(()=>decodeNativeText([65],'utf-8'));
});
test('all Czech accents have actual extended native FNT ink and explicit period vector shapes',()=>{
 assert.equal(locale.complete,true);
 for(const face of ['NEW6P.FNT','NEW8P.FNT']){
  const native=locale.fonts[face];assert.equal(native.count,254);
  for(const char of alphabet){
   const byte=bytesByCharacter.get(char),glyph=native.chars[byte];assert(glyph,char+' native descriptor');
   const ink=Buffer.from(glyph.nibblesBase64,'base64');assert(ink.includes(1),char+' has native foreground');assert.equal(ink.length,glyph.width*glyph.usedLines);
   const vector=periodGlyph(char,{face});assert.equal(vector,PERIOD_FONT_DATA.faces[face].glyphs[char]);assert(vector.accent,char+' authored accent');assert(vector.ink.every(Number.isFinite));
  }
 }
});
test('partial Czech UI patches merge original geometry before preparing native ink descriptors',()=>{
 const native=read('dist/painted/native.json');let count=0;
 for(const[id,patch]of Object.entries(locale.uiFrames)){
  const original=native.frames.ui[id];assert(original,id+' original geometry');
  const prepared=prepareFrameDescriptor({...original,...patch});
  assert.equal(prepared.w,original.w);assert.equal(prepared.h,original.h);
  assert.equal(prepared.indices.length,patch.sourceW*patch.sourceH);assert.equal(prepared.mask.length,prepared.indices.length);
  assert.deepEqual(Buffer.from(prepared.indices),Buffer.from(patch.indicesBase64,'base64'));count++;
 }
 assert.equal(count,25);assert.deepEqual(Object.keys(locale.uiFrames).sort(),Object.keys(locale.bitmapLabels).sort(),'Every semantic caption has a matching Czech native-ink patch');
});
test('literal Czech native runs retain spaces, full wording and layout under changing ink visibility',()=>{
 const value='Těžit koření: Stavební dvůr',textBytes=[...encode(value)],glyphs=textBytes.map((char,index)=>({char,index,x:4+index*6,y:1,width:6,height:11,advance:6,font:2,fontHeight:11,colours:[0,15],visibleInk:1,totalInk:1,ink:[[0,0,15]],serial:index}));
 const run={text:decodeNativeText(textBytes,locale.encoding),textBytes,x:4,y:1,width:glyphs.length*6,height:11,fontHeight:11,font:2,visibleInk:glyphs.length,totalInk:glyphs.length,glyphs,clips:[[4,1,glyphs.length*6,11]],ink:glyphs.map((g,i)=>[i*6,0,15]),serial:1};
 const first=observedTextRuns({textRuns:[run]})[0];assert.equal(first.text,value);assert(first.stable);
 const partial={...run,visibleInk:1,ink:[run.ink[0]],glyphs:glyphs.map((g,i)=>({...g,visibleInk:i?0:1}))},second=observedTextRuns({textRuns:[partial]})[0];assert.equal(second.text,value);assert.deepEqual(measurePeriodText(first.text,30),measurePeriodText(second.text,30));
 assert(measurePeriodText(value,30).width>measurePeriodText(value.replaceAll(' ',''),30).width);
});
test('actual Czech semantic captions, long menus and all accented ink fit their original bounded fields',()=>{
 const labels=locale.bitmapLabels;
 for(const[id,value]of [[373,'Ano'],[375,'Ne'],[379,'Pokračovat'],[11,'Kredity']])assert.equal(labels[id],value);
 const cases=[...Object.entries(labels).map(([id,value])=>[value,[0,0,id==='11'?60:id==='7'||id==='8'||id==='9'||id==='10'?78:64,24]]),['Dune II: Budování dynastie',[0,0,240,14]],['Restartovat misi',[0,0,208,15]],['Vybrat jiný rod',[0,0,208,15]],['Pokračovat ve hře',[0,0,104,15]],['Chcete se přidat k rodu',[0,0,198,15]],['Harkonnenů?',[0,0,100,15]],['Příliš žluťoučký kůň úpěl ďábelské ódy.',[0,0,304,11]]];
 for(const[value,rect]of cases){const physical=rect.map(n=>n*4),layout=fitTextBox(size=>measurePeriodText(value,size),physical,{maxSize:rect[3]*4*.97,padding:[4,4,4,4],align:'center'});assert(layout,value);const[x,y,w,h]=layout.ink,[a,b,c,d]=layout.content;assert(x>=a-.001&&y>=b-.001&&x+w<=a+c+.001&&y+h<=b+d+.001,value);}
});
test('English and Czech confirmation strips identify exactly the selected house using differing name ink',()=>{
 const chrome=read('dist/painted/interface.json'),original=chrome.scenes['MISC.ENG'];
 for(const[tag,scene]of [['en',original],['cs',{...original,...locale.scenes['MISC.ENG']}]]){
  const source=Uint8Array.from(Buffer.from(scene.indicesBase64,'base64')),compiled=compileConfirmationRecognition(source,scene.sourceNameRects);
  assert(compiled.points.length>=24,tag+' actual discriminating name pixels');assert(compiled.points.every(p=>p.values.some(v=>v!==p.values[0])));
  for(const[house,rect]of Object.entries(scene.sourceNameRects)){
   const pixels=new Uint8Array(64000);for(let y=0;y<rect[3];y++)pixels.set(source.subarray((rect[1]+y)*320+rect[0],(rect[1]+y)*320+rect[0]+rect[2]),y*320+208);
   assert.equal(recognizeConfirmationHouse({pixels},compiled),Number(house),tag+' selected house '+house);
   const corrupt=pixels.slice(),p=compiled.points[0];corrupt[p.y*320+208+p.x]^=255;
   assert.equal(recognizeConfirmationHouse({pixels:corrupt},compiled),null,tag+' never picks nearest common background');
   assert.equal(recognizeConfirmationHouse({pixels:corrupt,uiPixels:pixels},compiled),Number(house),tag+' real cursor-free native underlay');
  }
  assert.equal(recognizeConfirmationHouse({pixels:new Uint8Array(64000)},compiled),null,tag+' missing/blank name never defaults to Harkonnen');
 }
});
