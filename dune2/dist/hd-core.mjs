// Dune II browser presentation helpers. GPL-2.0-only, 2026-11-18.
// These routines read the native presentation snapshot; they never alter game state.

export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 200;
export const WORLD_RECT = Object.freeze([0, 40, 240, 160]);

const preparedFrames = new WeakMap();
const integer = value => Number.isSafeInteger(value);

function decodeBase64(value, expected, field) {
  if (typeof value !== 'string') throw new TypeError(`${field} must be base64 data`);
  let bytes;
  if (typeof atob === 'function') {
    const text = atob(value);
    bytes = Uint8Array.from(text, char => char.charCodeAt(0));
  } else if (typeof Buffer !== 'undefined') {
    bytes = Uint8Array.from(Buffer.from(value, 'base64'));
  } else {
    throw new Error('No base64 decoder is available');
  }
  if (bytes.length !== expected) throw new RangeError(`${field} has an invalid byte count`);
  return bytes;
}

/** Return a cached descriptor copy with decoded indices, mask and renderIndices.
 * The JSON descriptor is not mutated. The returned typed arrays are read-only by
 * convention so both the painter and prediction code can reuse them safely.
 */
export function prepareFrameDescriptor(frame) {
  if (!frame || typeof frame !== 'object') throw new TypeError('Expected an asset descriptor');
  if (preparedFrames.has(frame)) return preparedFrames.get(frame);
  const {sourceW, sourceH, w, h} = frame;
  if (![sourceW, sourceH, w, h].every(v => integer(v) && v > 0)) throw new RangeError('Invalid frame dimensions');
  if (!['local16', 'global256'].includes(frame.paletteMode)) throw new TypeError('Unknown frame palette mode');
  if (frame.paletteMode === 'local16' && (!frame.palette || frame.palette.length !== 16)) throw new RangeError('Local sprite palette must have 16 entries');
  const size = sourceW * sourceH;
  const result = {
    ...frame,
    indices: decodeBase64(frame.indicesBase64, size, 'indicesBase64'),
    mask: decodeBase64(frame.maskBase64, size, 'maskBase64'),
    renderIndices: frame.renderIndicesBase64 === undefined ? null : decodeBase64(frame.renderIndicesBase64, w * h, 'renderIndicesBase64'),
  };
  if (frame.paletteMode === 'local16' && (result.indices.some(v => v > 15) || result.renderIndices?.some(v => v > 15))) throw new RangeError('Local palette index exceeds 15');
  preparedFrames.set(frame, result);
  preparedFrames.set(result, result);
  return result;
}

/** Exact Scale2x/EPX indexed expansion; all output values remain source indices. */
export function scale2xIndices(input, width, height, out = new Uint8Array(width * height * 4)) {
  if (!integer(width) || !integer(height) || width < 1 || height < 1 || input.length !== width * height) throw new RangeError('Invalid indexed image dimensions');
  if (out.length !== input.length * 4) throw new RangeError('Invalid Scale2x output size');
  if (input.buffer && out.buffer === input.buffer) throw new RangeError('Scale2x output must not alias its input');
  const stride = width * 2;
  for (let y = 0; y < height; y++) {
    const previous = Math.max(0, y - 1) * width, current = y * width, next = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const e = input[current + x];
      const b = input[previous + x], d = input[current + Math.max(0, x - 1)];
      const f = input[current + Math.min(width - 1, x + 1)], h = input[next + x];
      const at = y * 2 * stride + x * 2;
      if (b !== h && d !== f) {
        out[at] = d === b ? d : e;
        out[at + 1] = b === f ? f : e;
        out[at + stride] = d === h ? d : e;
        out[at + stride + 1] = h === f ? f : e;
      } else {
        out[at] = out[at + 1] = out[at + stride] = out[at + stride + 1] = e;
      }
    }
  }
  return out;
}

/** Convert native six-bit DAC RGB using the same integer conversion as SDL. */
export function toRgba(indices, palette6, out = new Uint8ClampedArray(indices.length * 4)) {
  if (!palette6 || palette6.length !== 768 || out.length !== indices.length * 4) throw new RangeError('Invalid palette or RGBA output size');
  if (indices.buffer && out.buffer === indices.buffer) throw new RangeError('RGBA output must not alias its indexed input');
  for (let i = 0; i < indices.length; i++) {
    const paletteAt = indices[i] * 3, at = i * 4;
    out[at] = (palette6[paletteAt] * 65) >> 4;
    out[at + 1] = (palette6[paletteAt + 1] * 65) >> 4;
    out[at + 2] = (palette6[paletteAt + 2] * 65) >> 4;
    out[at + 3] = 255;
  }
  return out;
}

function paletteIndex(frame, code, command, house, tile) {
  let index = frame.paletteMode === 'local16' ? (command?.palette ?? frame.palette)[code] : code;
  if (tile && house !== 0 && index >= 0x90 && index <= 0x9f) index += house << 4;
  return index;
}

function remapIndex(index, command) {
  const count = Math.max(0, command?.remapCount | 0);
  for (let i = 0; i < count; i++) index = command.remap[index];
  return index;
}

/** Resolve source palette/house and source remapping. Destination shadows are
 * deliberately excluded: those need the existing framebuffer value instead.
 */
export function mappedIndex(frame, code, command = null, house = 0, tile = false) {
  let index = paletteIndex(frame, code, command, house, tile);
  if (command && (command.flags & 0x300) === 0x100 && (command.remapCount | 0) > 0) index = remapIndex(index, command);
  return index;
}

function checkOutput(out) {
  if (!out || out.length !== SCREEN_WIDTH * SCREEN_HEIGHT) throw new RangeError('Expected a 320x200 indexed output');
}

