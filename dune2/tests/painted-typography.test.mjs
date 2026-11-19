import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PERIOD_FONT_DATA,periodGlyph,measurePeriodText,drawPeriodText} from '../dist/painted-typography.mjs';
import {fitTextBox} from '../dist/painted-ui-core.mjs';

const root=new URL('../',import.meta.url),sourceURL=new URL('art/hd-v3/icons/fonts.json',root);
const source=JSON.parse(readFileSync(sourceURL));
const pointIn=(contours,x,y)=>{
  let inside=false;
  for(const path of contours)for(let i=0,j=path.length-1;i<path.length;j=i++){
    const a=path[i],b=path[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
};

test('vector font data is reproducible and bound to both actual native FNT sources',()=>{
  assert.equal(PERIOD_FONT_DATA.sourceSHA256,createHash('sha256').update(readFileSync(sourceURL)).digest('hex'));
  execFileSync('python3',[new URL('tools/build-painted-typography.py',root).pathname,'--check']);
  for(const[name,face]of Object.entries(PERIOD_FONT_DATA.faces))assert.equal(face.sourceSHA256,source.fonts[name].sha256);
});

test('merged angular contours preserve every ASCII foreground and counter hole without internal cell seams',()=>{
  let inspected=0,polygons=0;
  for(const[name,face]of Object.entries(PERIOD_FONT_DATA.faces))for(let code=33;code<127;code++){
    const native=source.fonts[name].chars[code],glyph=face.glyphs[String.fromCharCode(code)];
    if(!native?.width||!glyph)continue;
    const bytes=Buffer.from(native.nibblesBase64,'base64');
    for(let y=0;y<face.height;y++)for(let x=0;x<native.width;x++){
      const expected=y>=native.unusedLines&&y<native.unusedLines+native.usedLines&&bytes[(y-native.unusedLines)*native.width+x]===1;
      assert.equal(pointIn(glyph.contours,x+.5,y+.5),!!expected,`${name} ${code} pixel ${x},${y}`);inspected++;
    }
    polygons+=glyph.contours.length;
    assert(glyph.contours.every(p=>p.length>=3));
    // A native connected stem is one silhouette, not separately rounded cells.
    if(code===73)assert(glyph.contours.length<=3,name+' I remains a few connected contours');
  }
  assert(inspected>10000);assert(polygons>100);
});

test('complete Czech alphabet and period punctuation have authored glyphs and finite stable metrics',()=>{
  const czech='áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ';
  const punctuation='„“”‘’–—…!?.,:;()[]+-/0123456789';
  for(const face of Object.keys(PERIOD_FONT_DATA.faces)){
    for(const char of czech){
      const glyph=periodGlyph(char,{face});assert(glyph.accent,char);assert(glyph.contours.length>0,char);
      assert.notEqual(glyph,periodGlyph('?'));assert(glyph.ink.every(Number.isFinite));
    }
    for(const char of punctuation)assert(PERIOD_FONT_DATA.faces[face].glyphs[char]?.ink,char+' authored');
    assert(periodGlyph('ď',{face}).sideCaron);assert(periodGlyph('ť',{face}).sideCaron);
    assert.equal(periodGlyph('č',{face}).accent,'caron');assert.equal(periodGlyph('ů',{face}).accent,'ring');
    const value='Řízení těžby: Žluťoučký kůň, 999999 kreditů. „Ano?“';
    const a=measurePeriodText(value,30,{face}),b=measurePeriodText(value,30,{face});
    assert.deepEqual(a,b);assert(Object.values(a).every(Number.isFinite));assert(a.actualBoundingBoxAscent>0);
    assert(Math.abs(measurePeriodText('A  B',30,{face}).width-measurePeriodText('A B',30,{face}).width-measurePeriodText(' ',30,{face}).width)<1e-9);
  }
});

test('literal runs, six fixed counter digits and Czech accents fit using actual vector ink and stroke',()=>{
  for(const[value,rect]of [['POSTAVIT',[0,0,47,8]],['MENTAT',[0,0,78,12]],['Možnosti',[0,0,78,12]],['Pokračovat',[0,0,64,24]],['Přejete si vstoupit do rodu Atreidů?',[0,0,198,15]],['Žluťoučký kůň úpěl ďábelské ódy.',[0,0,250,11]],['„Těžba…“ — Řízení',[0,0,180,11]],...Array.from('0123456789',value=>[value,[0,0,8,8]])]){
    const pixels=rect.map(n=>n*4),layout=fitTextBox(size=>measurePeriodText(value,size),pixels,{maxSize:96,padding:[3,3,3,3],align:'center'});
    assert(layout,value);const[x,y,w,h]=layout.ink,[cx,cy,cw,ch]=layout.content;
    assert(x>=cx-.001&&y>=cy-.001&&x+w<=cx+cw+.001&&y+h<=cy+ch+.001,value+' fits');
  }
  assert.deepEqual(measurePeriodText('Build it',24),measurePeriodText('Build it',24), 'measurement has no visibility or Canvas state input');
  assert.notEqual(measurePeriodText('Build it',24).width,measurePeriodText('Buildit',24).width,'literal spaces persist');
});

test('painting uses path geometry only and its exact vertices agree with reported measured bounds',()=>{
  const points=[],ctx={save(){},restore(){},translate(x,y){this.origin=[x,y]},scale(x,y){this.factor=[x,y]},beginPath(){},closePath(){},moveTo(x,y){points.push([x,y])},lineTo(x,y){points.push([x,y])},stroke(){this.stroked=true},fill(rule){this.rule=rule}};
  const value='Říď těžbu! 999999',size=35,origin=[20,100],m=measurePeriodText(value,size);
  drawPeriodText(ctx,value,...origin,size,{stroke:2});
  assert(points.length>100);assert(ctx.stroked);assert.equal(ctx.rule,'evenodd');assert.equal(ctx.lineJoin,'bevel');
  const xs=points.map(p=>origin[0]+p[0]*ctx.factor[0]),ys=points.map(p=>origin[1]+p[1]*ctx.factor[1]);
  assert(Math.abs(Math.min(...xs)-(origin[0]-m.actualBoundingBoxLeft))<1e-7);
  assert(Math.abs(Math.max(...xs)-(origin[0]+m.actualBoundingBoxRight))<1e-7);
  assert(Math.abs(Math.min(...ys)-(origin[1]-m.actualBoundingBoxAscent))<1e-7);
  assert(Math.abs(Math.max(...ys)-(origin[1]+m.actualBoundingBoxDescent))<1e-7);
  assert.equal(periodGlyph('🪐'),periodGlyph('?'),'explicit unknown-glyph fallback');
});
