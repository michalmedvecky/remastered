# Painted native interface

The interface bank replaces the fixed 320×200 presentation surfaces with new
whole-object paintings at 4× resolution. Native content, hitboxes, timing and
simulation remain authoritative. This folder does not modify the renderer or
native observer.

## Production contract

`dist/painted/interface.json` has schema 1, scale 4 and base house 1. Atlas paths
are relative to `dist/`. Each frame has an atlas ID, an RGBA pixel `rect` and a
native-pixel `nativeRect`. Nine-slice margins are ordered left/top/right/bottom
in **native pixels**. Recolour only frames explicitly marked `housePaint`;
advisor portraits and the three independent heraldic crests keep their own
colours.

The bank contains 23 frames:

- `hud-shell`: complete opaque clean chrome, with exact transparent gameplay
  viewport `[0,40,240,160]` and radar `[256,136,64,64]`.
- `hud-frame-only`: alternate shell with transparent native live wells for a
  consumer that separately paints those surfaces. It is an alternative to the
  full shell, not an additional layer.
- `factory-shell`: native factory/CHOAM screen with transparent media well
  `[128,48,184,112]`; new live icons, text and selected crest render above it.
- `menu-plate`, `widget-button`, `widget-button-pressed`,
  `widget-button-disabled`, `widget-inset`, `frame-border`, `message-inset`:
  reusable new painted surfaces for native procedural rectangles.
- `house-choice`: three newly painted whole crests at original native positions
  and three blank nameplates. The native click rectangles and fixed semantic
  labels are included in metadata.
- `house-confirm-question` / `house-confirm-name`: new blank strip surfaces for
  the separately composited MISC.ENG labels. Exact text and source/destination
  strip rectangles are metadata; no lettering is baked into the art.
- `advisor-h/a/o/m`: four complete newly painted advisor plates. Their native
  eye/mouth/shoulder/book/ring rectangles and media well are metadata. New
  animated patches are supplied by the separate `icons` bank.
- `campaign-shell`, `campaign-undivided`, `campaign-regions`,
  `campaign-region-lines`, `campaign-planet`: the strategic-map console,
  continuous newly painted terrain, divided map, separate smooth boundary
  network and first-victory Arrakis still. All map images target the exact
  native `[8,24,304,120]` viewing well. House ownership overlays and arrows use
  the separate native-driven `icons` bank.
- `score-shell`: the score/Hall-of-Fame background, composed like the native
  routine: two upper crest wells and a clear lower scoreboard. The three
  original lower crests were an atlas source, not three permanent UI icons.

Paint chrome first, then native semantic text and new icon images, respecting
the native clip and command order. Advisor frames are opaque whole paintings;
paint the media window content above them and shoulder/foreground patches above
that content in the native order. The four uncut final `review/advisor-*-base.png`
files are byte-identical to the corresponding production atlas frames and are
the frozen edge reference used by the matched patch packager.

## Native evidence

`native-inventory.json` verifies all 13 retained PAK archive hashes against
`fidelity/original-integrity.json`, inventories all 19 full-screen CPS-style
resource headers and all 19 game widget rectangles, and records explicit
ownership for excluded media. It decodes resources as bounded data; no DOS
binary is executed.

Fourteen `scenes` entries in the production manifest contain exact original
64,000-byte indexed images plus SHA-256 and sparse nonzero immutable witness
points for `SCREEN.CPS`, `CHOAM.CPS`, `HERALD.ENG`, `MISC.ENG`, `TITLE.ENG`,
the four `MENTAT*.CPS` images, the four visible campaign images and `FAME.CPS`.
Index witnesses remain useful while palettes fade.
SCREEN/CHOAM native indices 144–150 are remapped by `houseID*16`; this is recorded
explicitly. MENTATM uses **BENE.PAL**, as `GUI_Mentat_Display` requires; the other
advisors use IBM.PAL. Their palette hashes and raw DAC values are retained.

