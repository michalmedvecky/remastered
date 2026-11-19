import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankFrame,addBorder,addText,finishFrame,nativeWidth,widenTextCoverage} from '../fidelity/text-layout/fixtures.mjs';
import {decodeNativeCharacter,decodeNativeText} from '../dist/native-text.mjs';
import {glyphInkVisibility} from '../dist/painted-ui-core.mjs';
const root=new URL('../',import.meta.url),json=p=>JSON.parse(readFileSync(new URL(p,root))),locale=json('dist/locales/cs.json'),strings=json('art/localization/cs-core.json').translations;
const charset=new Map();for(let c=0;c<254;c++){try{charset.set(decodeNativeCharacter(c,locale.encoding),c);}catch{}}
const encode=value=>Uint8Array.from([...value],c=>{assert(charset.has(c),c);return charset.get(c);}),value=id=>strings['DUNE.ENG:'+String(id).padStart(3,'0')];
const empty=()=>blankFrame(new Uint8Array(64000).fill(116),new Uint8Array(768),true);

test('focused HUD observations retain full Czech initials and exact native origin/copy offsets',()=>{
 const font=locale.fonts['NEW6P.FNT'];
 for(const[id,rect]of [[30,[258,110,58,11]],[34,[258,76,60,10]],[3,[258,99,60,10]],[1,[258,77,60,10]],[6,[258,88,60,10]]])for(const dx of [-2,0,2]){
  const f=empty();addBorder(f,rect);const text=value(id),advance=nativeWidth(font,text,encode,-1),center=rect[0]+rect[2]/2+dx,run=addText(f,{font,value:text,encode,centerX:center,y:rect[1]+1,offset:-1});finishFrame(f);
  assert.equal(run.x,center-Math.floor(advance/2));assert.equal(run.y,rect[1]+1);assert.equal(run.width,advance+1);assert.equal(run.fontHeight,8);assert.deepEqual(run.clips,[[run.x,run.y,run.width,8]]);
  assert.equal(decodeNativeText(run.textBytes,locale.encoding),text);assert.equal(decodeNativeCharacter(run.glyphs[0].char,locale.encoding),[...text][0]);assert(run.glyphs[0].visibleInk>0,'native initial exists before painting');
  assert.equal(glyphInkVisibility(run,f.uiPixels).ratio,1);assert(run.glyphs.every(g=>g.visibleInk>0));
 }
});
test('CHOAM caption fixtures preserve immutable full layout plus the real182×14 copy clip',()=>{
 const f=empty(),font=locale.fonts['NEW8P.FNT'],price=value(177).replace('%3d','300'),width=nativeWidth(font,value(178),encode,-2),x=310-width;
 const run=addText(f,{font,fontId:2,value:price,encode,x,y:23,offset:-2,foreground:12,shadow:false,copyRect:[128,21,182,14]});finishFrame(f);
 assert.equal(run.width,nativeWidth(font,price,encode,-2)+2);assert(run.x+run.width>310,'allocated trailing glyph cells exceed the native copied banner');assert.deepEqual(run.clips,[[x,23,310-x,11]]);
 assert.equal(run.text,'Cena: 300');assert(run.glyphs[0].visibleInk>0);assert.equal(run.colours[2],0);assert.equal(run.colours[3],0);assert.equal(glyphInkVisibility(run,f.uiPixels).ratio,1);
 for(const[dx,dy]of run.ink)assert(x+dx>=128&&x+dx<310&&23+dy>=21&&23+dy<35,'visible native ink stays in original copy');
});
test('wide-coverage reference changes only clip metadata, preserving source words and native pixel evidence',()=>{
 const f=empty(),font=locale.fonts['NEW6P.FNT'];addBorder(f,[258,110,58,11]);addText(f,{font,value:value(30),encode,centerX:285,y:111,offset:-1});finishFrame(f);
 const wide=widenTextCoverage(f);assert.strictEqual(wide.pixels,f.pixels);assert.strictEqual(wide.uiPixels,f.uiPixels);assert.strictEqual(wide.palette,f.palette);assert.strictEqual(wide.borders,f.borders);
 const a=f.textRuns[0],b=wide.textRuns[0];assert.equal(b.text,a.text);assert.strictEqual(b.glyphs,a.glyphs);assert.strictEqual(b.ink,a.ink);assert.equal(b.x,a.x);assert.equal(b.y,a.y);assert.equal(b.width,a.width);assert.deepEqual(b.clips,[[0,0,320,200]]);
 assert.deepEqual(a.clips,[[267,111,38,8]],'regression case retains actual problematic native rectangle');
});
test('tall production captions retain native widget, portrait and Czech source string geometry',()=>{
 const read=p=>readFileSync(new URL(p,root),'utf8'),table=read('native/opendune/src/table/widgetinfo.c'),symbols=read('native/opendune/src/table/strings.h'),draw=read('native/opendune/src/gui/widget_draw.c');
 const row=table.match(/\{ \/\* 5 \*\/[\s\S]*?\/\* stringID/)[0];
 for(const[field,n]of [['index',5],['offsetX',258],['offsetY',87],['width',60],['height',35]])assert.match(row,new RegExp('/\\* '+field+' +\\*/ '+n+','));
 assert.match(draw,/positionX \+ width \/ 2,[\s\S]*?positionY \+ height - 9,[\s\S]*?0x121,/);
 const portrait=json('dist/painted/native.json').frames.ui[65];assert.equal(portrait.sourceW,32);assert.equal(portrait.sourceH,24);
 for(const[id,symbol,caption]of [[41,'STR_BUILD_IT','Postavit'],[38,'STR_PLACE_IT','Umístit'],[46,'STR_D_DONE','42% hotovo']]){
  assert.match(symbols,new RegExp(symbol+' = '+id+','));const f=empty();addBorder(f,[258,87,60,35],5);
  const run=addText(f,{font:locale.fonts['NEW6P.FNT'],value:value(id).replace('%d','42').replace('%%','%'),encode,centerX:288,y:113,offset:-1,foreground:id===38?239:15});finishFrame(f);
  assert.equal(run.text,caption);assert.equal(run.y,113);assert.equal(run.fontHeight,8);assert.equal(run.x,288-Math.floor(nativeWidth(locale.fonts['NEW6P.FNT'],caption,encode,-1)/2));assert.equal(glyphInkVisibility(run,f.uiPixels).ratio,1);
 }
});
