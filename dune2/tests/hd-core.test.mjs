import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scale2xIndices, toRgba, prepareFrameDescriptor, mappedIndex,
  stampNativeTile, stampNativeSprite, composeNativeViewport,
} from '../dist/hd-core.mjs';

const encode = values => Buffer.from(values).toString('base64');
const screen = value => new Uint8Array(320 * 200).fill(value);
const at = (x, y) => y * 320 + x;
function descriptor(width, height, indices, {mask = indices.map(() => 1), palette = null, render = null} = {}) {
  return {
    x: 0, y: 0, w: width * 4, h: height * 4, sourceW: width, sourceH: height,
    paletteMode: palette ? 'local16' : 'global256', ...(palette ? {palette} : {}),
    indicesBase64: encode(indices), maskBase64: encode(mask),
    ...(render ? {renderIndicesBase64: encode(render)} : {}),
  };
}
const palette16 = () => Array.from({length: 16}, (_, i) => i);
const incrementMap = amount => Uint8Array.from({length: 256}, (_, i) => (i + amount) & 255);

test('Scale2x preserves indexed colors, constant borders and diagonal topology without changing its input', () => {
  const input = Uint8Array.from([0, 1, 0, 1, 0, 0, 0, 0, 0]), saved = input.slice();
  const out = new Uint8Array(36);
  assert.equal(scale2xIndices(input, 3, 3, out), out);
  assert.deepEqual(input, saved);
  assert.deepEqual([out[14], out[15], out[20], out[21]], [1, 0, 0, 0]);
  assert.deepEqual([...new Set(out)].sort(), [0, 1]);
  assert.deepEqual(scale2xIndices(Uint8Array.of(17), 1, 1), Uint8Array.of(17, 17, 17, 17));
  assert.deepEqual(scale2xIndices(Uint8Array.of(12, 12, 12, 12), 2, 2), new Uint8Array(16).fill(12));
  assert.throws(() => scale2xIndices(input, 2, 2));
  assert.throws(() => scale2xIndices(input, 3, 3, new Uint8Array(35)));
  const shared = new Uint8Array(36);
  assert.throws(() => scale2xIndices(shared.subarray(0, 9), 3, 3, shared));
});

test('native six-bit palette conversion uses exact integer channel values and opaque RGBA', () => {
  const indices = Uint8Array.of(0, 255), saved = indices.slice(), palette = new Uint8Array(768);
  palette.set([0, 1, 16], 0); palette.set([63, 31, 47], 765);
  const out = new Uint8ClampedArray(8);
  assert.equal(toRgba(indices, palette, out), out);
  assert.deepEqual([...out], [0, 4, 65, 255, 255, 125, 190, 255]);
  assert.deepEqual(indices, saved);
  assert.throws(() => toRgba(indices, new Uint8Array(767)));
});

test('asset preparation decodes and validates original and HD index planes without mutating the manifest', () => {
  const frame = descriptor(2, 1, [1, 2], {palette: palette16(), render: new Uint8Array(32).fill(2)});
  const before = structuredClone(frame), prepared = prepareFrameDescriptor(frame);
  assert.notEqual(prepared, frame);
  assert.equal(prepareFrameDescriptor(frame), prepared);
  assert.equal(prepareFrameDescriptor(prepared), prepared);
  assert.deepEqual([...prepared.indices], [1, 2]);
  assert.equal(prepared.renderIndices.length, 32);
  assert.deepEqual(frame, before);
  assert.throws(() => prepareFrameDescriptor({...frame, maskBase64: encode([1])}));
  assert.throws(() => prepareFrameDescriptor({...frame, indicesBase64: encode([16, 1])}));
  assert.throws(() => prepareFrameDescriptor({...frame, palette: []}));
});

test('ICON stamping preserves alpha and original-mode house recoloring through palette index 159', () => {
  const palette = palette16(); palette[0] = 0; palette[1] = 144; palette[2] = 159; palette[3] = 160;
  const frame = descriptor(4, 1, [0, 1, 2, 3], {palette, mask: [0, 1, 1, 1]});
  const out = screen(55), original = structuredClone(frame);
  stampNativeTile(out, frame, 10, 40, 5);
  assert.deepEqual([...out.slice(at(10, 40), at(14, 40))], [55, 224, 239, 160]);
  assert.equal(mappedIndex(frame, 2, null, 5, true), 239);
  assert.deepEqual(frame, original);
  const opaquePalette = palette16(); opaquePalette[0] = 12;
  stampNativeTile(out, descriptor(1, 1, [0], {palette: opaquePalette}), 0, 40);
  assert.equal(out[at(0, 40)], 12, 'opaque ICON zero code may map to color12');
  stampNativeTile(out, descriptor(2, 1, [9, 10]), -1, 0);
  assert.equal(out[0], 10, 'screen clipping advances the tile source coordinate');
  assert.throws(() => stampNativeTile(out, frame, 0, 0, 6));
});

