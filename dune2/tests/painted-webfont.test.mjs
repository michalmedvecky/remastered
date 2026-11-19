import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,copyFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PERIOD_FONT_DATA} from '../dist/painted-typography.mjs';

const root=new URL('../',import.meta.url),woff=readFileSync(new URL('dist/fonts/arrakis-console.woff',root));
const manifest=JSON.parse(readFileSync(new URL('dist/fonts/arrakis-console.json',root)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pad=bytes=>Buffer.concat([bytes,Buffer.alloc((4-bytes.length%4)%4)]);

test('landing regeneration preserves the period stylesheet and its loaded font',()=>{
  const paths=['dist/native-shell.css','dist/period-shell.css','dist/index.html'];
  const sandbox=mkdtempSync(join(tmpdir(),'dune-period-landing-'));
  try{
    for(const path of [...paths,'tools/build-painted-landing.mjs','tools/painted-png.mjs','art/hd-v3/landing/raw/arrakis-corrected.png']){
      const target=join(sandbox,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(new URL(path,root),target);
    }
    mkdirSync(join(sandbox,'dist/painted'),{recursive:true});
    const before=paths.map(path=>sha(readFileSync(join(sandbox,path))));
    execFileSync(process.execPath,[join(sandbox,'tools/build-painted-landing.mjs')],{cwd:sandbox,stdio:'pipe'});
    assert.deepEqual(paths.map(path=>sha(readFileSync(join(sandbox,path)))),before);
  }finally{rmSync(sandbox,{recursive:true,force:true});}
  const index=readFileSync(new URL('dist/index.html',root),'utf8'),css=readFileSync(new URL('dist/period-shell.css',root),'utf8');
  assert(index.indexOf('period-shell.css')>index.indexOf('native-shell.css'));
  assert(css.includes('fonts/arrakis-console.woff'));assert(css.includes('font-synthesis:none'));
  assert(css.includes('font-family:"Arrakis Console"'));
  assert(css.includes('.native-console,dialog{font-family:"Arrakis Console"'));
  assert(css.includes('.native-console kbd,dialog code,dialog kbd{font-family:inherit'));
});
const sum=bytes=>{let value=0;const p=pad(bytes);for(let at=0;at<p.length;at+=4)value=(value+p.readUInt32BE(at))>>>0;return value;};
const tables=new Map(),entries=[];
for(let i=0;i<woff.readUInt16BE(12);i++){
  const at=44+i*20,tag=woff.toString('ascii',at,at+4),offset=woff.readUInt32BE(at+4),compressed=woff.readUInt32BE(at+8),length=woff.readUInt32BE(at+12),checksum=woff.readUInt32BE(at+16);
  const bytes=woff.subarray(offset,offset+compressed),raw=compressed<length?inflateSync(bytes):bytes;
  tables.set(tag,raw);entries.push({tag,offset,compressed,length,checksum});
}
const glyphCount=tables.get('maxp').readUInt16BE(4),face=PERIOD_FONT_DATA.faces['NEW8P.FNT'];

function cmapLookup(codepoint){
  const cmap=tables.get('cmap'),at=cmap.readUInt32BE(8),n=cmap.readUInt16BE(at+6)/2;
  assert.equal(cmap.readUInt16BE(at),4);
  const end=at+14,start=end+2*n+2,delta=start+2*n,range=delta+2*n;
  for(let i=0;i<n;i++)if(codepoint<=cmap.readUInt16BE(end+2*i)){
    if(codepoint<cmap.readUInt16BE(start+2*i))return 0;
    assert.equal(cmap.readUInt16BE(range+2*i),0);
    return(codepoint+cmap.readUInt16BE(delta+2*i))&0xffff;
  }
  return 0;
}

function decodeGlyph(id){
  const loca=tables.get('loca'),start=loca.readUInt32BE(id*4),end=loca.readUInt32BE((id+1)*4);
  if(start===end)return{box:[0,0,0,0],contours:[]};
  const data=tables.get('glyf').subarray(start,end),n=data.readInt16BE(0),box=Array.from({length:4},(_,i)=>data.readInt16BE(2+i*2));
  assert(n>=0,'only direct simple contours');
  const ends=Array.from({length:n},(_,i)=>data.readUInt16BE(10+i*2)),points=ends.at(-1)+1;
  let at=10+n*2;assert.equal(data.readUInt16BE(at),0,'no TrueType instructions');at+=2;
  for(let i=0;i<points;i++)assert.equal(data[at++],1,'explicit on-curve point');
  const coordinates=Array.from({length:points},()=>[0,0]);
  for(let dimension=0;dimension<2;dimension++){let p=0;for(let i=0;i<points;i++){p+=data.readInt16BE(at);at+=2;coordinates[i][dimension]=p;}}
  assert(at<=data.length);assert(data.subarray(at).every(n=>n===0));
  let first=0;const contours=ends.map(last=>{const path=coordinates.slice(first,last+1);first=last+1;return path;});
  return{box,contours};
}

test('self-contained WOFF is deterministic, hash-bound and structurally valid with exact sfnt checksums',()=>{
  execFileSync('python3',[new URL('tools/build-painted-webfont.py',root).pathname,'--check']);
  assert.equal(woff.toString('ascii',0,4),'wOFF');assert.equal(woff.readUInt32BE(4),0x10000);
  assert.equal(woff.readUInt32BE(8),woff.length);assert.equal(woff.readUInt16BE(14),0);
  assert.equal(sha(woff),manifest.sha256);assert.equal(manifest.sourceSHA256,sha(readFileSync(new URL(manifest.source,root))));
  assert.deepEqual(manifest.externalDependencies,[]);
  assert.deepEqual(entries.map(e=>e.tag),entries.map(e=>e.tag).sort());
  let next=44+entries.length*20;
  for(const e of entries){
    assert.equal(e.offset,next);assert.equal(e.offset%4,0);assert(e.compressed<=e.length);
    assert.equal(tables.get(e.tag).length,e.length);assert(e.offset+e.compressed<=woff.length);
    const check=Buffer.from(tables.get(e.tag));if(e.tag==='head')check.fill(0,8,12);
    assert.equal(sum(check),e.checksum,e.tag+' checksum');
    next=e.offset+pad(Buffer.alloc(e.compressed)).length;
  }
  assert.equal(next,woff.length);
  const n=entries.length,power=2**Math.floor(Math.log2(n)),header=Buffer.alloc(12),directory=Buffer.alloc(16*n);header.writeUInt32BE(0x10000);header.writeUInt16BE(n,4);header.writeUInt16BE(16*power,6);header.writeUInt16BE(Math.log2(power),8);header.writeUInt16BE(16*(n-power),10);
  let offset=12+16*n;const body=[];
  entries.forEach((e,i)=>{const at=i*16;directory.write(e.tag,at);directory.writeUInt32BE(e.checksum,at+4);directory.writeUInt32BE(offset,at+8);directory.writeUInt32BE(e.length,at+12);const data=pad(tables.get(e.tag));body.push(data);offset+=data.length;});
  const sfnt=Buffer.concat([header,directory,...body]);assert.equal(sum(sfnt),0xb1b0afba);assert.equal(sfnt.length,woff.readUInt32BE(16));assert.equal(sha(sfnt),manifest.sfntSHA256);
});

test('Unicode cmap covers the exact vector alphabet, all Czech letters and wrapper punctuation',()=>{
  const codes=Object.keys(face.glyphs).map(c=>c.codePointAt(0)).sort((a,b)=>a-b);
  assert.deepEqual(codes,manifest.codepoints);assert.equal(glyphCount,codes.length+1);
  for(let i=0;i<codes.length;i++)assert.equal(cmapLookup(codes[i]),i+1,'U+'+codes[i].toString(16));
  for(const c of 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ„“”‘’–—…0123456789')assert(cmapLookup(c.codePointAt(0))>0,c);
  assert.equal(cmapLookup(0x2603),0);assert.equal(cmapLookup(0xffff),0);
});

test('every decoded TrueType contour and advance matches frozen Canvas geometry without losing counters or accents',()=>{
  const hmtx=tables.get('hmtx'),loca=tables.get('loca'),head=tables.get('head');
  assert.equal(head.readUInt32BE(12),0x5f0f3cf5);assert.equal(head.readUInt16BE(18),1000);assert.equal(head.readInt16BE(50),1);
  assert.equal(loca.length,(glyphCount+1)*4);assert.equal(hmtx.length,glyphCount*4);
  let last=0;
  for(let i=0;i<=glyphCount;i++){const offset=loca.readUInt32BE(i*4);assert(offset>=last&&offset<=tables.get('glyf').length);assert.equal(offset%4,0);last=offset;}
  assert.equal(last,tables.get('glyf').length);
  const chars=[null,...manifest.codepoints.map(c=>String.fromCodePoint(c))];
  for(let id=0;id<glyphCount;id++){
    const source=face.glyphs[chars[id]??'?'],actual=decodeGlyph(id),expected=source.contours.map(path=>path.map(([x,y])=>[Math.round(x*100),Math.round((face.baseline-y)*100)]));
    assert.deepEqual(actual.contours,expected,chars[id]+' exact contour geometry');assert.equal(hmtx.readUInt16BE(id*4),Math.round(source.advance*100));
    if(expected.length){const points=expected.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);assert.deepEqual(actual.box,[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]);assert.equal(hmtx.readInt16BE(id*4+2),actual.box[0]);}
  }
});

test('TrueType nonzero winding preserves source foreground, empty counters and the Czech ring hole',()=>{
  const winding=(paths,x,y)=>{
    let n=0;
    for(const path of paths)for(let i=0;i<path.length;i++){
      const a=path[i],b=path[(i+1)%path.length],cross=(b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1]);
      if(a[1]<=y){if(b[1]>y&&cross>0)n++;}else if(b[1]<=y&&cross<0)n--;
    }
    return n!==0;
  };
  const native=JSON.parse(readFileSync(new URL('art/hd-v3/icons/fonts.json',root))).fonts['NEW8P.FNT'];
  for(let code=33;code<127;code++){
    const row=native.chars[code];if(!row?.width)continue;
    const paths=decodeGlyph(cmapLookup(code)).contours,source=Buffer.from(row.nibblesBase64,'base64');
    for(let y=0;y<11;y++)for(let x=0;x<row.width;x++){
      const expected=y>=row.unusedLines&&y<row.unusedLines+row.usedLines&&source[(y-row.unusedLines)*row.width+x]===1;
      assert.equal(winding(paths,(x+.5)*100,(8-y-.5)*100),!!expected,`${code} native cell ${x},${y}`);
    }
  }
  for(const char of ['ů','Ů']){
    const contours=decodeGlyph(cmapLookup(char.codePointAt(0))).contours,inner=contours.at(-1),cx=inner.reduce((sum,p)=>sum+p[0],0)/inner.length,cy=inner.reduce((sum,p)=>sum+p[1],0)/inner.length;
    assert(!winding(contours,cx,cy),char+' ring remains hollow');
    assert(winding(contours,cx+60,cy),char+' ring stroke remains visible');
  }
});

test('CSS metrics reserve Czech ascenders/descenders and preserve proportional compact native spacing',()=>{
  const head=tables.get('head'),hhea=tables.get('hhea'),os2=tables.get('OS/2');
  assert.equal(os2.length,96);assert.equal(os2.readUInt16BE(0),4);assert.equal(os2.readUInt16BE(4),400);
  assert.equal(os2.readInt16BE(88),700,'cap height is70% of CSS em');
  assert(hhea.readInt16BE(4)>=head.readInt16BE(42));assert(hhea.readInt16BE(6)<=head.readInt16BE(38));
  assert.equal(os2.readInt16BE(68),hhea.readInt16BE(4));assert.equal(os2.readInt16BE(70),hhea.readInt16BE(6));assert.equal(os2.readInt16BE(72),hhea.readInt16BE(8));
  assert(os2.readUInt16BE(62)&0x100,'use consistent typo metrics');
  assert(face.glyphs.I.advance<face.glyphs.W.advance,'proportional, not typewriter spacing');
  assert.equal(tables.get('post').readUInt32BE(12),0,'proportional post flag');
  assert(tables.get('name').includes(Buffer.from('Arrakis Console','utf16le').swap16()));
});
