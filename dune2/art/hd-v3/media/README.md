# Painted object preview media

This bank replaces all **42 ordinary Mentat WSA preview resources** with new
whole-scene 736×448 paintings. This includes the 36 resources referenced by the
native unit/structure portrait fields and six house-confirmation/information
pictures. The native window remains `[128,48,184,112]`.

The original archive members remain unchanged. The retained motion audit in
`motion/` statically decodes the original 36-resource subset's 161 native frame
records. `extra-motion/` retains all 103 additional records. The combined bank
has **264 native records, 210 distinct indexed images and 19 animated resources**,
identified by 33 exact source-index witnesses (the original 30 are a prefix).
Factory code loads frame 0 and immediately unloads it;
only the Mentat information loop advances the stored sequence. See
[`motion/REPORT.md`](motion/REPORT.md) for exact source functions, phase holds,
moving parts, uncertainty and source hashes.

## Production contract

`dist/painted/media.json` has schema 1 and scale 4. Atlas paths are relative to
`dist/`. `resources` is keyed by exact uppercase native filename (`BARRAC.WSA`,
etc.). Every resource has `frames['0'] = {atlas, rect, nativeW, nativeH, status}`;
the rectangle contains one complete new opaque 736×448 painting. All 36 base
images are also retained in `review/<lowercase-stem>-base.png` and match their
production atlas pixels exactly. The extra six resources have
`renderMode: 'painted-frame-sequence'`: their `frames['0']` is a complete base;
later entries are compact `composite: 'replace-on-base'` patches. Their
`nativeRect` is **local to the 184×112 picture**, rather than full-screen. Draw
the base first, then that exact observed native frame's patch at 4× coordinates.
Factory presentation always chooses frame 0. No extra clock is used.

The original preview colours are fixed illustrations; `housePaint` is false.
Examples include the red hangar Devastator and green sonic tank landscape.
They should not all acquire the current player's unit palette.

Each resource retains its source SHA, owners, full native frame count,
`visualPhaseSequence`, per-frame indexed hashes and changed geometry, plus the
semantic motion parts from the independent static audit. `motion` contains the
complete indexed frame witness table. A repeated native frame remains a hold;
there is no invented preview clock or gameplay simulation in this bank.

`parts` contains nine newly painted transparent whole objects:

- Three radar dish poses, with a fixed bottom mount pivot.
- Two complete red airport signalman poses.
- Three coherent white/light-blue guard gestures with a fixed foot pivot.
- One complete low airport transport with red roof lamps.

Their native footprint metadata is 24×17, 16×24, 6×13 and 32×5 respectively.
The compositor may scale a whole figure to a smaller native character and
retarget its anchor to the corresponding feature in the new painting.
The corrected narrow third guard gesture avoids shrinking a person just to fit
an excessively extended arm. Only that corrected cell is consumed; the other
eight parts retain the first selected raw output.

`cleanplates` contains six matched **new-art** background patches: radar,
marshal, palace gate, foreground and middle guards, and a spare starport apron.
They remove the old painted pose before drawing another, preventing ghosts.
`nativeRect` is local to the 184×112 preview. Edge blending by one native pixel
is recommended because these are independently inpainted patches. No original
RGB pixels are projected onto the new art.

## Art and build

Nine 2×2 raw sheets contain the 36 new whole illustrations. All were generated
with the built-in ImageGen tool, using native first frames for semantic geometry
and the approved v2 buildings/v3 advisor paintings for style. Each tool output
is preserved unmodified with its exact prompt, metadata and SHA. The rows were
inspected and measured separately: tool output split positions are explicitly
recorded, rather than assuming every sheet divides at half height.

Whole scenes are resampled and packed; original indexed colours never fill
their source silhouettes. Motion parts are extracted by connected component,
excluding invisible alpha-1 fringes and adjacent-cell spills. Selected raw files
remain untouched. New cleanplates were separately edited with the built-in tool
from crops of the new paintings.

The extra six paintings use `extra-worlds.png` and `extra-troops.png`.
FARTR/FHARK/FORDOS are **fixed crests and rotating homeworlds**, not talking
heads. Three new 2:1 painted surface maps in `extra-planets.png` are baked onto
the original globe envelopes for all 30 native phases per planet. The new
phase images preserve static crests/starfields. The rotation is a documented
new-art interpretation, not recovery of the original surface-map algorithm.
FREMEN and SARDUKAR retain fixed whole figures with native-driven small
equipment-lamp colour/intensity variants. WORM is a single static image.
There are 97 additional replacement patches, avoiding about 100 MB of repeated
full-scene decoded backgrounds. The previous 36 bases, nine motion parts and
six cleanplates remain byte-identical.

```sh
node tools/prepare-painted-media.mjs
node tools/prepare-painted-media-prompts.mjs
node tools/build-painted-media.mjs
node --test tests/painted-media-assets.test.mjs
node --test tests/painted-extra-media.test.mjs
```

Preparation consumes the static motion audit; it does not execute the game.
`tools/prepare-painted-media-parts.py` and
`tools/prepare-painted-media-cleanplates.mjs` reproduce the additional reference
sheets. The runtime compositor is independently owned in
`dist/painted-media.mjs`; the art builder never rewrites it.

The canonical `build-painted-media.mjs` now builds all 42 resources, including
their retained native-phase sequences, with no image-generation or network
calls. `tools/painted-extra-media.mjs` is its deterministic phase-baking helper.
`tools/build-painted-extra-media.mjs` can separately stage the extension for
review. The static extra source audit can be reproduced with
`python3 tools/build-painted-extra-media-motion.py`; this is not required by
the normal art build because all decoded evidence is retained in the project.

## Fidelity limits

- These are faithful new illustrations of the original subjects, cameras and
  environments, rather than literal recovery of every decorative bolt, extra
  background detail or source pixel. Native rules and selection hitboxes do not
  depend on these illustration details.
- Motion uses native observed phases with new whole parts and semantic effects;
  its painted rotor blades, dust, vent steam, welding sparks, light strips and
  tiny gestures are reconstructions. Exact native timing/phase evidence and
  unresolved physical interpretations remain in `motion/`.
- Some feature anchors change within the new illustration. In particular,
  the starport's clear foreground road is lower than in the native first frame;
  the compositor records this retarget while preserving source phase positions.
- All 42 ordinary preview assets in `content.json` are covered. Intro/finale WSA
  cinematics remain separately owned; this bank makes no completion claim for
  those films.
