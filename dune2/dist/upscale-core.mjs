// Original-framebuffer scaling helpers. GPL-2.0-only.
export const SOURCE_WIDTH = 320;
export const SOURCE_HEIGHT = 200;
export const UPSCALE_FACTOR = 4;

/** Match the native SDL backend's six-bit DAC conversion exactly. */
export function nativeRgba(indices, palette, output = new Uint8ClampedArray(indices.length * 4)) {
  if (!palette || palette.length !== 768 || output.length !== indices.length * 4) throw new RangeError('Invalid native palette or output size');
  if (indices.buffer && indices.buffer === output.buffer) throw new RangeError('Input and output must not alias');
  for (let i = 0; i < indices.length; i++) {
    const p = indices[i] * 3, q = i * 4;
    output[q] = (palette[p] * 65) >> 4;
    output[q + 1] = (palette[p + 1] * 65) >> 4;
    output[q + 2] = (palette[p + 2] * 65) >> 4;
    output[q + 3] = 255;
  }
  return output;
}

/** Scale2x/EPX with clamped border neighbours; it only copies source indices. */
export function scale2x(input, width, height, output = new Uint8Array(width * height * 4)) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || input.length !== width * height || output.length !== input.length * 4) throw new RangeError('Invalid indexed image size');
  if (input.buffer && input.buffer === output.buffer) throw new RangeError('Input and output must not alias');
  const stride = width * 2;
  for (let y = 0; y < height; y++) {
    const row = y * width, previous = Math.max(0, y - 1) * width, next = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const e = input[row + x], b = input[previous + x], h = input[next + x];
      const d = input[row + Math.max(0, x - 1)], f = input[row + Math.min(width - 1, x + 1)];
      const p = y * 2 * stride + x * 2;
      output[p] = b !== h && d !== f && d === b ? d : e;
      output[p + 1] = b !== h && d !== f && b === f ? f : e;
      output[p + stride] = b !== h && d !== f && d === h ? d : e;
      output[p + stride + 1] = b !== h && d !== f && h === f ? f : e;
    }
  }
  return output;
}

/** Bounded reusable fallback buffers; no scene, sprite or generated-art inputs. */
export function createScale4x(width = SOURCE_WIDTH, height = SOURCE_HEIGHT) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new RangeError('Invalid scaler dimensions');
  const twice = new Uint8Array(width * height * 4), four = new Uint8Array(width * height * 16);
  return (indices, palette, rgba) => {
    scale2x(indices, width, height, twice);
    scale2x(twice, width * 2, height * 2, four);
    return nativeRgba(four, palette, rgba);
  };
}
