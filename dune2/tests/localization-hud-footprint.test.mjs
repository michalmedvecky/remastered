import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),json=name=>JSON.parse(readFileSync(new URL(name,root)));
const locale=json('dist/locales/cs.json'),core=json('art/localization/cs-core.json').translations;

test('Czech damage abbreviation fits the original native NEW6P status footprint without wrapping',()=>{
 // GUI_Widget_ActionPanel_Draw: STR_DMG at296,65,flags0x11. The wrapper
 // selects NEW6P and char offset−2; GUI_DrawText wraps at screen x320.
 const text=core['DUNE.ENG:049'];assert.equal(text,'ŠKD');
 const font=locale.fonts['NEW6P.FNT'],reverse=new Map();
 const decoder=new TextDecoder('windows-1250',{fatal:true});
 for(let c=0;c<254;c++){try{reverse.set(decoder.decode(Uint8Array.of(c)),c);}catch{}}
 function simulate(value){
  let x=296,y=65,advance=0;const ink=[],positions=[];
  for(const char of value){
   const code=reverse.get(char),g=font.chars[code],width=g.width-2;
   if(x+width>320){x=296;y+=font.height;}
   positions.push({char,x,y,boxRight:x+g.width});
   // GUI_DrawChar also rejects an entire glyph whose allocated box crosses
   // the edge. Nibble1 is the only foreground in wrapper style0x10.
   if(x+g.width<=320){const data=Buffer.from(g.nibblesBase64,'base64');for(let yy=0;yy<g.usedLines;yy++)for(let xx=0;xx<g.width;xx++)if(data[yy*g.width+xx]===1)ink.push([x+xx,y+g.unusedLines+yy]);}
   x+=width;advance+=width;
  }
  return{advance,positions,ink,left:Math.min(...ink.map(p=>p[0])),right:Math.max(...ink.map(p=>p[0]))+1,top:Math.min(...ink.map(p=>p[1])),bottom:Math.max(...ink.map(p=>p[1]))+1};
 }
 const original=simulate('DMG'),translated=simulate(text),tooLong=simulate('ŠKODY');
 assert.equal(original.advance,16);assert.equal(translated.advance,15);
 assert(translated.advance<=original.advance);assert(translated.right<=original.right);
 assert(translated.left>=296&&translated.right<=320&&translated.top>=65&&translated.bottom<=65+font.height);
 assert(translated.positions.every(p=>p.y===65&&p.boxRight<=320),'all three glyph boxes remain on the original status row');
 assert.equal(tooLong.positions.at(-1).char,'Y');assert.equal(tooLong.positions.at(-1).y,73,'old five-letter translation reproduces the observed split');
});

test('all native unit/structure abbreviation IDs and action captions fit their actual NEW6P spacing',()=>{
 const audit=json('fidelity/presentation-fixes/czech-hud-footprint-audit.json');
 const read=p=>readFileSync(new URL(p,root)),hash=body=>createHash('sha256').update(body).digest('hex');
 for(const[path,digest]of Object.entries(audit.sourceSHA256))assert.equal(hash(read(path)),digest,path+' audit source binding');
 const symbols=new Map([...read('native/opendune/src/table/strings.h').toString().matchAll(/\b(STR_\w+)\s*=\s*(\d+)/g)].map(m=>[m[1],Number(m[2])]));
 const corpus=json('art/localization/en.json'),nativeRecords=new Map(corpus.records.filter(r=>Number.isInteger(r.nativeStringId)).map(r=>[r.nativeStringId,r]));
 const parsed=[];
 for(const[file,kind,count]of [['unitinfo.c','unit',27],['structureinfo.c','structure',19]]){
  const matches=[...read('native/opendune/src/table/'+file).toString().matchAll(/\/\*\s*stringID_abbrev\s*\*\/\s*(STR_\w+),\s*\/\*\s*name\s*\*\/\s*"([^"]+)",\s*\/\*\s*stringID_full\s*\*\/\s*(STR_\w+)/g)];
  assert.equal(matches.length,count);for(const[index,m]of matches.entries())parsed.push({kind,index,symbol:m[1],nativeStringId:symbols.get(m[1])});
 }
 assert.deepEqual(audit.headers.map(({kind,index,symbol,nativeStringId})=>({kind,index,symbol,nativeStringId})),parsed,'generated evidence follows every actual native table row');
 const actionSymbols=[...read('native/opendune/src/table/actioninfo.c').toString().matchAll(/\/\*\s*stringID\s*\*\/\s*(STR_\w+),/g)].map(m=>m[1]);
 assert.equal(actionSymbols.length,14);assert.deepEqual(audit.actions.map(r=>r.symbol),actionSymbols);
 assert.deepEqual(audit.headerSettings,{flags:'0x111',font:'NEW6P.FNT',charOffset:-2});assert.deepEqual(audit.actionSettings,{flags:'0x121',font:'NEW6P.FNT',charOffset:-1});
 assert(audit.actionWidgetRects.every(r=>r[0]===258&&r[2]===60&&r[3]===10));
 const body=read('dist/locales/cs/NEW6P.FNT'),widthOffset=body.readUInt16LE(8),decoder=new TextDecoder('windows-1250',{fatal:true}),reverse=new Map();
 for(let c=0;c<254;c++){try{reverse.set(decoder.decode(Uint8Array.of(c)),c);}catch{}}
 for(const rows of [audit.headers,audit.actions])for(const row of rows){
  if(row.displayed===false){assert.equal(row.nativeStringId,0);continue;}
  assert.equal(row.nativeStringId,symbols.get(row.symbol));const record=nativeRecords.get(row.nativeStringId);assert.equal(record.id,row.recordId);
  const text=core[record.id]??record.text;assert.equal(text,row.czech);
  const offset=rows===audit.headers?-2:-1,advance=[...text].reduce((n,char)=>n+body[widthOffset+reverse.get(char)]+offset,0);
  assert.equal(advance,row.footprint.advance);assert(advance<=60,row.symbol+' '+text+' native width '+advance);
  for(const[x,y,w]of row.footprint.glyphBoxes)assert(x>=256&&x+w<=320,row.symbol+' allocated glyph box remains visible');
 }
 assert.deepEqual(audit.failures,[]);assert.equal(audit.coverage.displayedHeadingRows,38);assert.equal(audit.runtimeStringBytes,locale.coverage.runtimeStringBytes);assert.equal(locale.coverage.translations,1338);
 assert.equal(core['DUNE.ENG:005'],'Hlídka');assert.equal(core['DUNE.ENG:006'],'Těžit');assert.equal(core['DUNE.ENG:012'],'Lovit');
 for(const[id,text]of [[200,'Těž. pěchota'],[214,'Obléh. tank'],[218,'Son. tank'],[222,'Přep. třík.']])assert.equal(core['DUNE.ENG:'+String(id).padStart(3,'0')],text);
 for(const[id,text]of [[201,'Družstvo těžké pěchoty'],[215,'Těžký obléhací tank'],[219,'Tank se sonickou zbraní'],[223,'Rychlá přepadová tříkolka']])assert.equal(core['DUNE.ENG:'+String(id).padStart(3,'0')],text,'full description retained');
});
