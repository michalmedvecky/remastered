# Native UI picture, glyph and advisor bank

All281 original UI SHP slots are accounted for with explicit source-bound
statuses:102 painted frames,7 derivatives of coherent new whole portraits,
20 aliases that follow the original duplicated MENSHPM bank,105 analytic
geometric/control frames,10 genuine empty frames and37 semantic text frames.
This is full UI-bank coverage, not a claim that all281 slots are paintings or
that every original cinematic has been redrawn.

`inventory.json` preserves original frame hashes, indexed pixels, transparency,
local palettes, extents and centres. The independent `dist/painted/native.json`
bank is checked against every consumed original plane by the tests. All original
files remain read-only. No DOS execution or game-rule/native-C change is involved.

## Pictures and controls

All49 actual SHAPES picture slots are new illustrations: radar/launch pictures
28–30, building/unit pictures65–105 and terrain thumbnails106–110. Eleven full
credit/encyclopedia illustrations514–524 have separate new paintings. Exact
native reference sheets, prompts and unmodified built-in ImageGen outputs live
in `references/` and `raw/`. The accepted world unit art is not regenerated.

The final review corrected two semantic mistakes in initial model outputs:
Infantry93 now shows exactly three distinct people; Raider99 now shows a
three-wheel buggy with a wide rear axle. The earlier pictures and exact edit
targets are retained. No source pixels, colours or masks are reapplied as a
stencil over the new pictures. Explicit reviewed panel rectangles exclude
outside sheet matte; premultiplied area minification preserves the new RGBA.

Simple cursors, selected/unselected arrows, plus/minus controls, badges,
placement markers and solid minimap ownership colours use supersampled
semantic geometry. Native31–58 are tiny colour fields, not house crests.
Campaign pieces477–504 are map-data silhouettes: their outer contours are
traced, interior stippling removed, paths simplified within0.45 native pixels
and lightly rounded before antialiased rasterization. This preserves the native
logical map positions without treating low-resolution dithering as HD detail.

`semanticFrames` preserves the exact button labels and rolling credit digits
12–23. The host renders scalable lettering within the original sprite boxes and
clipping; it must retain the original draw positions and rolling animation.
Generated lettering is not used. `fonts.json` separately decodes all five
supplied Westwood FNT resources, with original glyph widths, advances, vertical
rows, nibble planes and source hashes. Font_Init actively loads INTRO/NEW6P/NEW8P;
NEW10P/STD3P are supplied but not selected there. Default glyph advance is
width−1, because g_fontCharOffset initially equals−1; it can change at runtime.

## Coherent advisors

The interface bank owns four newly painted whole MENTAT scenes. Matched
ImageGen sheets supply distinct eye gaze/blink and mouth/speech poses, plus
two Atreides book poses. Each facial change is composited only around its new
painted features, feathering into exact new whole-base edge pixels. Original
native masks and palette mosaics are never imposed on the new face. This keeps
the original eyes/mouth layers independently animated without rectangular
skin seams. Static shoulder pieces use exact new whole-base crops; the four
Ordos green-ring phases add bounded glints to the new painted hand.

The original code loads MENSHPM three times for placeholder Fremen/Sardaukar
and Mercenary families. Those20 eye/mouth aliases are explicit, source hashes
must match and packed outputs follow the same originals. Genuine empty and
one-pixel sentinel slots remain identified. MENSHPM reference colours use
BENE.PAL, as GUI_Mentat_Display does, rather than the incorrect IBM appearance.
The Harkonnen generation used an earlier nearest proof of the same new whole
painting; `references/advisor-h-wholebase.png` retains those exact historical
input bytes. Production patch edges consume the final frozen whole-base bytes.

## Build and checks

Production packing needs no model call or external analysis directory:

```sh
node tools/build-painted-icons.mjs
node tools/build-painted-icons-review.mjs
node --test tests/painted-icons.test.mjs
```

The retained whole-base inputs are portable project files under
`art/hd-v3/interface/review/advisor-{h,a,o,m}-base.png`; the local codec is
`tools/painted-png.mjs`. The atlas pages are content-addressed and limited to
2048×2048. `icons.json` keeps every native ID/extent/pivot, source planes/hash,
actual raw/base hash and crop/feature evidence. `packing.json` and
`reproducibility.json` record the final manifest and deterministic rebuild.

Five scoped tests check full281-slot coverage, independent original source
binding, every atlas pixel/raw hash,60 unique complete picture scenes, exact
semantic labels/digits, distinct facial poses, original MENSHPM aliases and
byte-identical whole-base patch edges. `review-portraits.png` shows all49 HUD
pictures at their actual128×96 logical4× size. `review-advisors.png` shows
five combined gaze/speech/blink states for all four coherent whole scenes.

Reference preparation is separate from production packing:
`build-painted-icons-fonts.py` verifies the preload and exports fonts/palettes;
`build-painted-icons-prepare.mjs` exports original UI references. The references,
credits and advisor preparation tools generate historical model inputs; do not
regenerate a historical prompt/reference file casually after the model call.

`cinematic-inventory.json` inventories original CPS/WSA resources with hashes.
WSA animation and cinematic artwork is separately tracked by the media layer;
this UI bank does not claim complete animated-movie recovery or painting.
