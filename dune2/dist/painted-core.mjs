// Painted presentation colour/state helpers. GPL-2.0-only.
// Whole RGBA drawings keep their own shading; native pixel colours are not
// reapplied to the artwork. Only semantic faction paint and hit highlights vary.

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const paintedMode = value => value === 'original' ? 'original' : 'painted';

/** Native viewport rendering forces black on undiscovered cells even when the
 * underlying map still contains a valid ground ID and no overlay. Keep the
 * historical indexed predictor's input explicit without mutating the snapshot.
 */
export function visibleNativeFrame(frame) {
  if (frame.debugScenario) return frame;
  const veiled = frame.veiledTileId ?? frame.veiledTileID ?? 123;
  let tiles = null;
  for (let p = 0; p < frame.tiles.length; p += 4) {
    if (!frame.tiles[p + 3] && frame.tiles[p + 1] !== veiled) {
      tiles ??= frame.tiles.slice(); tiles[p + 1] = veiled;
    }
  }
  return tiles ? {...frame, tiles, veiledTileId:veiled} : frame;
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb.map(v => Math.round((v + m) * 255));
}

/** Use the actual sprite palette, including native temporary deviation colours.
 * The observer's owner house can differ from a temporarily deviated body's PAL.
 */
export function effectiveHouse(source, command, fallback = 1) {
  if (source?.paletteMode === 'local16' && source.palette && command?.palette) {
    const votes = new Uint8Array(6);
    for (let i = 0; i < 16; i++) {
      const original = source.palette[i], target = command.palette[i];
      if (original < 144 || original > 152) continue;
      const delta = target - original;
      if (delta >= 0 && delta % 16 === 0 && delta / 16 < 6) votes[delta / 16]++;
    }
    const best = Math.max(...votes);
    if (best) return votes.indexOf(best);
  }
  const house = command?.house ?? fallback;
  return Number.isInteger(house) && house >= 0 && house < 6 ? house : 1;
}

/** Average the real faction ramp, without treating neutral steel as faction paint. */
export function factionColour(palette6, house) {
  if (palette6?.length !== 768 || !Number.isInteger(house) || house < 0 || house > 5) throw new RangeError('Invalid faction palette');
  const rgb = [0, 0, 0];
  for (let i = 1; i <= 7; i++) for (let c = 0; c < 3; c++) rgb[c] += (palette6[(144 + house * 16 + i) * 3 + c] * 65) >> 4;
  return rgb.map(v => v / 7);
}

/** Recolour only authored saturated cobalt paint. Fine lines, neutral metal,
 * footprints, antialiasing and all non-faction materials remain the new art.
 * Native highlight is a transient white blend (GUI_Palette_CreateMapping,
 * reference15/intensity0x55), not a remapping of the original source pixels.
 */
export function recolourPainted(rgba, palette6, house = 1, {highlight = 0, uniform = null} = {}) {
  if (!rgba || rgba.length % 4) throw new RangeError('Invalid RGBA image');
  const output = new Uint8ClampedArray(rgba);
  const target = rgbToHsl(...factionColour(palette6, house));
  const reference = rgbToHsl(...factionColour(palette6, 1));
  const white = [0, 1, 2].map(c => (palette6[15 * 3 + c] * 65) >> 4);
  const amount = clamp(highlight);
  for (let p = 0; p < output.length; p += 4) {
    if (!output[p + 3]) continue;
    if (uniform) {
      for (let c = 0; c < 3; c++) output[p + c] = uniform[c];
      continue;
    }
    const [r, g, b] = [output[p], output[p + 1], output[p + 2]];
    if (house !== 1 && b - Math.max(r, g) > 20) {
      const [h, s, l] = rgbToHsl(r, g, b), diff = Math.min(Math.abs(h - 225), 360 - Math.abs(h - 225));
      const weight = clamp((s - .23) / .27) * clamp((55 - diff) / 25);
      if (weight) {
        const sat = s * target[1] / Math.max(.05, reference[1]), rgb = hslToRgb(target[0], sat, l);
        for (let c = 0; c < 3; c++) output[p + c] += (rgb[c] - output[p + c]) * weight;
      }
    }
    if (amount) for (let c = 0; c < 3; c++) output[p + c] += (white[c] - output[p + c]) * amount;
  }
  return output;
}

export function highlightAmount(command) {
  if ((command?.flags & 0x300) !== 0x100 || !(command.remapCount > 0)) return 0;
  return 1 - (1 - 42 / 128) ** Math.min(256, command.remapCount);
}

export function rgbaBytesBounded(entries, maximumCount, maximumBytes) {
  let bytes = 0;
  for (const value of entries.values()) bytes += value.width * value.height * 4;
  while (entries.size > maximumCount || bytes > maximumBytes) {
    const key = entries.keys().next().value, value = entries.get(key);
    bytes -= value.width * value.height * 4; entries.delete(key);
  }
  return bytes;
}
