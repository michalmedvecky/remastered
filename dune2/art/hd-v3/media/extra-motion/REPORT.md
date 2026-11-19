# Six remaining ordinary Mentat resources

All original archive bytes are read as data. The bounded Format80/40 codec
functions are reused from the retained motion audit without rerunning or
modifying that audit. All 13 PAK hashes are checked against the original
integrity manifest. No DOS binary is executed.

## Observations

| Resource | Native phases | Actual changing content |
| --- | ---: | --- |
| FARTR.WSA | 30 | Blue/green homeworld rotates; Atreides crest is fixed |
| FHARK.WSA | 30 | Dark red homeworld rotates; ram crest is fixed |
| FORDOS.WSA | 30 | Bright ice/cloud world rotates; serpent crest is fixed |
| FREMEN.WSA | 2 | Two red/green equipment indicators exchange colours |
| WORM.WSA | 1 | Static giant coiled sandworm illustration |
| SARDUKAR.WSA | 10 | Blue/red/green equipment lamps vary in intensity |

These are 103 additional native phase records. Every one is distinct within
its resource. In combination with the original 36-resource audit there are
264 records and 210 distinct indexed pictures. Thirty-three exact native pixel
coordinates identify every distinct picture; the original 30 coordinates are
preserved as a prefix. The witness data is palette-independent and must reject
occluded/unknown samples rather than choose an approximate match.

The three `F*.WSA` resources show planets, **not faces**. No eye/mouth animation
is present. Their first-frame reference colours follow the BENE.PAL Mercenary
confirmation context in `GUI_Mentat_Display`. The stored indexed images remain
unmodified and can also be inspected under another active palette.

FREMEN changes only two small red/green marker positions inside `[26,33,4,2]`.
SARDUKAR changes separate lamp levels inside `[32,17,7,7]`; the blue, red and
green samples are at `[32,17]`, `[35,20]`, `[38,23]`. No figure or weapon
translation occurs. At this source scale, the precise fictional electronics
component is uncertain; the new illustration treats it as an equipment strip.

The stored FREMEN wrap packet clears the picture and does not match frame 0.
That does **not** imply two additional displayed phases: `WSA_DisplayFrame`
chooses the reverse frame-1 XOR delta when its two-frame forward/reverse
distances tie (`frameCount < frameDiff` is strict). Transition 1→0 therefore
restores frame 0 without consuming the anomalous wrap packet. This conclusion
follows from source control flow and the reversible deltas, not an emulator run.

The native Mentat loop requests its next WSA frame every seven native GUI ticks.
The browser renderer uses the actual indexed picture to choose a phase; the
new art adds no simulation or animation clock.

## New art reconstruction

Two retained ImageGen sheets supply the six new complete scene illustrations.
Three newly painted 2:1 equirectangular maps supply coherent full planetary
surfaces. The deterministic builder bakes 30 phases per globe, with its original
logical envelope and fixed crest/starfield. It samples only the new maps,
applies an authored limb/lighting model and closes the horizontal texture seam.
The new surface geography is an interpretation of the native rotations; the
original game's actual map projection, surface maps and illumination algorithm
are not claimed to have been recovered.

FREMEN and SARDUKAR use new smoothly painted equipment lamps with their measured
native colour/intensity sequences. The LED locations are retargeted to the
corresponding panel in the new whole illustration; all surrounding new pixels
remain fixed. Source-colour values are semantic lamp controls, never enlarged
pixel blocks or masks that recolour the illustration.

Each resource's frame 0 is a full 736×448 painting. The remaining 97 frames are
compact replacement patches at local native coordinates. This avoids storing
103 duplicate full backgrounds. All prior 36 bases, nine whole motion parts,
six cleanplates and their atlas bytes remain unchanged.

`painted-bindings.json` records geometry, authored models, exact phase controls
and retained raw-art hashes. `review/extra-phases-contact.png` in the parent
media folder shows selected native phases of all five animated resources.

## Evidence and rebuild

- `inventory.json`: all 103 indexed hashes, changed bounds, connected regions,
  palette selection, exact lamp controls and semantic part phase sequences.
- `global-frame-witnesses.json`: all 264 exact indexed phase witnesses and
  explicit equivalent source-picture groups.
- `native/<resource>/frame-NNN.idx`: unchanged decoded source data; adjacent
  indexed and RGBA PNG files are inspection references, not product art.
- `native/opendune/src/wsa.c`: `WSA_DisplayFrame` direction/wrap selection.
- `native/opendune/src/gui/mentat.c`: `GUI_Mentat_Display` and the native loop.

```sh
python3 tools/build-painted-extra-media-motion.py
node tools/prepare-painted-extra-media.mjs
node tools/build-painted-media.mjs
node --test tests/painted-extra-media.test.mjs
```

The normal art build consumes the retained evidence and generated images,
without invoking ImageGen or touching native C/game data.
