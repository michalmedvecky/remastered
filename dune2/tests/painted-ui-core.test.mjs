import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intersectRect, glyphCharacter, glyphInkVisibility, uiSpriteVisibility, glyphRuns, observedTextRuns, campaignScene, observedHelpScrollbar, sameUIPixels, uiPresentationSignature, fitTextBox, nineSlices} from '../dist/painted-ui-core.mjs';

test('UI ink witnesses reject stale strings and sprites after the native buffer is overwritten', () => {
  const pixels = new Uint8Array(64000);
  pixels[11 * 320 + 11] = 15;
  const glyph = {char: 65, x: 10, y: 10, width: 4, height: 6, ink: [[1, 1, 15]], clip: [0, 0, 320, 200]};
  assert.equal(glyphInkVisibility(glyph, pixels).ratio, 1);
  pixels[11 * 320 + 11] = 12;
  assert.equal(glyphInkVisibility(glyph, pixels).ratio, 0);
  const source = {sourceW: 2, sourceH: 1, paletteMode: 'global256', indices: Uint8Array.of(15, 6), mask: Uint8Array.of(1, 1)};
  const command = {x: 20, y: 30, width: 2, height: 1, flags: 1};
  pixels[30 * 320 + 20] = 6; pixels[30 * 320 + 21] = 15;
  assert.equal(uiSpriteVisibility(command, source, pixels).ratio, 1, 'native horizontal flip');
  pixels[30 * 320 + 20] = 0; pixels[30 * 320 + 21] = 0;
  assert.equal(uiSpriteVisibility(command, source, pixels).ratio, 0);
});

test('HUD reuse ignores moving world pixels and equivalent epochs but detects same-value clears, ink holes, palette and painter-order changes',()=>{
 const frame={worldVisible:true,playerHouse:1,pixels:new Uint8Array(64000),palette:new Uint8Array(768),textRuns:[{text:'Build it',x:265,y:113,width:47,height:8,visibleInk:2,ink:[[0,0,15],[5,0,15]],clips:[[265,113,47,8]],serial:10,runId:1}],uiCommands:[{id:90,screen:0,x:258,y:51,width:32,height:24,serial:5,ink:[[0,0,15]]}]};
 const next={...frame,pixels:frame.pixels.slice(),palette:frame.palette.slice(),textRuns:frame.textRuns.map(r=>({...r,serial:100,runId:50})),uiCommands:frame.uiCommands.map(c=>({...c,serial:90}))};
 next.pixels[100*320+100]=42;
 assert.equal(sameUIPixels(frame,next),true);assert.equal(uiPresentationSignature(frame),uiPresentationSignature(next));
 const changed={...next,textRuns:[]};assert.equal(sameUIPixels(frame,changed),true);assert.notEqual(uiPresentationSignature(frame),uiPresentationSignature(changed),'provenance clear changes art even when native pixels coincide');
 assert.notEqual(uiPresentationSignature(frame),uiPresentationSignature({...next,textRuns:[{...next.textRuns[0],ink:[[1,0,15],[5,0,15]]}]}),'partial occlusion changes exact native ink');
 assert.notEqual(uiPresentationSignature(frame),uiPresentationSignature({...next,uiCommands:[{...next.uiCommands[0],serial:110}]}),'combined painter order matters');
 next.pixels[10*320+100]=1;assert.equal(sameUIPixels(frame,next),false,'header pixel change');next.pixels[10*320+100]=0;
 next.palette[669]=4;assert.equal(sameUIPixels(frame,next),false,'native palette change');next.palette[669]=0;
 assert.equal(sameUIPixels({...frame,worldVisible:false},{...next,worldVisible:false}),false,'full scene preview pixels are not skipped');
});

test('help scrollbar follows its actual native filled thumb, including press colour and restored mouse pixels',()=>{
 const uiPixels=new Uint8Array(64000).fill(12),pixels=uiPixels.slice();
 const textRuns=[{text:'Select Subject:',x:144,y:50,width:69,height:8,visibleInk:1,clips:[[144,50,69,8]]}];
 for(let y=89;y<110;y++)for(let x=297;x<303;x++)uiPixels[y*320+x]=10;
 const frame={pixels,uiPixels,textRuns};
 assert.deepEqual(observedHelpScrollbar(frame),{track:[296,72,8,72],thumb:{x:297,y:89,width:6,height:21,colour:10}});
 assert.equal(observedHelpScrollbar({...frame,textRuns:[]}),null,'same colours on another scene do not create a help control');
 assert.equal(observedHelpScrollbar({...frame,uiPixels:pixels}).thumb,null,'no actual observed thumb means no invented position');
});

test('campaign backgrounds require independent chrome and nonzero cropped-map evidence, with actual province occlusion',()=>{
 const {scenes}=JSON.parse(readFileSync(new URL('../dist/painted/interface.json',import.meta.url)));
 const decode=name=>Uint8Array.from(Buffer.from(scenes[name].indicesBase64,'base64'));
 const shell=decode('MAPMACH.CPS');for(let y=24;y<144;y++)shell.fill(0,y*320+8,y*320+312);
 assert.equal(campaignScene({pixels:shell},scenes),'MAPMACH.CPS','black well must not match zero-only DUNERGN witnesses');
 for(const name of ['PLANET.CPS','DUNEMAP.CPS','DUNERGN.CPS']){
  const pixels=shell.slice(),source=decode(name);
  for(let y=24;y<144;y++)pixels.set(source.subarray(y*320+8,y*320+312),y*320+8);
  assert.equal(campaignScene({pixels},scenes),name,name+' is a crop inside machine chrome');
  const ink=[];for(let y=50;y<100;y++)for(let x=50;x<100;x++){pixels[y*320+x]=151;ink.push([x-50,y-50,151]);}
  assert.equal(campaignScene({pixels,uiCommands:[{x:50,y:50,ink}]},scenes),name,'real native ownership overlay excluded '+name);
  assert.equal(campaignScene({pixels:new Uint8Array(64000)},scenes),null,'no machine chrome, no campaign');
 }
});

