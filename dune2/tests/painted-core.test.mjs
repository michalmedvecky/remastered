import test from 'node:test';
import assert from 'node:assert/strict';
import {paintedMode, visibleNativeFrame, effectiveHouse, recolourPainted, highlightAmount, rgbaBytesBounded} from '../dist/painted-core.mjs';

function palette() {
  const p = new Uint8Array(768);
  const colours = [[63, 7, 3], [3, 12, 63], [4, 55, 12], [37, 24, 8], [38, 38, 38], [56, 15, 48]];
  for (let h = 0; h < 6; h++) for (let i = 0; i < 16; i++) p.set(colours[h], (144 + h * 16 + i) * 3);
  p.set([63, 63, 63], 45); return p;
}

test('approved blue artwork stays byte-identical, neutral metal and alpha survive faction changes', () => {
  const art = Uint8ClampedArray.of(15, 55, 210, 255, 145, 156, 170, 173, 3, 7, 9, 0), copy = art.slice();
  assert.deepEqual(recolourPainted(art, palette(), 1), art);
  const red = recolourPainted(art, palette(), 0), green = recolourPainted(art, palette(), 2), grey = recolourPainted(art, palette(), 4);
  assert(red[0] > red[2]); assert(green[1] > green[2]); assert.equal(grey[0], grey[1]); assert.equal(grey[1], grey[2]);
  assert.deepEqual(red.slice(4), art.slice(4)); assert.deepEqual(green.slice(4), art.slice(4)); assert.deepEqual(art, copy);
});

test('native PAL overrides owner house for a temporarily deviated body without changing turret ownership', () => {
  const original = Array.from({length:16}, (_,i) => i < 9 ? 144 + i : i);
  const local = {paletteMode:'local16', palette:original};
  assert.equal(effectiveHouse(local, {house:0, palette:original.map(v => v >= 144 ? v + 32 : v)}), 2);
  assert.equal(effectiveHouse(local, {house:0, palette:original}), 0);
  assert.equal(effectiveHouse(local, {house:3}), 3);
  assert.equal(effectiveHouse({}, {house:-1}, 1), 1);
});

test('native white hit highlighting preserves original new-art alpha and authored shading', () => {
  const art = Uint8Array.of(20, 40, 80, 127), before = art.slice(), amount = highlightAmount({flags:0x100,remapCount:1});
  assert.equal(amount, 42 / 128);
  const lit = recolourPainted(art, palette(), 1, {highlight:amount});
  assert(lit[0] > art[0] && lit[1] > art[1] && lit[2] > art[2]); assert.equal(lit[3], 127); assert.deepEqual(art, before);
  assert.equal(highlightAmount({flags:0x300,remapCount:1}), 0);
});

test('renderer mode migration and variant cache have bounded backing memory', () => {
  for (const mode of ['hd','upscale','painted',null]) assert.equal(paintedMode(mode), 'painted');
  assert.equal(paintedMode('original'), 'original');
  const cache = new Map([['a',{width:64,height:64}],['b',{width:128,height:128}],['c',{width:64,height:64}]]);
  assert.equal(rgbaBytesBounded(cache, 2, 80*1024), 80*1024); assert.deepEqual([...cache.keys()], ['b','c']);
  assert.equal(rgbaBytesBounded(cache, 2, 20*1024), 16*1024); assert.deepEqual([...cache.keys()], ['c']);
});

test('undiscovered building and ground cells are blacked for prediction without changing native snapshots', () => {
  const frame={tiles:Uint16Array.of(292,0,1,0,143,0,0,1,127,15,0,0),veiledTileId:15},saved=frame.tiles.slice();
  const visible=visibleNativeFrame(frame);
  assert.deepEqual([...visible.tiles],[292,15,1,0,143,0,0,1,127,15,0,0]);
  assert.deepEqual(frame.tiles,saved);assert.notEqual(visible,frame);
  const debug={...frame,debugScenario:true};assert.equal(visibleNativeFrame(debug),debug);
});
