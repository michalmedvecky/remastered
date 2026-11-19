# Painted native world sprite bank

This bank replaces the244 native world/effect SHP slots111–354 with233 newly
painted pose/effect frames,5 deliberately procedural tiny-bullet/distortion
masks and6 explicit original empty frames. It is bank coverage, not evidence
that every campaign branch or original hardware effect has been observed.

## Sources and generation

`inventory.json` records the original UNITS2.SHP, UNITS1.SHP and UNITS.SHP
resource hashes, exact frame bytes, dimensions, source index/alpha planes,
palette tables and native centres. The original PAK slices are verified through
the retained preload. `native/` and `references/` are read-only decoded reference
derivatives, not generated art. `groups.json` maps21 separate meaningful jobs
to exact native IDs and reference hashes. Every job's exact built-in ImageGen
prompt and unmodified result are retained under `raw/`.

The accepted pilot supplies the Trike N/NE/E images for243–245. Its consumed
PNGs and complete approved vehicle style sheet are copied into `pilot/`, so
the production builder does not depend on the external analysis workspace.
Earlier absolute paths inside exact generation transcripts describe historical
tool inputs; the same approved source bytes now live in this directory.

Tank hulls and all regular, siege, Devastator, Sonic and launcher turret layers
remain independent native IDs. They are not replaced by frozen whole-tank
poses. Five source ground facings, native mirroring, aircraft cargo variants,
Ornithopter wing phases, individual/squad walking poses, wrecks, harvesting
spray, explosions, gas, worm-swallow phases and projectile families have their
own records. `unitBindings` retains all27 original unit-table entries, including
intentional original shared bodies and missile graphics.

The first Saboteur and Soldier sheets showed faces in the north poses.
Targeted edits replace those first3 cells with back views. The initial south
Quad was interpreted as a Trike; `quad-south-fix` restores4 corner tires and the
down-facing paired guns. Original attempts remain alongside the selected edits.
ID353 retains the source's distinct pale X-shaped object rather than silently
inventing another infantry group; no definitive gameplay role is claimed here.

Faction-gallery review exposed invented blue collars on otherwise fixed steel
turrets. Native frames116–120,126–130 and141–150 use global256 colours with no
local house-remappable palette. Targeted ImageGen edits replace only those
collars with neutral steel; their semantic faction masks are explicitly empty.
The original outputs and exact correction prompts remain in `raw/`. Devastator
frames136–140 retain their original selected `turrets.png` cells and byte-identical
packed output: their local16 palette genuinely contains house colour channels.

## Packing and transparency

Run from `dune2/`:

```sh
python3 tools/build-painted-units-prepare.py
node tools/build-painted-units-references.mjs
node tools/build-painted-units.mjs --require-complete
node --test tests/painted-units.test.mjs
```

Preparation only rebuilds native reference inputs; it does not call a model or
modify original game files. The final packer consumes retained model outputs
and accepted pilot PNGs without a new generation call. The local
`tools/painted-png.mjs` codec is included in the corresponding source archive.

Whole new RGBA drawings fit the original ink bounding rectangle inside each
unchanged logical canvas. Native palette colours and individual native alpha
pixels are **not** reapplied. Premultiplied box-area minification preserves
source coverage without a whole-scene blur. Transparent gutter projections
recover actual generated row/column spacing rather than cutting through feet,
turrets or group members when the model adds uneven outer padding.

Alpha≤8 hidden background is cleared. Ornithopter and mini/DeathHand outputs
also contain a genuine low-confidence translucent white matte (corner alpha
roughly74–93). Only those2 inputs receive an explicit128→248 alpha-confidence
normalization before cropping; this is not a white-colour key, so pale steel
remains intact. Raw files remain unchanged, and each consumed frame records the
cleanup and crop. The native-scale contact was inspected after this correction.

`dist/painted/units.json` records each global ID's atlas rectangle, original
extent/centre/ink bounds, consumed raw hash/cell/crop, de novo semantic cobalt
mask and status. The atlas is content-addressed. Partial development manifests
list missing IDs explicitly; `--require-complete` rejects missing art and removes
only obsolete unit-owned atlas hashes. Native, building and terrain banks are
not removed by this tool.

## Scope and checks

The4 scoped tests compare every frame's original planes and geometry against
the independently retained native bank, check all27 type bindings and separate
turret families, verify every consumed atlas pixel/raw hash/semantic mask,
retain true empty slots and guard against cell-sized matte crops or generic
pose reuse. They also prevent cobalt collars or faction masks returning to the20
fixed steel turrets while retaining Devastator house paint and original pixels.
The244-frame native-size contact is `review-contact.png`.

Original unit tables, coordinates, input, animation selection/timing, collision,
RNG and game rules are unchanged. Painted poses are artistic redraws and may
have small stylistic differences between animation frames. The native white
distortion masks159–161 do not mean the game has literal white-circle monsters:
the original blur/compositing path still controls those effects. Actual visible
worm-swallow frames218–222 have separate painted drawings.
