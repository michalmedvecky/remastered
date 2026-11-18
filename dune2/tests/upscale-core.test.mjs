import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeRgba, scale2x, createScale4x} from '../dist/upscale-core.mjs';

test('native upscaling converts every DAC value exactly without changing source bytes', () => {
  const palette = new Uint8Array(768), indices = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { indices[i] = i; palette[i * 3] = i % 64; palette[i * 3 + 1] = (i * 7) % 64; palette[i * 3 + 2] = (i * 13) % 64; }
  const savedPalette = palette.slice(), savedIndices = indices.slice(), output = nativeRgba(indices, palette);
  for (let i = 0; i < 256; i++) assert.deepEqual([...output.subarray(i * 4, i * 4 + 4)], [(palette[i * 3] * 65) >> 4, (palette[i * 3 + 1] * 65) >> 4, (palette[i * 3 + 2] * 65) >> 4, 255]);
  assert.deepEqual(indices, savedIndices); assert.deepEqual(palette, savedPalette);
});

test('fallback keeps top/bottom and left/right orientation and uses only original colours', () => {
  const indices = Uint8Array.of(1, 2, 3, 4), saved = indices.slice(), palette = new Uint8Array(768);
  palette.set([63, 0, 0], 3); palette.set([0, 63, 0], 6); palette.set([0, 0, 63], 9); palette.set([63, 63, 0], 12);
  const output = createScale4x(2, 2)(indices, palette), rgb = (x, y) => [...output.subarray((x + y * 8) * 4, (x + y * 8) * 4 + 4)];
  assert.deepEqual(rgb(0, 0), [255, 0, 0, 255]); assert.deepEqual(rgb(7, 0), [0, 255, 0, 255]);
  assert.deepEqual(rgb(0, 7), [0, 0, 255, 255]); assert.deepEqual(rgb(7, 7), [255, 255, 0, 255]);
  const originals = new Set(['255,0,0,255', '0,255,0,255', '0,0,255,255', '255,255,0,255']);
  for (let i = 0; i < output.length; i += 4) assert(originals.has([...output.subarray(i, i + 4)].join(',')));
  assert.deepEqual(indices, saved);
});

test('Scale2x resolves a staircase corner while retaining isolated detail and clamped borders', () => {
  const diagonal = Uint8Array.of(0, 1, 1, 1, 0, 0, 1, 0, 0), output = scale2x(diagonal, 3, 3);
  // The middle source pixel's upper-left neighbour is a continuous white corner.
  assert.equal(output[2 + 2 * 6], 1); assert.equal(output[3 + 3 * 6], 0);
  const isolated = Uint8Array.of(0, 0, 0, 0, 7, 0, 0, 0, 0), enlarged = scale2x(isolated, 3, 3);
  assert.equal(enlarged.filter(value => value === 7).length, 4);
  assert.deepEqual([...scale2x(Uint8Array.of(9), 1, 1)], [9, 9, 9, 9]);
});

test('reusable fallback buffers follow palette fades between frames without retaining old colours', () => {
  const scale = createScale4x(1, 1), pixel = Uint8Array.of(42), palette = new Uint8Array(768), output = new Uint8ClampedArray(64);
  palette.set([63, 31, 15], 126); assert.equal(scale(pixel, palette, output), output); assert.deepEqual([...output.subarray(0, 4)], [255, 125, 60, 255]);
  palette.fill(0); scale(pixel, palette, output);
  for (let i = 0; i < output.length; i += 4) assert.deepEqual([...output.subarray(i, i + 4)], [0, 0, 0, 255]);
});

test('fallback rejects malformed dimensions and aliased buffers before modifying originals', () => {
  assert.throws(() => scale2x(new Uint8Array(3), 2, 2), RangeError);
  assert.throws(() => createScale4x(0, 2), RangeError);
  const shared = new Uint8Array(16); assert.throws(() => scale2x(shared.subarray(0, 4), 2, 2, shared), RangeError);
  assert.throws(() => nativeRgba(shared.subarray(0, 4), new Uint8Array(768), shared), RangeError);
  assert.throws(() => nativeRgba(Uint8Array.of(0), new Uint8Array(767)), RangeError);
});
