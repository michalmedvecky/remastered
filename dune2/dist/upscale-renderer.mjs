// Faithful original-framebuffer presentation. GPL-2.0-only.
// xBR shader math retains Hyllian's MIT license in upscale/LICENSE.txt.
import {SOURCE_WIDTH, SOURCE_HEIGHT, UPSCALE_FACTOR, nativeRgba, createScale4x} from './upscale-core.mjs';

const WIDTH = SOURCE_WIDTH * UPSCALE_FACTOR, HEIGHT = SOURCE_HEIGHT * UPSCALE_FACTOR;
const shaderUrl = file => new URL('./upscale/' + file, import.meta.url);

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
    throw new Error('Upscaling shader compilation failed: ' + message);
  }
  return shader;
}

function createGPU(document, vertex, fragment) {
  // Keep the visible canvas as2D, so fallback never needs to replace its DOM node.
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const gl = canvas.getContext('webgl2', {alpha:false, antialias:false, depth:false, stencil:false, premultipliedAlpha:false, preserveDrawingBuffer:true});
  if (!gl) throw new Error('WebGL2 is unavailable');
  const program = gl.createProgram(), shaders = [compile(gl, gl.VERTEX_SHADER, vertex), compile(gl, gl.FRAGMENT_SHADER, fragment)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Upscaling shader linking failed: ' + gl.getProgramInfoLog(program));
  for (const shader of shaders) { gl.detachShader(program, shader); gl.deleteShader(shader); }
  gl.useProgram(program);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SOURCE_WIDTH, SOURCE_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.uniform1i(gl.getUniformLocation(program, 'decal'), 0);
  gl.uniform2f(gl.getUniformLocation(program, 'TextureSize'), SOURCE_WIDTH, SOURCE_HEIGHT);
  gl.viewport(0, 0, WIDTH, HEIGHT); gl.disable(gl.BLEND); gl.disable(gl.DITHER);
  return {canvas, gl, draw(rgba) {
    if (gl.isContextLost()) throw new Error('WebGL2 context is lost');
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }};
}

export async function createUpscaleRenderer(canvas, {mode = 'upscale', onError = () => {}} = {}) {
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext('2d', {alpha:false});
  if (!context) throw new Error('The upscaling canvas is unavailable');
  context.imageSmoothingEnabled = false;
  const native = new Uint8ClampedArray(SOURCE_WIDTH * SOURCE_HEIGHT * 4);
  const fallbackImage = context.createImageData(WIDTH, HEIGHT), scale4x = createScale4x();
  let gpu = null, fallbackReason = null, currentMode = mode === 'original' ? 'original' : 'upscale';
  let frames = 0, errors = 0, contextLosses = 0, lastPaint = -Infinity, paintMs = 0, maxPaintMs = 0;
  try {
    const [vertex, fragment] = await Promise.all(['xbr.vertex.glsl', 'xbr-lv2.fragment.glsl'].map(async file => {
      const response = await fetch(shaderUrl(file));
      if (!response.ok) throw new Error('Upscaling shader is unavailable: ' + file);
      return response.text();
    }));
    gpu = createGPU(canvas.ownerDocument, vertex, fragment);
    gpu.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); contextLosses++; fallbackReason = 'WebGL2 context lost; using Scale2x'; gpu = null;
    });
  } catch (error) { fallbackReason = error.message; onError(error); }

  function setMode(value) { currentMode = value === 'original' ? 'original' : 'upscale'; canvas.hidden = true; lastPaint = -Infinity; }
  function diagnostics() { return {mode:currentMode, ready:true, algorithm:gpu ? 'xBR-lv2' : 'Scale2x', backend:gpu ? 'webgl2' : 'canvas2d', source:'native indexed framebuffer', generatedArt:false, width:WIDTH, height:HEIGHT, sourceWidth:SOURCE_WIDTH, sourceHeight:SOURCE_HEIGHT, scale:UPSCALE_FACTOR, frames, errors, contextLosses, fallbackReason, paintMs:Math.round(paintMs * 10) / 10, maxPaintMs:Math.round(maxPaintMs * 10) / 10}; }
  function present(frame) {
    if (currentMode !== 'upscale') { canvas.hidden = true; return; }
    const now = performance.now(); if (now - lastPaint < 32) return; lastPaint = now;
    try {
      if (frame?.pixels?.length !== SOURCE_WIDTH * SOURCE_HEIGHT || frame?.palette?.length !== 768) throw new RangeError('Invalid native framebuffer');
      if (gpu) {
        nativeRgba(frame.pixels, frame.palette, native);
        try { gpu.draw(native); context.drawImage(gpu.canvas, 0, 0); }
        catch (error) { fallbackReason = error.message; gpu = null; scale4x(frame.pixels, frame.palette, fallbackImage.data); context.putImageData(fallbackImage, 0, 0); }
      } else { scale4x(frame.pixels, frame.palette, fallbackImage.data); context.putImageData(fallbackImage, 0, 0); }
      canvas.hidden = false; frames++; paintMs = performance.now() - now; maxPaintMs = Math.max(maxPaintMs, paintMs);
      if (frames % 20 === 0) canvas.dataset.upscaleState = JSON.stringify(diagnostics());
    } catch (error) { errors++; canvas.hidden = true; if (errors === 1) onError(error); }
  }
  setMode(currentMode);
  return {present, setMode, diagnostics};
}
