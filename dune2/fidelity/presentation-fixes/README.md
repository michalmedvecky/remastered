# Whole-scene presentation fixes — initial 0.7.1 pass

The reported screenshots showed a painted face over an original advisor body,
original mission outcome art, credit digits outside the metal frame, and square
spice patches. These are presentation fixes. The initial pass left native engine binaries unchanged. The subsequent 0.8
Czech/typography pass adds observer decoding and a scoped end-of-mission
presentation marker; game rules and original files remain unchanged. See
[the current localization/browser review](../localization/BROWSER.md).

## Advisor composition

Observed cause: MISC.ENG contains only the house-confirmation question strips.
Their exact witnesses outranked the advisor's older right-edge witnesses once
buttons or speech covered that edge. The resulting scene had no whole painted
base, but still received animated face patches. Proceed/Repeat could also obscure
the briefing witnesses.

`dist/painted-scenes.mjs` recognizes each of the four original advisor CPS images
using 384 distributed exact indexed samples. The common domain excludes the
union of all native actor patches, speech, preview and bottom widgets. Native
ownership and cursor-free pixels exclude current overprinted ink. MISC is an
overlay, never a whole-scene candidate. An actor patch requires a successfully
painted whole base and the corresponding MENSHP resource; unknown or ambiguous
backgrounds receive no isolated HD actor parts.

The production UI renderer passed [35 complete composition cases](advisor-canvas-results.json):
all four advisors, eye/mouth/shoulder poses, help, three house confirmations,
unknown background safety and stale patches from another advisor. Static hair,
body and wall pixels are compared to independently cropped whole painted bases.
Live native-browser traversal also reached house confirmation and briefing with
Proceed/Repeat: [confirmation](after-confirmation.jpg), [briefing](after-briefing.jpg).
These live shots are separate from the inert source-evidence fixtures.

## Mission outcome coverage

The original screenshot is WIN1.WSA. Four ordinary resources were absent from
the previous 42-resource preview bank: WIN1, WIN2, LOSTBILD and LOSTVEHC. Each
supplied WSA has one actual frame plus a duplicate loop record. Four new whole
paintings preserve their composition; the ten earlier atlas files are unchanged.

The combined bank has 46 resources, 268 native phases and 214 distinct source
images. The [independent reference audit](../../art/hd-v3/media/outcome-motion/ordinary-coverage-audit.json)
resolves all briefing/win/loss picture names in 66 scenarios and all 40 distinct
help-file resources. It does not assert that unrelated intro/finale movies have
new art.

[All 268 phases](outcome-media-canvas-results.json) rendered with zero missing
assets or recognition errors. [Twelve whole outcome UI cases](outcome-advisor-canvas-results.json)
combine each outcome with Atreides, Harkonnen and Ordos, real source poses,
source text and Proceed/Repeat. Both the whole advisor and the unobstructed
painted preview are checked independently. [Whole WIN1 scene](after-win1-full-ui.jpg).
These fixtures execute no DOS or native WASM; they exercise the production
presentation against retained original resource evidence.

## Credits

The original counter has six slots at x260+10i. Its last native glyph reaches
x317, beyond the narrower painted inset. Reflow now retains fixed slot identity
at x258+8i and clips all glyph ink and stroke to [258,4,48,9]. Native y positions,
vertical rolling, source copy windows and leading blanks remain authoritative.
CHOAM receives its own bounded painted inset.

A whole-UI check exposed a second cause after the geometric fix: the approved
HUD artwork has alpha 249–253 near this field. Original digit ink could remain
visible beneath it. Restoring the clean static SCREEN.CPS counter rectangle in
the current palette before painting the HUD removes that ink without changing
the authored art or frame geometry.

[162 complete UI cases](credits-canvas-results.json) cover HUD/CHOAM, 0, 341,
65535, a six-slot stress value, every tested carry/borrow offset from -7 to 7,
partial source copies and background suppression. They independently compare
the whole 1280×800 output to a no-digit baseline: zero changed pixels outside
the safe field and zero changes to the right bevel. [Counter review](credits-canvas-review.jpg).

## Spice, dunes and scrolling

Observed cause: the old terrain pass used tile-local masks and forced the
interior dune/spice/dense-spice masks opaque. Native dense frames 206 and 207
contain similar sparse dark mineral counts, but that special case turned the
second into a full replacement plane. A same-position comparison to an unrelated
sand tile also misclassified ordinary colour noise as dune geometry.

`dist/painted-material-field.mjs` uses genuine source palette memberships and
native cardinal topology to assemble a continuous field over the committed
17×12 grid. It feathers after assembly. All three materials share the new sand
substrate; new spice colours are a granular overprint. Cosmetic grains are
anchored to world coordinates and use a separate deterministic hash, with no
game RNG draws. Ground IDs, harvesting, visibility and native descriptors are
unchanged. Native fog is applied after the painted ground.

[Production Canvas checks](terrain-canvas-results.json) compare overlapping
camera origins: 1,720,320 RGB bytes match exactly, hidden RGB sums to zero, native
tuples remain unchanged, and unit-only changes reuse the cached terrain. The
measured unchanged draw was 1.4ms and the next camera build 7ms on the QA host;
the first cold build was 44.1ms. These measurements are observations, not a
universal frame-rate guarantee. [Original/HD review](terrain-canvas-review.jpg).

The granular distribution is a cosmetic reconstruction from native coverage,
not literal original pixel noise or a change to spice quantities. Whole movie
repainting and exhaustive campaign acceptance remain outside this fix.

## Reproduce and resume

Run `npm --prefix dune2 test` from the collection root. The retained generators
under `fidelity/painted-polish/` create inert temporary pages in `dist/`:
`advisor-canvas-review.py`, `credits-canvas-review.py`,
`outcome-advisor-canvas-review.py`, `media-canvas-review.py`, and
`terrain-field-review.mjs`. Serve the collection, open each page in a browser,
inspect its rendered output and save its result before deleting the temporary
page. Their fixtures read verified original slices from the retained preload;
they do not execute the original game.

- [x] Reproduce and identify advisor, outcome, counter and terrain causes.
- [x] Implement presentation fixes without native binary changes.
- [x] Verify complete scenes with the production Canvas renderers.
- [x] Retain generation provenance and original reference coverage.
- [x] Pass 864 collection tests, including 137 Dune tests, and reproduce all 32 public graphics files byte-identically.

[Release checks](release-checks.json) bind the tested native binary hashes. The
complete corresponding-source package is verified separately against its own
manifest; the collection snapshot binds final public files. The external analysis
checklist records the committed revision after packaging.

The original ZIP and all 19 original inputs passed a read-only hash check during
this pass. No original DOS execution was needed.

The [final live browser state](final-live-state.json) reports 46 resources / 268
phases loaded, continuous terrain enabled, and zero renderer errors, missing paint
or text-fit violations. [Final native mission HUD](final-hd-game.jpg). Original/HD
switching was checked after the final runtime reload.
