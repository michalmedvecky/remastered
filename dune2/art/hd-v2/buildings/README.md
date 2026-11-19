# Whole painted buildings, walls and native state coverage

This bank uses the user-approved construction yard/windtrap artwork as style
guidance. Built-in ImageGen edited complete, losslessly decoded native objects.
It does not apply generic material detail inside the old pixel colours and does
not use an upscaling shader. Gameplay, native positions, footprints, tile IDs,
animation decisions and original resource bytes are unchanged.

## Scope

- All 179 building ICON IDs,210–388, including eight gun-turret and eight
  rocket-turret directions. There are16 semantic building types and106 complete
  native state records in their ICON.MAP groups.
- All75 wall ICON IDs,33–107, including the original connection/shadow shapes
  and scattered destroyed-wall pieces.
- Concrete slab types0/1 and shared IDs125/143 are owned by the separate terrain
  bank. `buildings.json` still records all19 structure types and their ownership.
- Complete foundation/construction material and destroyed-rubble drawings are
  retained. Native fire/smoke damage effects belong to the separate sprite bank;
  nonexistent damaged-building ICON states are not invented.

`native-inventory.json` records original map-group offsets, full-footprint state
assembly, native dimensions, exact ICON IDs, reference-cell positions and input
hashes. `references/` contains the original whole states and complete wall
connections, not separately invented fragments. Palette223 uses the native dark
endpoint for reference preparation; runtime palette cycling remains separate.

## Artwork and compilation

`raw/` retains every consumed unmodified model output, the exact prompt JSONs,
reference roles, hashes and generation records. The approved pilot is copied
into this project. Rebuilding does not depend on the analysis directory or
another image-generation call. Absolute original output paths in provenance
are historical metadata, not build inputs.

Three four-object sheets add the12 remaining large buildings. Separate sheets
cover16 turret facings,11 construction/rubble states,16 meaningful alternate
active poses and75 wall connections. These include loading-bay vehicles,
starport docking phases, refinery unloading, repair occupancy and radar dishes.
Static pieces shared by native states remain byte-identical. Alternate whole
drawings supply the changed source regions, feathered into the stable painted
base at unchanged-neighbour boundaries. This avoids making the entire roof or
plinth change shape whenever a loading light/door cycles.

After extraction of connected artwork and native-footprint fitting, complete
RGBA objects are sliced into64×64 pieces corresponding to the original16×16
ICON cells. Walls retain their original ink offset and extents within that cell;
high-confidence alpha cropping removes faint generated studio mattes. The
scattered rubble state keeps meaningful disconnected stones. `packing.json`
binds untouched raw inputs, fitted whole-object crops, source-state changes,
compiled pixel hashes and final PNG hash. Only this bank's `buildings-*.png`
outputs are cleaned on rebuild.

Ten native variants differ only by9–23 source flag pixels. They select a smooth
highlight phase on the corresponding painted blue house marker and are labeled
`painted-derived-native-flag-state`. Their new RGBA contours remain stable;
exact original cloth-pixel silhouettes are not recreated. This distinction is
explicit in the state ledger and must not be reported as106 independently
generated animation frames. The five windtrap records contain smooth
`emissionMaskBase64` data derived from the new painted dark air apertures;
runtime tint may follow native palette223 without reimposing the old pixels.

## Rebuild and checks

From `dune2/`, using the retained hash-verified native preload:

```sh
python3 tools/prepare-painted-buildings.py
node tools/build-painted-buildings.mjs
node --test tests/painted-buildings.test.mjs
```

Python3 and Node.js use standard libraries and the retained project PNG codec;
no model API, SDK, original DOS executable, emulator or network is required.
The source-only download excludes original game data, so rebuild its native
preload from owned original files before rebuilding these references.

Three independent regression checks compare all state records with the actual
preloaded ICON.MAP, verify all254 tile IDs and compiled pixel/raw/PNG hashes,
native wall bounds and genuine subpixel painted detail, and check explicit
flag/emission classifications. The actual canonical runtime pieces—not raw
model cells—are reassembled for all106 states in
`review/assembled-native-states.png`; its companion JSON identifies every cell.
Shared terrain-owned construction pieces in this isolated diagnostic retain
original reference pixels; the runtime terrain bank supplies their HD drawing.

This is an artistic reconstruction with complete declared native-ID coverage,
not a claim of original-pixel equality or proof that every campaign state has
been visually exercised in the browser. The original graphics mode remains the
reference. Root integration owns world compositing, faction recolouring,
timing, clipping and live browser acceptance.
