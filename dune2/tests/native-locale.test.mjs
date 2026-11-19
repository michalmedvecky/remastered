import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadNativeLocale,applyNativeLocale,ENGLISH_SHELL,shellText} from '../dist/native-locale.mjs';
import {decodeNativeText} from '../dist/native-text.mjs';
import {glyphCharacter,glyphRuns} from '../dist/painted-ui-core.mjs';

const baseURL=new URL('../dist/',import.meta.url);
const fileFetch=async url=>{const bytes=await readFile(url);return{ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};

test('Czech byte decoding preserves actual diacritics, while English retains CP437 save text',()=>{
  assert.equal(decodeNativeText([0x8e,0x6c,0x75,0x9d,0x6f,0x75,0xe8,0x6b,0xfd,0x20,0x6b,0xf9,0xf2],'windows-1250'),'Žluťoučký kůň');
  assert.equal(decodeNativeText([0x82,0xa0,0xe1]),'éáß');
  assert.equal(glyphCharacter(0xc8,'windows-1250'),'Č');
  assert.equal(glyphCharacter(127),'');
  assert.throws(()=>decodeNativeText([256]));assert.throws(()=>decodeNativeText([-1]));
  assert.throws(()=>decodeNativeText([65],'utf-8'));
  const runs=glyphRuns([{char:0xc8,x:0,y:0,width:7,height:11,advance:7,font:2,serial:1,sourceSerial:1}],{encoding:'windows-1250'});
  assert.equal(runs[0].text,'Č');
});

test('English requires no locale files; complete Czech overlays verify every byte before application',async()=>{
  const en=await loadNativeLocale('en',{fetcher:()=>{throw Error('Unexpected fetch');}});
  assert.equal(en.encoding,'cp437');assert.deepEqual(en.resources,[]);
  const cs=await loadNativeLocale('cs',{baseURL,fetcher:fileFetch});
  assert.equal(cs.complete,true);assert.equal(cs.resources.length,cs.files.length);assert.ok(cs.resources.length>=20);
  assert.equal(cs.fontCount,254);
  assert.deepEqual(Object.keys(cs.shell).sort(),Object.keys(ENGLISH_SHELL).sort());
  assert.equal(shellText(cs,'arrivalTitle'),'Koření\nmusí proudit.');
  assert.equal(shellText(cs,'imported',{names:'SAVE001.DAT'}),'Importováno: SAVE001.DAT. Ve hře otevřete nabídku Načíst hru.');
});

test('locale loading rejects incomplete data, traversal, duplicate files and changed bytes',async()=>{
  const original=JSON.parse(await readFile(new URL('locales/cs.json',baseURL)));
  const check=async mutate=>{
    const manifest=structuredClone(original);mutate(manifest);
    const fetcher=async url=>String(url).endsWith('/cs.json')?{ok:true,json:async()=>manifest}:fileFetch(url);
    await assert.rejects(loadNativeLocale('cs',{baseURL,fetcher}));
  };
  await check(m=>m.complete=false);
  await check(m=>m.files[0].src='../DUNE.PAK');
  await check(m=>m.files[0].name='../DUNE.PAK');
  await check(m=>m.files.push(m.files[0]));
  await check(m=>m.files[0].sha256='0'.repeat(64));
});

test('virtual Czech overlays leave original PAKs and shared save content untouched',async()=>{
  const locale=await loadNativeLocale('cs',{baseURL,fetcher:fileFetch});
  const config=Uint8Array.of(1,2,3,4,5,6,7,8,2,10),writes=new Map();
  const core={FS:{readFile:path=>{assert.equal(path,'/save/DUNE.CFG');return config;},writeFile:(path,bytes)=>writes.set(path,bytes.slice())}};
  applyNativeLocale(core,locale);
  assert.equal(config[8],2);assert.equal(writes.get('/save/DUNE.CFG')[8],0);
  assert.equal(writes.size,locale.resources.length+1);
  assert.ok([...writes.keys()].every(path=>path==='/save/DUNE.CFG'||/^\/data\/[A-Z0-9_-]+\.(ENG|FNT|CPS|SHP)$/.test(path)));
  assert.ok(![...writes.keys()].some(path=>/\.PAK|\.DAT/.test(path)));
  assert.throws(()=>applyNativeLocale(core,{locale:'cs',resources:[{name:'../DUNE.PAK',bytes:new Uint8Array(1)}]}));
});
