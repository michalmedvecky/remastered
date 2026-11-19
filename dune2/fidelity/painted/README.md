# Painted-world acceptance — 0.6

This record concerns the new browser presentation, not new DOS experiments. No original EXE was executed for this release. The existing native C engine, WASM and game-data preload are unchanged from commit 77f1eb1. ZIP and all 19 retained original files passed a fresh read-only hash verification.

## Observed in the browser

The real WASM engine loaded the existing Atreides first-mission QA save. Painted construction-yard art, infantry, Trikes and world-coordinate terrain rendered with native fog, selections, cursor and messages. A selected Trike moved to the commanded map position, changed facing and revealed terrain. Camera scrolling moved world objects and surface coordinates together. Original/painted switching changed presentation and aspect while keeping the same running mission; native input still selected and moved units afterward.

Native concrete production completed. A forbidden placement was rejected with the original message; a legal adjoining cell received the painted slab. F2 opened Options. A separate save named `painted hd qa` was written to `_SAVE001.DAT`, appeared in the native load list, and loaded back with the placed slab. The earlier QA save was retained. Native modal help and Options use the original framebuffer while the world resumes painted rendering afterward.

The artwork gallery loaded all 27 native unit bindings,19 structures, ten surfaces and 244 individual sprite slots without errors. Its controls selected all six faction colours, cycled saved states and turned tank turrets independently. This is art-bank inspection, not a simulation of every unit/campaign state. The review exposed invented cobalt collars on neutral native turret parts; targeted ImageGen corrections and a regression check remove those collars.

[Saved screenshots and runtime diagnostics](../../art/hd-v2/review/) show the actual game and production gallery. `browser-acceptance.json` binds final production banks and records the scope.

## Independent checks and limits

Asset tests independently verify native resource hashes/geometry, full 389-tile ownership partition,244 explicit world slots,525 original SHP records, alpha/pivots, source/raw/atlas bindings, house paint and native deviation palettes, windtrap masks, terrain UV repeats and the isUnveiled fog regression. Strict `build:art` rebuilds without another generation call. Package verification checks all source-manifest bytes and delivery dependencies.

The full campaign tree, every native attack/damage effect and every structure state were not played through in this graphics task. Those states have inspected/validated resource bindings and retain existing native selection/timing. Gallery cycling is a convenient inspection cadence. Destination-dependent distortion remains supplied by the native engine. Aircraft shadows approximate native lookup shading with the new artwork’s alpha; faction recolouring preserves painted luminance. Menus, advisors and cinematics retain native art. This release does not claim pixel equality, exhaustive runtime equivalence or complete binary-code discovery.
