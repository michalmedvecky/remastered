# Native HD presentation bridge

The bridge observes the recovered native renderer. It does not mutate simulation objects, dirty flags, RNG, script state, clocks or input. The original indexed framebuffer is still produced by the native engine. Desktop builds compile the hooks to no-ops.

`tools/patch-native-hd.py` adds source-bound, idempotent hooks to `src/gui/viewport.c`, `src/gui/gui.c`, `src/sprites.c`, `src/timer.c` and `src/video/video_sdl2.c`. Native command capture happens after original varargs, house-palette, widget-position, centering and dimension calculations, before original clipping/rasterization. The unmodified raster path still runs afterward.

## Payload

The synchronous `Module.duneHdPresent(payload)` callback receives an independent byte snapshot:

* `version:1`, `pixels:Uint8Array(64000)`, `palette:Uint8Array(768)` with native6-bit channels.
* `tiles:Uint16Array(600)`:15×10 cells, four words each: groundTileID, overlayTileID, houseID, isUnveiled. The native world rectangle is `(0,40,240,160)`; each tile is16×16 logical pixels.
* `commands`: native unit/effect draw records in painter order. A record has `id,x,y,width,height,flags,clip,remapCount,palette,remap,house,owner,layer`. Coordinates are original320×200 top-left positions before clipping; `clip` is `[x,y,width,height]`. `palette` is the effective16-entry mapping or null; `remap` is the exact256-entry destination mapping or null. Native flips remain in flags1/2. `0x100` is remap; `0x200` is blur.
* `uiCommands`: a bounded128-entry observation cache with the same record fields plus native `screen`, `window` and monotonically increasing `serial`. These are candidates, not assertions that the sprite remains visible: the browser must verify their original pixel prediction against the current native screen before replacing them.
* `worldVisible`, `viewport` (packedcamera tile), `selectedUnit`, `selection:{position,width,height,state,type}`, `gameTick`, `playerHouse`, `veiledTileId`.
* `cursor:{id,x,y,hotX,hotY,visible}`, `message`, `screenOffset`, `cacheOverflow`.

The fixed C command ABI is16int32 fields plus16palette and256remap bytes (336bytes). The UI extension appends screen/window/serial (348bytes). Compile-time size checks guard both layouts. JavaScript consumers use named fields, not these private offsets. Palette conversion matching the SDL backend is `(sixBit*65)>>4`.

## Dirty-state and lifecycle behavior

Native world drawing is incremental. Commands persist per native unit/effect owner and are replaced only when the native renderer actually redraws that owner. Commands store world-pixel positions, so a camera change translates stationary cached objects without forcing a native draw. Native `Unit_Find` allocation/recount order is preserved within layers: worm, ground, explosions, aircraft. Shadow, body, turret, harvesting animation, smoke and selection-reticle order is retained within the owner.

Read-only live pool and visibility checks prune removed/off-map/fogged owners. Sandworm trail visibility includes the two native previous positions. Reticle sprite6 is emitted only for the currently selected unit. An individual owner is bounded to16commands; overflow is counted, never written out of bounds. The UI cache is bounded to128entries, replaces matching keys and retains recent write serials. The original sprite-table lookup is enabled only after native loading finishes, and disabled before unloading.

`worldVisible` requires a completed native viewport, game mode NORMAL, an active game timer, native targeting/placement/unit/structure selection state, zero display offset and no in-progress viewport draw. Options, Mentat, factory/hint dialogs and incomplete fades therefore use original presentation rather than exposing a reconstructed world through a native modal. Browser pause dialogs may retain a stationary last frame; the host controls their clock/audio policy separately.

The callback runs at the end of native `Video_Tick`, after normal SDL presentation. Indexed pixels include the same valid0..320-word offset used for the four extra credits scanlines; an unexpected larger offset reports the base framebuffer, with `worldVisible:false`. The browser must retain original SDL fallback for unsupported display states.

## Verification and limits

`python3 fidelity/hd/test-native-cache.py` compiles the actual cache under AddressSanitizer. It checks stationary persistence, camera translation, allocation/painter order, shadow-before-body, selected reticle removal, owner replacement/pruning, copied palette/remap data, owner overflow and bounded UI replacement. It also checks source-patcher idempotence and desktop syntax for four affected translation units. The complete bridge and all five affected units were syntax checked with the installed Emscripten/SDL2 headers.

These checks verify presentation plumbing, not the visual quality of HD artwork or complete browser acceptance. Retained original combat, terrain, script and media tests remain separate. UI candidate records can refer to temporary screens or sprites overwritten later; callers must use original-pixel comparison and original fallback, not treat the cache as a retained scene graph. No original DOS executable is run by these bridge tests.
