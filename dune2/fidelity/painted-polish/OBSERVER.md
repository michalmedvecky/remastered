# Committed native scene and visible UI observer

Observed causes in the previous bridge:

- `DuneHD_Present` sampled live `g_map`, selection and unit visibility at video callback time. These can advance before the dirty viewport raster reaches SCREEN0. Original-pixel repair therefore compared the displayed raster against an ahead-of-raster scene.
- `worldVisible` required `s_gameTimer` and no active viewport scope. Pausing native gameplay for an overlay removed the entire HD world even while that world remained drawn behind the overlay.
- UI sprites recorded their original draw screen/coordinates, although the HUD is assembled on SCREEN1 and copied to SCREEN0; rolling digits use additional vertical copies.

The native observer now captures tile descriptors only when the native viewport actually rasterizes that tile, commits painter commands and camera/selection at the viewport completion boundary, and publishes this retained scene independently of gameplay timer pause. SCREEN1-only builds are staged until their full viewport copy. The JavaScript callback exposes `worldRevision`/`worldCommitTick` for browser first-frame comparison evidence. No delay, frame debounce, blur or simulation redraw was introduced. Pure native blur effects also expose their actual horizontal offset, increment and seed so a browser can reproduce the destination-copy effect against painted terrain instead of pasting low resolution terrain pixels.

Visible UI glyphs, sprites and widget-border rims share a screen-copy-aware pixel provenance ledger. Each sprite pixel is observed immediately after the existing raster writes it; no second rasterizer or palette/RNG mutation is used. Transparent holes retain earlier ownership. Dirty writes and present-time native index witnesses prevent stale/invisible labels, portraits or digits from being reported as current. Copied placements retain actual native positions, clipping, effective palettes and painter order.

Verification:

- `python3 fidelity/painted-polish/test-observer.py`: actual C transaction/provenance helpers under AddressSanitizer, six desktop syntax checks, source-patch idempotence, and a guard that Present does not sample live map/owners.
- `node fidelity/painted-polish/test-observer-abi.mjs`: actual EM_JS body against a synthetic native heap; paused committed world, glyph bytes/fonts/spacing, relocated ink, partial overwrite, native-index rejection, border identity and copied sprite geometry.
- `python3 fidelity/hd/test-native-cache.py`: retained owner-cache/painter-order regression.
- Native WASM rebuilt with the retained installed Emscripten compiler through `tools/build-native.py`; retained source and output hashes are in `fidelity/native-build.json`. Original preload data is unchanged; no original DOS binary was executed.

Limits: these tests establish observer synchronization and payload validity; browser acceptance of concrete placement, hint dismissal, options and new UI artwork is recorded separately by the integration owner. Widget-border observation does not label every arbitrary rectangle as a dialog. Entirely transparent font spaces are represented by native spacing between surviving glyphs. Mentat/intro states replace the world; credits scanline offsets and cinematic illustration replacement remain separate presentation paths. Legacy `uiCandidates` are diagnostic and are not visibility assertions.

Live integration QA also exposed two concrete provenance errors, now covered by verbatim native-function regressions: tile/CPS/raw writes without dirty notifications could retain old menu glyphs when indices coincided, while a nonfilled border's broad dirty rectangle could discard a current portrait interior. Actual writes are now observed separately; nonfilled notification rectangles preserve interiors, and direct borders emit explicit fill/schema fields. The first interior pixel row is retained. `_dune_hd_refresh` is an exported pure observer request for paused mode switches.
