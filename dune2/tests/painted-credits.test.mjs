import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CREDIT_COUNTER, creditDigitLayout, paintedCreditPanel, suppressNativeCreditBackground} from '../dist/painted-credits.mjs';
import {fitTextBox} from '../dist/painted-ui-core.mjs';
import {decodePNG} from '../tools/painted-png.mjs';

const command = (column, id = 15, y = 5) => ({id, x:260 + column*10, y, width:8, height:8, nativeClip:[256,4,64,9]});

test('all six native rolling slots retain identity and fit before the actual painted HUD bevel', () => {
  for (const scene of ['hud','CHOAM.CPS']) {
    const layouts=Array.from({length:6},(_,column)=>creditDigitLayout(command(column),scene));
    assert.deepEqual(layouts.map(l=>l.rect[0]),[258,266,274,282,290,298]);
    assert.deepEqual(layouts.map(l=>l.column),[0,1,2,3,4,5]);
    assert.equal(layouts[5].rect[0]+layouts[5].rect[2],306);
    for(const l of layouts){assert(l.rect[0]>=258);assert(l.rect[0]+l.rect[2]<=306);}
    // The final three digits of a small number retain slots3..5. They never
    // shift right to a frame edge as leading native blanks appear/disappear.
    assert.deepEqual([3,4,5].map(i=>creditDigitLayout(command(i),scene).rect[0]),[282,290,298]);
  }
  const m=JSON.parse(readFileSync(new URL('../dist/painted/interface.json',import.meta.url)));
  const frame=m.frames['hud-shell'],image=decodePNG(readFileSync(new URL('../dist/'+m.atlases[frame.atlas].src,import.meta.url)));
  const rgb=(x,y)=>{const at=((frame.rect[1]+y*4)*image.width+frame.rect[0]+x*4)*4;return [...image.pixels.subarray(at,at+3)];};
  for(const y of [4,6,10,12])assert(Math.max(...rgb(306,y))<40,'right padding is inside the retained dark well');
  assert(Math.max(...rgb(310,6))>45,'old last-slot region crosses the actual frame bevel');
});

test('every carry/borrow phase preserves native vertical motion, clipping and full glyph fitting', () => {
  for(const scene of ['hud','CHOAM.CPS'])for(let column=0;column<6;column++)for(let id=14;id<=23;id++)for(let offset=-7;offset<=15;offset++){
    const source=command(column,id,5+offset),l=creditDigitLayout(source,scene);
    assert.equal(l.rect[1],source.y);assert.equal(l.rect[3],8);assert.equal(l.nativeY,source.y);
    if(!l.clip){assert(source.y>=13||source.y+8<=4);continue;}
    const[x,y,w,h]=l.clip;assert(x>=258&&x+w<=306);assert(y>=4&&y+h<=13);
    const rect=l.rect.map(n=>n*4),layout=fitTextBox(size=>({width:size*.65,actualBoundingBoxLeft:size*.02,actualBoundingBoxRight:size*.65,actualBoundingBoxAscent:size*.75,actualBoundingBoxDescent:size*.05}),rect,{maxSize:31.04,padding:l.insets.map(n=>n*4),align:'center'});
    assert(layout);assert(layout.ink[0]>=rect[0]);assert(layout.ink[0]+layout.ink[2]<=rect[0]+rect[2]);
  }
  const original=command(5,15,-2),a=creditDigitLayout(original,'hud'),b=creditDigitLayout({...original,clip:[313,4,2,1]},'hud');
  assert.deepEqual(a,b,'surviving native ink bounds cannot resize or reposition the digit');
});

test('source copy clips move with their column while factory counter background cannot erase its painted rim',()=>{
  const source={...command(5,15),nativeClip:[313,4,3,9]},l=creditDigitLayout(source,'hud');
  assert.deepEqual(l.clip,[301,5,3,8]);
  assert.equal(suppressNativeCreditBackground({id:12},'hud'),true);
  assert.equal(suppressNativeCreditBackground({id:12},'CHOAM.CPS'),true);
  assert.equal(suppressNativeCreditBackground({id:12},'native'),false);
  assert.equal(paintedCreditPanel('hud'),null);assert.deepEqual(paintedCreditPanel('CHOAM.CPS'),[255,1,55,15]);
  const[x,y,w,h]=paintedCreditPanel('CHOAM.CPS'),c=CREDIT_COUNTER.paintedClip;
  assert(c[0]>x&&c[1]>y&&c[0]+c[2]<x+w&&c[1]+c[3]<y+h);
});

test('unrelated digits, blanks, source positions and scene families are never coerced into the counter',()=>{
  for(const source of [{...command(0),x:259},{...command(0),x:320},{...command(0),width:9},{...command(0),id:13},{...command(0),id:24}])assert.equal(creditDigitLayout(source,'hud'),null);
  assert.equal(creditDigitLayout(command(0),'MENTATA.CPS'),null);
  assert.equal(creditDigitLayout(command(0),'native'),null);
});