test('SHP prediction preserves native mirrors, widget clipping and palette overrides', () => {
  const frame = descriptor(2, 2, [1, 2, 3, 4]);
  const command = {x: 10, y: 50, width: 2, height: 2, flags: 3, clip: [0, 40, 240, 160]};
  const saved = structuredClone(command), out = screen(77);
  assert.equal(stampNativeSprite(out, frame, command), true);
  assert.deepEqual([out[at(10, 50)], out[at(11, 50)], out[at(10, 51)], out[at(11, 51)]], [4, 3, 2, 1]);
  assert.deepEqual(command, saved);
  const clipped = screen(77);
  stampNativeSprite(clipped, frame, {...command, x: -1, y: 39, flags: 0});
  assert.equal(clipped[at(0, 40)], 4);
  assert.equal(clipped[at(1, 40)], 77);
  assert.equal(clipped[at(0, 39)], 77);
  const sourcePalette = palette16(); sourcePalette[1] = 145;
  const override = palette16(); override[1] = 161;
  const colored = descriptor(1, 1, [1], {palette: sourcePalette});
  stampNativeSprite(out, colored, {x: 0, y: 40, flags: 0x400, palette: override});
  assert.equal(out[at(0, 40)], 161);
  stampNativeSprite(out, colored, {x: 1, y: 40, flags: 0x400});
  assert.equal(out[at(1, 40)], 145, 'embedded palette is used when no override exists');
});

test('SHP remaps source pixels for normal remap but destination pixels for aircraft shadows', () => {
  const frame = descriptor(2, 1, [7, 9]), remap = incrementMap(1);
  for (const flags of [0x100, 0x500]) {
    const out = screen(4);
    stampNativeSprite(out, frame, {x: 0, y: 40, flags, remap, remapCount: 2});
    assert.deepEqual([...out.slice(at(0, 40), at(2, 40))], [9, 11]);
  }
  for (const flags of [0x300, 0x700]) {
    const out = screen(4);
    stampNativeSprite(out, frame, {x: 0, y: 40, flags, remap, remapCount: 2});
    assert.deepEqual([...out.slice(at(0, 40), at(2, 40))], [6, 6]);
  }
  const out = screen(4), before = out.slice();
  assert.equal(stampNativeSprite(out, frame, {x: 0, y: 40, flags: 0x200}), false);
  assert.equal(stampNativeSprite(out, frame, {x: 0, y: 40, flags: 0x600}), false);
  assert.equal(stampNativeSprite(out, frame, {x: 0, y: 40, flags: 0x100, remapCount: 1}), false);
  assert.deepEqual(out, before, 'unpredicted blur or invalid remap leaves the prediction unchanged');
});

test('nearest indexed zoom uses the native command dimensions while respecting source alpha', () => {
  const frame = descriptor(2, 1, [1, 2], {mask: [1, 0]}), out = screen(9);
  stampNativeSprite(out, frame, {x: 0, y: 40, width: 4, height: 2, flags: 4});
  assert.deepEqual([...out.slice(at(0, 40), at(4, 40))], [1, 1, 9, 9]);
  assert.deepEqual([...out.slice(at(0, 41), at(4, 41))], [1, 1, 9, 9]);
});

test('viewport prediction follows native order, fog and transparency while preserving all source state', () => {
  const ground = descriptor(16, 16, new Uint8Array(256).fill(10));
  const mask = new Uint8Array(256); mask[5] = 1;
  const overlay = descriptor(16, 16, new Uint8Array(256).fill(20), {mask});
  const unit = descriptor(2, 2, [30, 31, 32, 33]);
  const shadow = descriptor(1, 1, [1]);
  const tiles = new Uint16Array(600);
  for (let i = 0; i < 150; i++) tiles.set([1, 0, 0, 1], i * 4);
  tiles[1] = 2; tiles[5] = 99;
  const frame = {
    pixels: screen(77), tiles, worldVisible: true, veiledTileId: 99,
    commands: [
      {id: 111, x: 0, y: 40, flags: 1},
      {id: 112, x: 1, y: 40, flags: 0x300, remap: incrementMap(10), remapCount: 1},
      {id: 112, x: 0, y: 40, flags: 0x200},
      {id: 999, x: 0, y: 40, flags: 0},
    ],
  };
  const saved = structuredClone(frame);
  const result = composeNativeViewport(frame, {tiles: {1: ground, 2: overlay}, units: {111: unit, 112: shadow}, ui: {}});
  assert.equal(result.pixels[at(0, 40)], 31);
  assert.equal(result.pixels[at(1, 40)], 40, 'shadow remaps the preceding unit pixel');
  assert.equal(result.pixels[at(5, 40)], 20);
  assert.equal(result.pixels[at(6, 40)], 10);
  assert.equal(result.pixels[at(16, 40)], 12, 'fully veiled tile is native black');
  for (const [x, y] of [[0, 0], [0, 39], [240, 40], [319, 199]]) assert.equal(result.pixels[at(x, y)], 77);
  assert.equal(result.nativePredictedCommands, 2);
  assert.equal(result.unsupportedCommands, 1);
  assert.equal(result.missingFrames, 1);
  assert.deepEqual(frame, saved);
  const hidden = composeNativeViewport({...frame, worldVisible: false}, {});
  assert.deepEqual(hidden.pixels, frame.pixels);
  assert.notEqual(hidden.pixels, frame.pixels);
});
