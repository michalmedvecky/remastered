# Dune II HD materials and original geometry

`materials-source.png` is the retained built-in imagegen output. `generation.json`
records its hash, purpose and 4×4 row-major material names. The source contains
sand, dune, basalt, spice, dense spice, concrete and industrial surface swatches.
The parent task retains its prompt and separate generated cover artifacts.

Run from `dune2/`:

```sh
python3 tools/build-hd-assets.py
node --test tests/hd-assets.test.mjs
```

The builder uses only Python's standard library, with no Pillow, NumPy, SDK,
original ZIP, external analysis directory or original DOS execution. It reads
hash-verified original PAK slices already present in the shipped preload.
Generated images are content-addressed lossless PNG files in `dist/hd/`.
The same Python/zlib toolchain produces deterministic bytes; manifests also bind
full decoded RGBA hashes to distinguish image content from compression details.

Coverage is all 389 original ICON tiles, all 244 unit/effect SHP frames and the
remaining 281 native SHP slots—525 native shape IDs in total. The 19 historical
building preview images are not the native building source: native buildings,
wall states, damage, rubble and animation use ICON groups and are covered by the
389-tile bank. All 16 previously decoded full screens have bounded 4× contour
versions. No eagerly expanded WSA sheets are generated: such a full movie bank
would require roughly 2.1 GiB decoded memory. Native movie frames use the browser
renderer’s bounded presentation path instead.

`manifest.json` retains each frame's exact source rectangle, original source
palette codes and alpha mask, plus the resolved 4× index plane. Palette codes
are local 0–15 when a 16-entry local palette exists, otherwise global 0–255.
Generated material luminance and fine relief are applied inside the decoded
frame. Scale2x twice resolves display contours within the unchanged rectangle;
its alpha can differ from a blocky 4× alpha enlargement, but no artwork extends
outside the original footprint. Native collision, coordinates, object state,
orientation, animation choice and input hit regions are unchanged.

The source alpha mask is independent of global colour zero. SHP transparency
comes from the RLE skip stream. ICON transparency follows the native rule:
only when local palette entry 0 is zero are mapped global-zero pixels skipped.
Original-mode ICON house recolouring covers 144–159; unit sprite recolouring
covers 144–152. Runtime recolouring must use the actual native palette map and
one shared luminance gain, so red source pixels correctly become blue/green
House colours even where individual source RGB channels were zero.

The three Node tests independently decode the native PAK/SHP/ICON data, verify
all source codes, masks, dimensions, original resource hashes and every generated
4× contour index/alpha pixel. They also verify image/decoded-RGBA hashes, the
4096-pixel atlas bound, static-screen/material hashes and that substantial opaque
terrain/unit pixels contain generated subpixel material detail beyond contour
scaling. `build-audit.json` records measured coverage and per-frame alpha/index
bindings. This is an artwork/geometry audit, not a claim that HD and DOS pixels
are identical or that unseen cinematic frames were newly painted.
