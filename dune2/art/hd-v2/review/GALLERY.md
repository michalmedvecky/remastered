# Production artwork gallery

`dist/artwork.html` and `dist/artwork-gallery.mjs` are a read-only inspection
page. They fetch the same `painted/{units,buildings,terrain,native}.json` files
and content-addressed PNG atlases as the game. No WASM, campaign logic, audio,
save storage or game-state modification is involved.

- All27 native unit bindings appear, with independent hull/turret composition
  and recovered turret offsets. The Turn turret control moves the turret art
  independently without simulating aiming or combat.
- All19 structure types appear. Whole footprints are assembled from the actual
  canonical ICON pieces; the normal index2 is the default. The two slab types
  repeat their terrain-owned tile over the proper1×1/2×2 native footprint.
- All ten512×512 continuous terrain planes are cropped from the shipped atlas.
- The expandable frame bank exposes all244 world-sprite slots, including
  explicitly labeled analytic effects and original empty frames.

Sandworm previews use the actual painted surface/swallow frames218–222, not
the submerged hardware-blur mask. Destination-distortion slots159–161 are
visualized only as clearly labeled outlines; a white proxy is never presented
as a literal worm or sonic projectile body. Small bullet slots remain separately
labeled analytic projectiles. Static windtrap artwork keeps its painted dark
intakes; the gallery does not pretend to run the native palette-cycling clock.

The selected faction defaults to Atreides1. `native.palette` is converted from
the saved eight-bit SDL values to six-bit DAC values with `round(v*16/65)`, the
exact inverse for that palette. The gallery calls `painted-core.recolourPainted`
only when an actually used opaque native local-palette entry lies in144–152
(sprites) or144–159 (building tiles). Neutral source parts remain neutral,
including independently drawn global-palette turrets.

Unit textures are authored at4×. The optional default inspection magnification
enlarges those textures, without adding detail or changing their aspect/pivots.
Structure footprints retain their exact4× scale. State cycling is deliberately
an inspection cadence, not a claim of native animation timing. Infantry uses
the stored3/4-frame patterns; ornithopter previews use its real9-frame family,
with flap pattern2,1,0,1. Aircraft UNIT families use their three drawn facings,
avoiding accidental access to adjacent sprite families. Building cycling includes
construction, rubble, active and turret/connection states for inspection.

QA can read `#art-gallery.dataset.galleryState`, including `ready`, `house`,
`unitTypes:27`, `structureTypes:19`, `worldFrames:244`, `terrainSurfaces:10`,
`frameCards`, animation/magnification state and the `errors` array. This state
describes the gallery only. Live campaign/fog/input acceptance remains separate.
