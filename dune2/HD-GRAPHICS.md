# Original artwork upscaling — release 0.5

The active renderer enlarges the complete original 320×200 framebuffer to 1280×800 with Hyllian’s xBR level-2 pixel-art filter. The game keeps its original 4:3 display aspect. Graphics → Original · 1992 shows the unfiltered native output; changing the selector never restarts the game. The old generated-material remaster was rejected and is no longer loaded or shown.

## Source and presentation

The existing native observer supplies only the original indexed pixels and current 256-colour palette to the new presentation path. The upscaler ignores all terrain, sprite and UI reconstruction commands. It converts six-bit palette channels with the same `(value * 65) >> 4` rule as the native SDL backend, then uploads the resulting 320×200 image to the GPU. xBR detects nearby colour edges and blends along them at four times the resolution. It does not invent textures, repaint units, reconstruct buildings or use generated material atlases.

The same path handles terrain, units, cursor, text, fog, palette fades, menus, advisor screens and native WSA movies. Original animation choices, compositing and clipping have already happened in the native framebuffer. Simulation, input, saves, music and timing are unchanged. The pointer-transparent overlay stays aligned with the original canvas, which remains the only input target.

The filter uses WebGL2. If WebGL is unavailable or its context is lost, the renderer falls back to two indexed Scale2x passes. That fallback uses only original palette colours and is labeled in diagnostics; it is not claimed to be identical to xBR. The Original selector remains available. No generated images are downloaded. Historical 0.4 artwork and its evidence are separate from the active source package and runtime.

## Provenance and verification

The shader is adapted from the MIT-licensed [Hyllian xBR-lv2 implementation](https://github.com/libretro/glsl-shaders/blob/master/xbr/shaders/xbr-lv2.glsl). The exact retained upstream revision, original and adapted shader hashes, license and adaptation notes accompany `dist/upscale/`. The corresponding source download includes these files. xBRZ is a different implementation and is not used here.

Pixel regression checks cover exact original palette conversion, border/diagonal cases, all-colour and zero-colour frames, immutable source data and the CPU fallback. Package checks bind the shader, modules, source archive and graphics control. Browser acceptance compares the original and upscaled view of the same native scene and checks that the GPU shader compiles, orientation and faction colours agree, and menus and mode switching remain usable. The acceptance record is saved in `fidelity/upscale/`.

Upscaling adds no recovered detail. xBR can soften small text or merge adjacent pixels; the original mode is the reference for judging those tradeoffs. First-mission visual acceptance is a bounded sample, not exhaustive campaign coverage. Existing native gameplay, DOS comparison and sound fidelity limits still apply.
