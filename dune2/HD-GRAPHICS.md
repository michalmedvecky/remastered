# Approved painted HD — release 0.6

The user approved the whole-object art pilot and requested all buildings, units and terrain in that style. The active game now uses complete painted RGBA artwork at 1280×800. It does not use the rejected generic material overlay or xBR smoothing. Original mode remains available without restarting.

## Artwork and complete native resource coverage

The native world bank has 244 SHP frames and 389 ICON records. Every known world record has an explicit presentation entry. All 27 unit types have explicit visual bindings. Vehicles, aircraft, people, wrecks and exposed worm bodies have painted poses; tiny beam/projectile masks remain analytic. Tank hulls and turrets remain independently articulated. Of 244 SHP records, 233 are painted, five tiny projectile/distortion masks are analytic effects, and six are genuinely empty native frames. Empty resources are recorded, rather than silently counted as drawings. [Unit manifest](dist/painted/units.json) and [unit sources](art/hd-v2/units/) retain exact IDs, source hashes, references, raw outputs, prompts, pivots, packing and cleanup.

Building coverage includes all 19 structure types: 16 semantic buildings, concrete layouts and walls. Whole generated building art is packed first, then split at native cell boundaries. The 254 building-owned ICONs cover complete bases, meaningful open/loading/repair/dish/gun states, shared foundation/rubble, small flag variants and 75 wall connections. New alternate whole drawings handle major shape changes; small native flag cycles are derived from painted markers and labeled as such. Windtrap air inlets use a semantic mask on the new curved artwork driven by actual palette 223. [Building manifest](dist/painted/buildings.json) and [sources](art/hd-v2/buildings/) distinguish these states and their limits.

The 135 remaining ICON states use ten newly painted semantic ground planes: sand, dunes, rock, mountain, spice, dense spice, concrete, cracked concrete, rubble and scorched ground. Surfaces are sampled in world coordinates with joined repeat edges. Native geometry selects semantic boundary masks and visibility; original per-pixel colour noise is not reapplied to the paint. Craters, debris, tracks and blooms derive from painted archetypes using native footprints/directions. Original fog masks remain black visibility masks, and the native isUnveiled flag hides valid underlying map data even when its overlay is zero. [Terrain manifest](dist/painted/terrain.json) and [sources](art/hd-v2/terrain/) record every owned state, generated inputs and derivation.

## Native integration

The existing read-only C observer supplies actual tile IDs, unit/effect draw calls, positions, clip rectangles, painter order, current palettes, camera, cursor and selection. Stationary commands persist across native dirty redraws. No simulation calls, RNG draws, timer changes or input commands are added. Native code and WASM remain unchanged by this graphics release.

A separate [original indexed bank](dist/painted/native.json) predicts the original framebuffer. Painted terrain, building pieces and whole sprite layers render using native decisions. Original-vs-predicted differences restore genuine messages, selections, placement marks and unsupported destination effects. The cursor and selection sprite remain native overlays. This evidence bank is separate from new artwork: its per-pixel RGB is never imposed on the painted bodies. Native temporary deviation palettes determine body colours; turret colours follow their own actual command. Only semantic cobalt faction paint is recoloured; neutral metal and authored shading remain the new image. Native hit highlighting modulates the new RGBA rather than replacing it with low-resolution colour blocks.

Aircraft shadows follow native shadow commands using the new artwork’s alpha, an approximation of the original lookup shading. Pure destination distortion is repaired from the native framebuffer. Semantic faction recolouring preserves painted luminance rather than claiming literal native palette-ramp colours.

World presentation is capped near 30 Hz. Variants have count and byte bounds; terrain caches depend on map/camera state. Menus, advisors, cinematics and incomplete viewport states retain native presentation. This release does not claim new artwork for all 1049 WSA movie frames or new UI portrait drawings.

The larger HD playfield uses square presentation pixels at 8:5, matching the approved art. Original retains historical 4:3 display correction. Both map pointer coordinates through the same native 320×200 canvas; the HD layer has no pointer events. Collision, targeting and game coordinates stay unchanged.

## Verification and reproducibility

`npm run build:art` reproduces every shipped atlas/manifest from retained inputs, without another image generation call. Built-in imagegen edits produced the new artwork. Source references, exact prompts, unmodified generations, crop/matte/alpha repairs and hash-bound outputs remain under [art/hd-v2](art/hd-v2/PROGRESS.md). Original game archives are external native-build inputs; original decoded visual references and generated art are included in the corresponding-source download.

Meaningful checks cover the complete 389-ID ownership partition, original resource bindings, atlas/frame geometry, actual nonempty sprite content, independent turret IDs, native-empty records, faction/deviation/flash behaviour, transparent boundaries, connected ground UVs and fog visibility. Browser acceptance checks actual native missions and Original/HD switching, plus artwork views across the production bank. [Acceptance evidence](fidelity/painted/) separates browser observations from independent tests and original DOS comparison evidence.

Artwork is an interpretation of the original shapes, not a claim of pixel equality or exhaustive artistic equivalence. Derived small flags/marks and retained hardware-like distortion are explicit. Existing native gameplay, hardware, save and untested campaign limitations remain in [FIDELITY.md](FIDELITY.md).