function rectangle(value) {
  if (!value || value.length !== 4 || !Array.from(value).every(Number.isFinite)) throw new RangeError('Invalid clip rectangle');
  return value;
}

function intersect(a, b) {
  const left = Math.max(a[0], b[0]), top = Math.max(a[1], b[1]);
  return [left, top, Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - left), Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - top)];
}

/** Stamp an original ICON, preserving the native mapped-zero transparency. */
export function stampNativeTile(out, descriptor, x, y, house = 0) {
  checkOutput(out);
  if (![x, y, house].every(integer) || house < 0 || house > 5) throw new RangeError('Invalid tile position or house');
  const frame = prepareFrameDescriptor(descriptor);
  for (let sy = Math.max(0, -y); sy < frame.sourceH && sy + y < SCREEN_HEIGHT; sy++) {
    for (let sx = Math.max(0, -x); sx < frame.sourceW && sx + x < SCREEN_WIDTH; sx++) {
      const source = sy * frame.sourceW + sx;
      if (frame.mask[source]) out[(y + sy) * SCREEN_WIDTH + x + sx] = paletteIndex(frame, frame.indices[source], null, house, true);
    }
  }
  return true;
}

/** Replay a native SHP command into an indexed prediction buffer.
 * Coordinates already include widget offset and centering. Normal and source
 * remap modes are exact for unzoomed native sprites. Zoom is nearest indexed
 * sampling; currently shipped world calls do not use it. Pure blur deliberately
 * returns false without writes because it depends on native prior pixels/state.
 */
export function stampNativeSprite(out, descriptor, command) {
  checkOutput(out);
  const mode = command.flags & 0x700;
  if (mode === 0x200 || mode === 0x600) return false;
  const count = Math.max(0, command.remapCount | 0);
  if ((mode & 0x100) && count && (!command.remap || command.remap.length !== 256 || count > 256)) return false;
  const frame = prepareFrameDescriptor(descriptor);
  const x = command.x, y = command.y, width = command.width ?? frame.sourceW, height = command.height ?? frame.sourceH;
  if (![x, y, width, height].every(integer) || width < 1 || height < 1) return false;
  if (frame.paletteMode === 'local16' && command.palette && command.palette.length !== 16) return false;
  const clip = intersect([0, 0, SCREEN_WIDTH, SCREEN_HEIGHT], rectangle(command.clip ?? [0, 0, SCREEN_WIDTH, SCREEN_HEIGHT]));
  const left = Math.max(x, Math.ceil(clip[0])), right = Math.min(x + width, Math.ceil(clip[0] + clip[2]));
  const top = Math.max(y, Math.ceil(clip[1])), bottom = Math.min(y + height, Math.ceil(clip[1] + clip[3]));
  const flipX = !!(command.flags & 1), flipY = !!(command.flags & 2), destinationRemap = mode === 0x300 || mode === 0x700;
  for (let dy = top; dy < bottom; dy++) {
    let sy = Math.floor((dy - y) * frame.sourceH / height);
    if (flipY) sy = frame.sourceH - 1 - sy;
    for (let dx = left; dx < right; dx++) {
      let sx = Math.floor((dx - x) * frame.sourceW / width);
      if (flipX) sx = frame.sourceW - 1 - sx;
      const source = sy * frame.sourceW + sx;
      if (!frame.mask[source]) continue;
      const at = dy * SCREEN_WIDTH + dx;
      out[at] = destinationRemap ? remapIndex(out[at], command) : mappedIndex(frame, frame.indices[source], command);
    }
  }
  return true;
}

/** Predict the original world from native tile/sprite identities. Outside-world
 * pixels stay identical to the actual framebuffer. Mismatch handling remains
 * the compositor's job; this routine does not invent missing effects or assets.
 */
export function composeNativeViewport(frame, manifestFrames) {
  if (!frame?.pixels || frame.pixels.length !== SCREEN_WIDTH * SCREEN_HEIGHT) throw new RangeError('Missing native framebuffer');
  const pixels = Uint8Array.from(frame.pixels);
  let nativePredictedCommands = 0, unsupportedCommands = 0, missingFrames = 0;
  const result = () => ({pixels, nativePredictedCommands, unsupportedCommands, missingFrames});
  if (frame.worldVisible === false) return result();
  if (!frame.tiles || frame.tiles.length !== 600) throw new RangeError('Expected 15x10 native tile records');
  const frames = manifestFrames.frames ?? manifestFrames;
  const veiled = frame.veiledTileId ?? frame.veiledTileID;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 15; col++) {
      const at = (row * 15 + col) * 4;
      const ground = frame.tiles[at], overlay = frame.tiles[at + 1], house = frame.tiles[at + 2];
      const x = col * 16, y = 40 + row * 16;
      if (!frame.debugScenario && overlay === veiled) {
        for (let line = y; line < y + 16; line++) pixels.fill(12, line * SCREEN_WIDTH + x, line * SCREEN_WIDTH + x + 16);
        continue;
      }
      const tile = frames.tiles?.[ground];
      if (tile) stampNativeTile(pixels, tile, x, y, house); else missingFrames++;
      if (overlay && !frame.debugScenario) {
        const over = frames.tiles?.[overlay];
        if (over) stampNativeTile(pixels, over, x, y, house); else missingFrames++;
      }
    }
  }
  for (const command of frame.commands ?? []) {
    const descriptor = frames.units?.[command.id] ?? frames.ui?.[command.id];
    if (!descriptor) { missingFrames++; continue; }
    const clip = intersect(rectangle(command.clip ?? [0, 0, SCREEN_WIDTH, SCREEN_HEIGHT]), WORLD_RECT);
    if (stampNativeSprite(pixels, descriptor, {...command, clip})) nativePredictedCommands++;
    else unsupportedCommands++;
  }
  return result();
}
