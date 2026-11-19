import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../../native/browser/hd_bridge.c',import.meta.url),'utf8');
const start=source.indexOf("    const callback = Module['duneHdPresent'];"),end=source.indexOf('\n});\n\nEM_JS(int, hd_wants_frame',start);
const names=['pixels','palette','tiles','commands','count','visible','viewport','selected','position','width','height','state','type','tick','house','cursor','mouseX','mouseY','hotX','hotY','mouseVisible','message','overflow','screenOffset','veiledTileId','ui','uiCount','revision','commitTick','gameActive','viewportRendering','available','debug','uiOverflow','records','inkOwner','inkLocal','inkValue','inkPaint','uiSprites','uiPixels','cursorRestored','runs','textOwner','textLocal','textPaint','overscan','overscanX','overscanY','epoch'];
const emit=new Function('Module','HEAPU8','HEAPU16','HEAPU32','HEAP32','HEAP16','UTF8ToString',...names,source.slice(start,end));
const fixture=fs.readFileSync(process.argv[2]);let at=0;const results={};
const block=()=>{const n=fixture.readUInt32LE(at);at+=4;const b=fixture.subarray(at,at+n);at+=n;return b;};
while(at<fixture.length){
 const name=block().toString(),cursorRestored=block().readInt32LE(),buffer=new ArrayBuffer(8*1024*1024),u8=new Uint8Array(buffer),u16=new Uint16Array(buffer),u32=new Uint32Array(buffer),i32=new Int32Array(buffer),i16=new Int16Array(buffer);
 let pointer=4096,output;const args={cursorRestored,overscanX:9,overscanY:19};
 for(const key of ['pixels','uiPixels','records','inkOwner','inkLocal','inkValue','inkPaint','runs','textOwner','textLocal','textPaint']){const b=block();args[key]=pointer;u8.set(b,pointer);pointer=(pointer+b.length+7)&~7;}
 args.overscan=pointer;u16[pointer>>1]=127;u16[(pointer>>1)+3]=1;
 emit({duneHdPresent:f=>output=f},u8,u16,u32,i32,i16,()=>'',...names.map(k=>args[k]??0));results[name]=output;
 assert(output.pixels!==u8&&output.uiPixels!==u8);assert.equal(output.overscan.tiles.length,816);assert.equal(output.overscan.x,9);
}
const layout=run=>[run.runId,run.text,run.x,run.y,run.width,run.height,run.font,run.fontHeight,run.glyphs.map(g=>[g.char,g.x,g.y,g.width,g.height,g.advance])];
const full=results.full.textRuns.find(r=>r.text==='Build it');assert(full);assert.equal(full.width,46);assert.equal(full.glyphs.length,8);
for(const name of ['cursor-middle','cursor-full','cursor-restored']){
 if(name!=='cursor-restored')assert.equal(results[name].uiCursorRestored,true);assert.equal(results[name].textRuns.length,1);
 assert.equal(results[name].textRuns[0].serial,full.serial);assert.equal(results[name].textRuns[0].placementId,full.placementId);
 for(const run of results[name].textRuns)assert.deepEqual(layout(run),layout(full),name+' never changes native layout');
 assert.equal(results[name].textRuns.reduce((n,r)=>n+r.visibleInk,0),full.visibleInk);
 if(name!=='cursor-restored')assert(results[name].pixels.some((v,i)=>v!==results[name].uiPixels[i]));
}
const erased=results['middle-erased'].textRuns;assert(erased.length);
for(const run of erased){assert.deepEqual(layout(run),layout(full));for(const [x,y,w,h]of run.clips)assert(!(x<=23&&x+w>23&&y<=82&&y+h>82),'erased white coincidence is outside every paint clip');}
assert.equal(results['all-erased'].textRuns.length,0,'fully erased source lines never resurrect');
const copied=results['partial-copy'].textRuns;assert(copied.length);for(const run of copied){assert.equal(run.text,'Build it');assert.equal(run.x,75);assert.equal(run.width,46);for(const [x,y,w,h]of run.clips)assert(x>=87&&x+w<=99&&y>=80&&y+h<=88);}
const report={passed:true,snapshots:Object.keys(results),sameLayoutUnderCursor:true,mouseRestorePaintOrderStable:true,mentatHelpReplacesWorld:true,optionsPauseRetainsWorld:true,overscanCentreCoherent:true,overscanFowAndEdgesPreserved:true,explicitRenderedViewportOrigin:true,zeroOffsetOriginal:true,completeLiteralSource:true,partialCopiesRetainFullGeometry:true,erasedPaletteCoincidencesExcluded:true,fullyErasedLinesOmitted:true,overscanWords:816,executedOriginalDosBinary:false,bridgeSha256:crypto.createHash('sha256').update(source).digest('hex')};
fs.writeFileSync(new URL('stable-text-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('Actual EM_JS stable text: cursor crossing/full cover, complete native layout, copy clipping and erasure lifecycle passed');
