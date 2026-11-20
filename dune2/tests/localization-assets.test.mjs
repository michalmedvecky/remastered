import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {decodeNativeText} from '../dist/native-text.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const json=p=>JSON.parse(read(p));
const locale=json('dist/locales/cs.json'),corpus=json('art/localization/en.json');
const translations=Object.assign({},...['core','houses','help','protect'].map(n=>json('art/localization/cs-'+n+'.json').translations));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pairs=' etainosrlhcdupm'+'tasio wb'+' rnsdalm'+'h ieoras'+'nrtlc sy'+'nstcloer'+' dtgesio'+'nr ufmsw'+' tep.ica'+'e oiadur'+' laeiyod'+'eia otru'+'etoakhlr'+' eiu,.oa'+'nsrctlai'+'leoiratp'+'eaoip bm';
function unpack(bytes){const out=[];for(let p=0;p<bytes.length&&bytes[p];p++){let c=bytes[p];if(c&128){c&=127;out.push(pairs.charCodeAt(c>>3));c=pairs.charCodeAt(c+16);}else if(c===27)c=127+bytes[++p];out.push(c);}return Uint8Array.from(out);}
const decoded=(bytes,compressed=false)=>decodeNativeText(compressed?unpack(bytes):bytes,'windows-1250');
function table(body,compressed){const count=body.readUInt16LE(0)/2,rows=[];for(let i=0;i<count;i++){const p=body.readUInt16LE(i*2),end=body.indexOf(0,p);assert(p>=count*2&&end>=p&&end<body.length,'bounded NUL string');rows.push(decoded(body.subarray(p,end),compressed));}return rows;}
function font(body){const start=body.readUInt16LE(4),data=body.readUInt16LE(6),widths=body.readUInt16LE(8),count=body.readUInt16LE(10)-widths,lines=body.readUInt16LE(12),chars={};assert.equal(body.readUInt16LE(2),0x500);for(let c=0;c<count;c++){const w=body[widths+c],top=body[lines+c*2],height=body[lines+c*2+1],p=body.readUInt16LE(data+c*2),pixels=[];if(p)for(let y=0;y<height;y++)for(let x=0;x<w;x++){const at=p+y*Math.ceil(w/2)+(x>>1);assert(at<body.length);pixels.push(body[at]>>((x&1)*4)&15);}chars[c]={width:w,unusedLines:top,usedLines:height,pixels};}return{height:body[start+4],count,chars};}
function shapes(body){const count=body.readUInt16LE(0),frames=[];for(let i=0;i<count;i++){const p=body.readUInt32LE(2+i*4)+2,end=body.readUInt32LE(6+i*4)+2,flags=body.readUInt16LE(p),h=body[p+2],w=body.readUInt16LE(p+3),size=body.readUInt16LE(p+6),expanded=body.readUInt16LE(p+8),palette=flags&1?body.subarray(p+10,p+26):null;assert(flags&2,'locale uses native uncompressed SHP stream');assert.equal(end-p,size);const pixels=[];for(let at=p+(palette?26:10);at<end;){const c=body[at++];if(c)pixels.push(c);else pixels.push(...Array(body[at++]).fill(0));}assert.equal(pixels.length,w*h);assert(expanded<=size);frames.push({w,h,pixels:Buffer.from(pixels),palette});}return frames;}

test('Czech overlay is complete, independently hash-bound and safely inside native16-bit and48KiB limits',()=>{
 assert.equal(locale.locale,'cs');assert.equal(locale.complete,true);assert.deepEqual(locale.coverage.missing,[]);assert.equal(locale.coverage.corpusRecords,1347);assert.equal(locale.files.length,21);
 assert(locale.coverage.runtimeStringBytes<48*1024);assert(locale.coverage.longestNativeString<1024);
 for(const row of locale.files){const body=read('dist/'+row.src);assert.equal(body.length,row.bytes,row.name);assert.equal(sha(body),row.sha256,row.name);assert.match(locale.source.resources[row.name],/^[a-f0-9]{64}$/);}
 assert.equal(locale.source.originalsModified,false);assert.equal(locale.source.originalDosExecuted,false);
});

