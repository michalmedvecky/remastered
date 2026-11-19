# Continuous sand and spice review

The earlier renderer filled native interior dune/spice/dense IDs with opaque
different surfaces. In particular, native dense206 has53/256 dark mineral
pixels and dense207 has61/256; the old generated masks jumped from34% to100%
opacity. This made the16px cells visible as flat rectangular patches. Dune
membership also treated any positional difference from sand127 as a ridge,
including ordinary unrelated sand dither.

`dist/painted-material-field.mjs` now assembles the committed17×12 grid into a
single density field before feathering. It uses genuine native dune ridge
indices88/92 and spice216–220/dense219–220 membership, with the native cardinal
variant bits N1/E2/S4/W8. All three materials share the newly authored sand
substrate. World-anchored deterministic mineral grains overprint the newly
authored spice surfaces at partial opacity; there is no opaque interior
endpoint. The ordinary and dense spice layers preserve sand relief between
their grains. This cosmetic noise does not consume or change game randomness.

The original ICON indices supply membership and connectivity, never RGB for
the new terrain. Native tile identities, visibility, harvest transitions and
simulation are read-only. Exact native fog is drawn last, including after
buildings. Unit-only changes reuse the cached terrain; a changed committed
grid or tile tuple rebuilds it. The original terrain descriptors and authored
surface/mask/overlay atlases are unchanged.

## Reproduce the review

From `web/dune2`, run:

```sh
node --test tests/painted-material-field.test.mjs tests/painted-terrain.test.mjs tests/painted-camera.test.mjs
node fidelity/painted-polish/terrain-field-review.mjs
```

Open `/dune2/terrain-field-qa.html` through the existing local preview. The page
is an inert Canvas fixture: it decodes original ICON data for the left-hand
reference and calls the production painted renderer on the right. It does not
execute the original DOS binary or WASM game. The generated HTML is temporary
review output and should be removed from the release package.

The browser review accepted the new granular appearance. Its controlled mixed
17×12 fixture reported:

- Shared camera overlap:1,720,320 RGB bytes compared, maximum difference0.
- Fully hidden tile: RGB sum0; native input tuples unchanged.
- Moving-unit-only draw:1.4ms, terrain rebuild count remained1.
- Warm next-camera rebuild and draw:7ms on the review Mac/browser.

These timings are observations from that local browser, not performance
guarantees. The fixture also reports cold-build timing for each run. The
21 focused terrain/material/camera tests passed.

## Fidelity limits

The original grain membership and cardinal class boundaries guide the density;
the detailed HD mineral pattern is an artistic reconstruction, not an exact
recovery of native pixels. Texture colour comes from the existing new painted
surfaces. Rock/mountain transitions, overlay footprints and exact fog retain
their prior renderer paths. At the outside of the committed grid, a canonical
grain template may continue only a connection explicitly present in that
edge's native bits; no hidden or additional map state is read. The committed
fringe keeps the displayed camera interior away from this bounded edge.

The controlled fixture establishes camera/cell consistency, fog and cache
behaviour; it does not establish exhaustive campaign or harvesting coverage.
Live-game visual review remains a separate acceptance check.
