# Czech caption clipping and widget clearance

The reported HUD captions were moved into painted button fields while their
coverage clips still used native text coordinates. That could remove an initial
letter despite the literal observed run remaining complete. The runtime now
maps coverage from the full immutable native run into its painted target,
including genuine copy gaps, and reserves the widget's bevel clearance.
Factory captions use fixed name/quantity/cost lanes above the original baseline.

`canvas-review.py` creates an inert production-painter fixture. It reconstructs
indexed glyph observations from the emitted Czech FNT tables and actual native
widget/call geometry. It does not execute a game, WASM or emulator. The complete
reference changes only text coverage; native pixels, glyph ink, words and
positions remain identical. Pixel equality therefore checks whole captions,
including their first letters. Blank-caption comparisons isolate new text and
check that all changed caption pixels remain inside the safe interior.

The final matrix has **27 cases**:

- Zrušit, Opravit, Ústup, Útok and Těžit, each at three native copy origins.
- Tall production portrait captions Postavit, Umístit, 42% and100% hotovo. Long native runs can begin outside the button; their immutable centre identifies the owned caption field.
- Two Options windows, including long speed labels and repeated ZAP. states.
- Both ten-pixel Hall of Fame buttons, with a minimum readable cap height.
- CHOAM Větrná elektrárna / Cena: 300, with and without quantity. The original
  182×14 copy window and its clipped trailing font cells are retained.
- The Mentat subject header and semantic Zpět / VOLBY buttons.

An initial 17-case run also exposed a separate **513-byte first/repeat border
raster difference**. An identical-frame repeat reproduced it across the button
bounds, with maximum channel difference 52; it was not a text-clip difference.
A one-pixel pre-read did not remove it. The bounded panel cache now rasterizes
nine-slicing at the final dimensions, freezes its pixels and copies it 1:1 with
smoothing disabled. Its limits are 48 panels / 12 MiB. `fifth-results.json`
records all 17 original cases passing, including zero first/repeat and reference
differences. No tolerance or warm render was used. The final expanded fixture
retains the strict identical-repeat assertion and removes diagnostic pre-reads.

The final **27-case browser run passed** in [canvas-results.json](canvas-results.json):
all full-reference differences, identical-repeat differences, caption pixels
outside safe fields and text-fit violations are **zero**. The reviewed output is
[panels-fixed.jpg](panels-fixed.jpg).

The four source-fixture tests also pass. They verify exact Czech initials and
copy origins, actual CHOAM clipping, and that the widened reference changes no
native pixel evidence.

```sh
node --test tests/text-layout-fixtures.test.mjs
python3 fidelity/text-layout/canvas-review.py --output dist/text-layout-qa.html
```

Open the temporary page through the existing preview and inspect `#result` and
`body.dataset.pass`. Save its results and remove the HTML before packaging.
Source hashes are embedded. Failed diagnostic runs remain evidence, not final
acceptance results; this matrix does not claim exhaustive campaign coverage.

The final UI additionally passed all24 [security input compositions](security-results.json), including the real native blink. The new pixel observer requires both exact native security schemas and a full FG15 cursor block; it adds no independent timer. [Details](security-scene.md).

Live normal-engine traversal on an isolated port6004 origin verified [Options](live-options-fixed.jpg), [unit actions](live-unit-actions-fixed.jpg), [placement](live-placement-fixed.jpg) and the [factory caption](live-factory-fixed.jpg). This diagnostic traversal preceded the final cold-panel cache/security adjustments; acceptance of the final source is bound by both Canvas result manifests above. The existing user game/session was not changed.