test('all945 native table entries decode to the retained Czech corpus without changing941 runtime IDs, filenames, printf or controls',()=>{
 let rows=0,runtime=0,available=0,slot=0;const runtimeRows=new Map(),ends={'DUNE.ENG':339,'MESSAGE.ENG':367,'INTRO.ENG':404,'TEXTH.ENG':444,'TEXTA.ENG':484,'TEXTO.ENG':524,'PROTECT.ENG':940};
 for(const resource of corpus.resources.filter(r=>r.kind==='string-table')){
  const value=table(read('dist/locales/cs/'+resource.name),resource.compressed),records=corpus.records.filter(r=>r.resource===resource.name);assert.equal(value.length,records.length);
  for(const r of records){assert.equal(value[r.index],translations[r.id]??r.text,r.id);rows++;if(r.metadata.runtimeLoaded)runtime++;
   assert.deepEqual([...value[r.index]].filter(c=>c.charCodeAt(0)<32).map(c=>c.charCodeAt(0)),r.controls.map(c=>c.byte),r.id+' controls');
   assert.deepEqual(value[r.index].match(/%(?:[-+ #0]*\d*(?:\.\d+)?[hlL]?[diuoxXfFeEgGaAcsp%])/g)??[],r.printf,r.id+' printf');
   if(/\.wsa$/i.test(r.text))assert.equal(value[r.index],r.text,'native resource name '+r.id);
   if(r.resource==='PROTECT.ENG'&&r.index>=12&&(r.index-12)%3===0)assert.match(value[r.index],/^[\x20-\x7e]*$/,'native ASCII answer '+r.id);
  }
  // Independently mirror String_Load's skip/alias/fill semantics. Source
  // MESSAGE/INTRO ordinal0 is empty and must never acquire runtime340/368.
  for(const r of records){if(slot>ends[resource.name])break;const text=value[r.index].trimEnd();if(text||available===0){runtimeRows.set(r.id,slot);available+=text.length+1;slot++;}}
  if(resource.name==='DUNE.ENG'){assert.equal(slot,339);slot++;}
  while(slot<=ends[resource.name])slot++;
 }assert.equal(rows,945);assert.equal(runtime,939);assert.equal(slot,941);assert.equal(available,locale.coverage.runtimeStringBytes);
 for(const r of corpus.records.filter(r=>r.kind==='string-table'))assert.equal(r.nativeStringId,runtimeRows.get(r.id),r.id+' native loader binding');
 assert.equal(runtimeRows.get('MESSAGE.ENG:001'),340);assert.equal(runtimeRows.get('INTRO.ENG:001'),368);assert.equal(runtimeRows.get('PROTECT.ENG:414'),939);assert.equal(locale.coverage.runtimeAliases[0].aliasOfNativeStringId,92);
});

test('all141 Mentat subjects retain campaign gates/selectors and valid rebuilt absolute body offsets/INFO read bounds',()=>{
 for(const name of ['MENTATA.ENG','MENTATH.ENG','MENTATO.ENG']){
  const body=read('dist/locales/cs/'+name),chunks={};assert.equal(body.subarray(0,4).toString(),'FORM');assert.equal(body.readUInt32BE(4),body.length-8);assert.equal(body.subarray(8,12).toString(),'MENT');
  for(let p=12;p<body.length;){const tag=body.subarray(p,p+4).toString(),length=body.readUInt32BE(p+4);assert(p+8+length<=body.length);chunks[tag]={start:p+8,end:p+8+length};p+=8+length+(length&1);}
  const subjects=corpus.records.filter(r=>r.resource===name&&r.kind==='help-subject');let p=chunks.NAME.start,maxDecoded=0,maxStored=0;
  for(const subject of subjects){const length=body[p],end=p+length,offset=body.readUInt32BE(p+1),nul=body.indexOf(0,offset),b=corpus.records.find(r=>r.resource===name&&r.index===subject.index&&['help-selector','help-body'].includes(r.kind));
   assert.equal(decoded(body.subarray(p+7,end-2)),translations[subject.id]);assert.equal(body[end-1],subject.metadata.campaignGate);assert.equal(body.subarray(p+5,p+7).toString('hex'),subject.metadata.flagsHex);assert(offset>=chunks.DESC.start&&nul<chunks.DESC.end);
   assert.equal(decoded(body.subarray(offset,nul),true),b.kind==='help-selector'?b.text:b.metadata.prefix+translations[b.id],b.id);maxDecoded=Math.max(maxDecoded,unpack(body.subarray(offset,nul)).length+1);maxStored=Math.max(maxStored,nul-offset+1);p=end;
  }
  assert.equal(p,chunks.NAME.end);assert.equal(body.readUInt32BE(chunks.INFO.start),47);assert.equal(body.readUInt32BE(chunks.INFO.start+4),maxDecoded);assert.equal(body.readUInt32BE(chunks.INFO.start+8),maxStored);
 }
});

test('all active native fonts extend safely to254 slots, preserve every ASCII glyph and provide Czech foreground ink with the original advances',()=>{
 const original=json('art/hd-v3/icons/fonts.json'),reverse=new Map();for(let c=128;c<254;c++){try{reverse.set(decodeNativeText([c],'windows-1250'),c);}catch{}}
 for(const name of ['INTRO.FNT','NEW6P.FNT','NEW8P.FNT']){
  const f=font(read('dist/locales/cs/'+name));assert.equal(f.count,254);assert(f.count<256,'uint8 native count');assert.equal(f.height,original.fonts[name].height);
  for(let c=0;c<128;c++){const expected=original.fonts[name].chars[c],actual=f.chars[c];assert.equal(actual.width,expected.width);assert.equal(actual.unusedLines,expected.unusedLines);assert.equal(actual.usedLines,expected.usedLines);if(expected.dataOffset)assert.deepEqual(Buffer.from(actual.pixels),Buffer.from(expected.nibblesBase64,'base64'));}
  for(const letter of 'ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž'){const c=reverse.get(letter),g=f.chars[c],base=letter.normalize('NFD')[0];assert(c<254);assert(g.pixels.includes(1),name+' foreground '+letter);assert.equal(g.width,original.fonts[name].chars[base.charCodeAt(0)].width);assert(g.unusedLines+g.usedLines<=f.height);assert.equal(locale.fonts[name].chars[c].nibblesBase64,Buffer.from(g.pixels).toString('base64'));}
 }
});

test('native Czech SHP overlays and indexed scene witnesses exactly describe emitted files, preserving the DUNEII proper-name logo',()=>{
 for(const[name,first]of [['BTTN.ENG',7],['CHOAM.ENG',355],['MENTAT.ENG',373]]){
  const rows=shapes(read('dist/locales/cs/'+name));for(const[id,expected]of Object.entries(locale.uiFrames).filter(([,r])=>r.resource===name)){const r=rows[Number(id)-first];assert.equal(r.w,expected.sourceW);assert.equal(r.h,expected.sourceH);assert.deepEqual(r.pixels,Buffer.from(expected.indicesBase64,'base64'));assert.deepEqual(Buffer.from(Uint8Array.from(r.pixels,c=>Number(c!==0))),Buffer.from(expected.maskBase64,'base64'));}
 }
 for(const[name,row]of Object.entries(locale.scenes)){const body=read('dist/locales/cs/'+name);assert.equal(body.readUInt16LE(2),0);assert.equal(body.readUInt32LE(4),64000);const indices=body.subarray(10+body.readUInt16LE(8));assert.deepEqual(indices,Buffer.from(row.indicesBase64,'base64'));for(const[x,y,c]of row.witnesses)assert.equal(indices[y*320+x],c);}
 const originalTitle=json('dist/painted/interface.json').scenes['TITLE.ENG'];if(originalTitle?.indicesBase64){const source=Buffer.from(originalTitle.indicesBase64,'base64'),localized=Buffer.from(locale.scenes['TITLE.ENG'].indicesBase64,'base64');assert.deepEqual(localized.subarray(0,320*104),source.subarray(0,320*104));}
});
