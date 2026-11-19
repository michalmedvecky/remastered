# Approved painted HD integration — 0.6

User approved the whole-object pilot on 2026-11-19 and requested all buildings, units and terrain integrated into the game. The accepted references and exact original pilot remain in analysis/dune-2/hd-art-pilot-v2; consumed style sources are copied into this art directory by the production builders.

- [x] Keep original game/native simulation and inputs intact; preserve Original mode.
- [x] Inventory and paint all native building ICON variants as whole coherent objects; split only during final packing.
- [x] Inventory all 244 world/effect SHP slots: 233 painted poses/effects, five explicit analytic masks/projectiles and six native-empty records; preserve independent turrets, facings and animation.
- [x] Produce continuous semantic terrain for all native terrain classes/transitions, with original map/fog rules.
- [x] Build hash-bound original indexed prediction bank separately from free RGBA artwork.
- [x] Integrate world-coordinate terrain, building tiles and real native sprite commands, preserving clipping, draw order and faction colours.
- [x] Keep native overlays, cursor, selections, menus and unsupported effects readable; remove rejected xBR default.
- [x] Inspect generated originals and packed art at real 4× size; record unresolved art/coverage explicitly.
- [x] Validate real first-mission movement, turning, camera, fog, concrete placement, mode switching and save/load; inspect all art states/independent turrets in the gallery. Full campaign combat/damage branches remain unplayed in this graphics pass, as recorded in fidelity/painted.
- [x] Run asset/native/render regressions and verify unchanged originals; package corresponding sources/art during release closeout.
- [x] Prepare the collection snapshot and matching source package for the existing remastered branch. The final clean-checkout, commit and push are recorded in analysis/dune-2/painted-hd-integration/release.json outside the source archive.

No Sites publication or cluster rollout is included. Raw generations, exact prompts, native source IDs and deterministic packing remain available for review/resumption.

Validation: the collection suite passed 795 tests before the final neutral-turret colour correction; the final Dune suite passes 70/70, including the additional neutral-material regression. Strict complete atlas rebuilds and the standalone painted-package verifier pass. All 19 original files and ZIP hashes remain unchanged. Browser evidence, final diagnostics and coverage limits are recorded in fidelity/painted and art/hd-v2/review.