DUNERGN is a **visible divided terrain map**. The separate RGNCLK file is
semantic click-region data. Its original 304×120 crop and hash are retained
unchanged. For visual borders, a private copy assigns invalid border cells to
their nearest region, builds each shared edge once, simplifies centre lines by
0.8 native pixels and locally rounds corners before antialiased rasterization.
This removes old pixel stairs and double outlines without changing hitboxes.
All 27 native PIECES shapes/REGION?.INI positions are also retained; the icon
agent's existing contour code supplies their exact common geometry. Background
mountain/dune detail is a new interpretation of the source map, not literal
geographic pixel recovery.

Primary source evidence is `GUI_DrawInterfaceAndRadar`, `GUI_FactoryWindow_Init`,
`GUI_PickHouse`, `GUI_DrawBorder`, `GUI_DrawProgressbar`, `g_widgetProperties`,
`g_table_gameWidgetInfo`, the native window descriptors, `GUI_Mentat_Display`,
`GUI_StrategicMap_Show`, `Sprites_CPS_LoadRegionClick`, and
`GUI_HallOfFame_DrawBackground`.

`campaignComposition` and per-scene `displayWitnesses` support independent
matching of the map console and its composited viewing well. The inherited
DUNERGN display witnesses lie on zero-index province borders and require an
independently matched console; they are evidence rather than sufficient scene
identity by themselves. The integration layer can inspect nonzero source pixels
while excluding actual current region/text overlays.

`crestCompositions` preserves the actual factory/campaign/score CPS source and
destination rectangles, original and remapped cropped index bytes, palette and
local witnesses for all six native house selections. GUI_Screen_Copy horizontal
arguments are in eight-pixel units: factory Ordos source xSrc=16 means **x128**.
Score fallback houses 3–5 use Harkonnen and Atreides in opposite upper corners;
the metadata does not assume both are the current player's crest.

## Art provenance and build

All new art was generated with the built-in ImageGen tool. Every selected tool
output is retained unmodified in `raw/`, with exact prompt and generation
metadata. The approved v2 building sheet was the initial style reference;
subsequent plates use the new HUD as their material reference. A/O advisor
placement corrections retain the original unmodified first outputs alongside
the selected outputs and prompts.

`tools/prepare-painted-interface.py` rebuilds native inventory and advisor
references using verified local resources. `tools/build-painted-interface.mjs`
hash-verifies the retained raw art, resamples complete generated components to
native functional rectangles, applies exact viewport/well cutouts, and packs
the production RGBA atlases. It does not transfer original pixel colours into
the new painted images. All consumed art inputs are project-local.

```sh
python3 tools/prepare-painted-interface.py
node tools/build-painted-interface.mjs
node --test tests/painted-interface.test.mjs
```

The scoped tests check hash/provenance integrity, atlas and nine-slice geometry,
complete transparent viewport/radar rectangles, unchanged native click bounds,
exact advisor base/atlas equality, and every scene witness/indexed-image hash.

## Explicit limits

- The minimap is still a native map-cell data visualization. Its small raster
  dimensions are gameplay information, rather than a missing painted scene.
- Factory and encyclopedia WSA previews are a separate media bank; the factory
  surface intentionally leaves that native media well transparent.
- No claim is made that these 14 interface scenes cover all 19 CPS-style files,
  all WSA cinematics or all native SHP UI states. Ownership is explicit in the
  inventory; UI SHP states are handled by the `icons` bank.
- The five excluded CPS-style resources are four intro/finale stills
  (`AND.ENG`, `BIGPLAN.CPS`, `MAPPLAN.CPS`, `VIRGIN.CPS`) plus the nonvisible
  original RGNCLK click mask. The latter is preserved as semantic evidence.
- The title source is pure lettering on black. Its fixed strings and positions
  are exposed for crisp vector typesetting by the integration layer.
