// Exercise the actual EM_JS body with a synthetic native heap, no game execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../native/browser/hd_bridge.c',import.meta.url),'utf8');
const a=source.indexOf("    const callback = Module['duneHdPresent'];");
const b=source.indexOf('\n});\n\nEM_JS(int, hd_wants_frame',a);
assert(a>=0&&b>a);
const names=['pixels','palette','tiles','commands','count','visible','viewport','selected','position','width','height','state','type','tick','house','cursor','mouseX','mouseY','hotX','hotY','mouseVisible','message','overflow','screenOffset','veiledTileId','ui','uiCount','revision','commitTick','gameActive','viewportRendering','available','debug','uiOverflow','records','inkOwner','inkLocal','inkValue','inkPaint','uiSprites','uiPixels','cursorRestored','runs','textOwner','textLocal','textPaint','overscan','overscanX','overscanY','epoch'];
const heap=new ArrayBuffer(4*1024*1024),u8=new Uint8Array(heap),u16=new Uint16Array(heap),u32=new Uint32Array(heap),i32=new Int32Array(heap);
let frame;const Module={duneHdPresent:f=>frame=f};
const run=new Function('Module','HEAPU8','HEAPU16','HEAPU32','HEAP32','HEAP16','UTF8ToString',...names,source.slice(a,b));
const ptr={pixels:0,palette:64000,tiles:64768,commands:66000,records:70000,inkOwner:140000,inkLocal:400000,inkValue:530000,inkPaint:600000,uiSprites:900000,uiPixels:0,runs:1000000,textOwner:2000000,textLocal:2300000,textPaint:2500000,overscan:2800000};
const v=new Int32Array(heap,ptr.records,11);v.set([1,65,2,5,8,4,0,0,0,12,2]);u8.set([0,15],ptr.records+44);
const p=30*320+40,q=31*320+42;
u8[p]=u8[q]=15;u32[(ptr.inkOwner>>2)+p]=u32[(ptr.inkOwner>>2)+q]=1;u32[(ptr.records+60)>>2]=1;
u16[(ptr.inkLocal>>1)+q]=322;u8[ptr.inkValue+p]=u8[ptr.inkValue+q]=15;
u32[(ptr.inkPaint>>2)+p]=u32[(ptr.inkPaint>>2)+q]=19;
const args={...ptr,visible:1,available:1,revision:7,commitTick:99,gameActive:0,viewportRendering:1,veiledTileId:123};
const present=()=>run(Module,u8,u16,u32,i32,new Int16Array(heap),()=>'',...names.map(n=>args[n]??0));
present();
assert.equal(frame.version,2);assert.equal(frame.worldVisible,true);assert.equal(frame.gameplayActive,false);
assert.equal(frame.worldRevision,7);assert.equal(frame.worldCommitTick,99);
assert.equal(frame.textGlyphs.length,1);
assert.deepEqual(frame.textGlyphs[0].ink,[[0,0,15],[2,1,15]]);
assert.deepEqual(frame.textGlyphs[0].clip,[40,30,3,2]);
assert.equal(frame.textGlyphs[0].char,65);assert.equal(frame.textGlyphs[0].font,2);assert.equal(frame.textGlyphs[0].advance,4);
// An uninstrumented raster overwrite cannot keep a stale glyph pixel alive.
u8[p]=6;present();assert.equal(frame.textGlyphs[0].visibleInk,1);
assert.deepEqual(frame.textGlyphs[0].clip,[42,31,1,1]);
u8[q]=6;present();assert.equal(frame.textGlyphs.length,0);
// The same ledger encodes borders with exact native rectangle and widget identity.
u8[q]=15;v.set([2,0,1,64,32,0,19,2,1,12,2]);present();
assert.equal(frame.textGlyphs.length,0);assert.equal(frame.borders[0].widgetIndex,19);
assert.equal(frame.borders[0].width,64);assert.equal(frame.borders[0].pressed,true);assert.equal(frame.borders[0].fill,false);assert.equal(frame.borders[0].schemaIndex,1);
// Visible UI sprites use the same copied ink provenance, preserving native
// command flags/palettes while relocating its widget clip with the copy.
v.set([3,0,0,16,24,0,0,0,0,12,2]);
const command=new Int32Array(heap,ptr.uiSprites,16);
command.set([18,16,70,16,24,0,0,40,320,160,0,0,0,0,-1,4]);
present();
assert.equal(frame.uiCommands.length,1);assert.equal(frame.borders.length,0);
assert.equal(frame.uiCommands[0].id,18);assert.equal(frame.uiCommands[0].screen,0);
assert.equal(frame.uiCommands[0].x,40);assert.equal(frame.uiCommands[0].y,30);
assert.deepEqual(frame.uiCommands[0].nativeClip,[24,0,320,160]);
assert.deepEqual(frame.uiCommands[0].ink,[[2,1,15]]);
assert.equal(frame.uiCandidates.length,0);
command[5]=0x600;u16[(ptr.uiSprites+80)>>1]=5;u16[(ptr.uiSprites+82)>>1]=256;u16[(ptr.uiSprites+84)>>1]=0;
u8[ptr.uiSprites+86]=66;u8[ptr.uiSprites+87]=76;present();
assert.equal(frame.uiCommands[0].blurOffset,5);assert.equal(frame.uiCommands[0].blurIncrement,256);
assert.equal(frame.uiCommands[0].blurSeed,0);assert.equal(frame.uiCommands[0].remap,null);
// Actual remap tables keep their bytes and are never decoded as blur metadata.
command[12]=1;present();assert.equal(frame.uiCommands[0].blurOffset,undefined);
console.log('Actual observer EM_JS ABI: committed/paused flags, relocated glyph ink, stale-index rejection and borders passed');