test('native UI text preserves CP437, exact advances, line breaks, clips and style changes', () => {
  const base = {x: 10, y: 20, width: 5, height: 8, advance: 4, font: 2, colours: [0, 15], clip: [8, 20, 40, 8], visibleInk: 4};
  const runs = glyphRuns([{...base, char: 65, serial: 1}, {...base, x: 14, char: 66, serial: 2}, {...base, x: 18, y: 28, char: 67, serial: 3}, {...base, x: 18, char: 68, serial: 4, colours: [0, 6]}]);
  assert.deepEqual(runs.map(r => r.text), ['AB', 'C', 'D']);
  assert.equal(runs[0].width, 9);
  assert.equal(runs[0].nextX, 18);
  assert.equal(glyphCharacter(130), 'é');
  assert.equal(glyphCharacter(10), '');
  assert.deepEqual(intersectRect([0, 0, 10, 10], [8, 8, 4, 4]), [8, 8, 2, 2]);
});

test('nine-slice geometry preserves painted corners and fully covers small and large native widgets', () => {
  for (const rect of [[40, 80, 960, 400], [0, 0, 16, 12]]) {
    const slices = nineSlices([0, 0, 128, 64], rect, [12, 12, 12, 12]);
    const area = slices.reduce((sum, part) => sum + part.target[2] * part.target[3], 0);
    assert.equal(area, rect[2] * rect[3]);
    assert(slices.every(p => p.target[2] > 0 && p.target[3] > 0));
  }
  assert.deepEqual(nineSlices([0, 0, 0, 64], [0, 0, 100, 100]), []);
});

test('HD labels fit their real ink and descenders inside frame padding at all widget sizes', () => {
  for (const [value, rect, padding] of [['MENTAT', [0, 0, 312, 64], [16, 16, 16, 16]], ['Credits', [0, 0, 256, 64], [16, 16, 16, 16]], ['Repair', [0, 0, 240, 32], [4, 4, 4, 4]], ['Const. Yard', [0, 0, 224, 32], [4, 4, 4, 4]], ['7', [0, 0, 32, 32], [3, 3, 3, 3]]]) {
    const layout = fitTextBox(size => ({width: value.length * size * .6, actualBoundingBoxLeft: size * .02, actualBoundingBoxRight: value.length * size * .6, actualBoundingBoxAscent: size * .74, actualBoundingBoxDescent: value === 'Repair' ? size * .24 : size * .04}), rect, {maxSize: rect[3], padding, align: 'center'});
    assert(layout, value);
    const [x, y, w, h] = layout.ink;
    assert(x >= padding[0] - 1e-6 && y >= padding[1] - 1e-6, value + ' top/left');
    assert(x + w <= rect[2] - padding[2] + 1e-6 && y + h <= rect[3] - padding[3] + 1e-6, value + ' right/bottom');
    assert(layout.fontSize < rect[3], value + ' font size adapts to actual ink');
  }
});

test('occluded letters cannot be guessed as spaces; complete native lines retain their layout through cursor/copy changes', () => {
  const base = {y: 43, width: 6, height: 8, advance: 4, font: 1, colours: [0, 15], visibleInk: 7, totalInk: 7};
  const a = {...base, x: 10, char: 65, serial: 1, sourceSerial: 100};
  const b = {...base, x: 19, char: 66, serial: 2, sourceSerial: 102};
  assert.deepEqual(glyphRuns([a, b]).map(r=>r.text), ['A','B'], 'a covered narrow letter is indistinguishable from a blank by advance alone');
  const line={runId:12,text:'Build it',x:265,y:113,width:47,height:8,fontHeight:8,font:1,visibleInk:100,totalInk:100,glyphs:[],clips:[[265,113,47,8]],ink:[]};
  const hiddenLetter={...line,visibleInk:80,clips:[[265,113,12,8],[281,113,31,8]]};
  const partialCopy={...line,placementId:'copy',x:20,y:50,visibleInk:30,clips:[[20,50,10,8]]};
  const [full]=observedTextRuns({textRuns:[line]}),[occluded]=observedTextRuns({textRuns:[hiddenLetter]});
  for(const key of ['text','x','y','width','fontHeight'])assert.equal(full[key],occluded[key],key+' is independent of visible ink');
  assert.deepEqual(occluded.clips,hiddenLetter.clips,'real cleared regions stay clipped');
  assert.equal(observedTextRuns({textRuns:[partialCopy]})[0].width,47,'partial copy never shrinks the fitted line');
  assert.deepEqual(observedTextRuns({textRuns:[{...line,visibleInk:0}]}),[],'fully overwritten label is not resurrected');
  const parts = nineSlices([0, 0, 312, 64], [0, 0, 240, 140], [32, 16, 32, 16], [12, 4, 12, 4]);
  assert.equal(parts.reduce((sum, p) => sum + p.target[2] * p.target[3], 0), 240 * 140);
  assert.equal(parts[0].target[3], 4, 'HUD frame rim remains inside the native one-pixel inset');
});
