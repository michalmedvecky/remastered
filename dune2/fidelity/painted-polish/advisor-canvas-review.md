# Whole interface composition regression

The reported screenshots combine a native low-resolution advisor scene with
painted face, shoulder and book patches. Reviewing the media rectangle alone
cannot detect this failure. The regression pages therefore invoke the complete
production `createPaintedUI` renderer over a reconstructed indexed native frame.
They do not execute the game or its DOS executable.

## Advisor review

Generate a temporary page from the `dune2` directory:

```sh
python3 fidelity/painted-polish/advisor-canvas-review.py --output dist/advisor-qa.html
```

The generator uses retained, hash-bound CPS indices, native SHP/FNT descriptions,
and original decoded WSA fixtures. It stamps actual source pixels, surviving ink,
native clips, palette, widget geometry and serial order. Four advisor bases,
native animation poses, Proceed/Repeat, help Exit, Mercenary confirmation strips,
all three house previews and cursor ownership are covered. The static body,
hair and wall checks compare against independently loaded full painted bases,
outside all animated patch, media and control rectangles. A partial painted face
on a native body fails those checks even when the media preview is correct.

The initial browser run passed all 34 cases with zero RGBA differences in those
static regions. It also matched native FARTR, FHARK and FORDOS frames0,15,29 in
the Mercenary scene. The current generator adds a 35th case with stale Harkonnen
actor commands on an Atreides source base. Its whole-base recognition must remain
Atreides and no mismatched SHP patch may be painted. An unknown-base safety case
likewise forbids isolated painted actor fragments. Browser result JSON records
the precise source hashes, diagnostic scene, per-region differences and errors.

## Credit counter review

```sh
python3 fidelity/painted-polish/credits-canvas-review.py --output dist/credits-qa.html
```

This independent page stamps source credit background 12 and digit SHPs into the
six native fixed slots, including actual old/incoming glyphs and every rolling
offset −7..7. It covers HUD and CHOAM with 162 cases: background only, 0, 341,
65535, six-digit stress 999999, five carries, and partial source clipping. Its expected
slot geometry and safe field are literal independent values; it does not import
the production credit-layout helper. Every changed pixel is checked across the
complete Canvas. Digits, outlines and retained native ink may not escape
`[258,4,48,9]` or affect the right bevel at x306 and beyond.

The first full Canvas run exposed a HUD-only failure that helper geometry tests
had missed: the approved HUD atlas has alpha 249..253 over the source counter.
Old native glyphs at the wider native slot positions remained faintly visible
under the paint, including pixels beyond x306. CHOAM passed because its separate
counter inset was opaque. The runtime now restores the clean SCREEN.CPS
`[256,4,64,9]` underlay before drawing the painted HUD. Its opaque source pixels
are converted with the current palette and cached by their five actual palette
entries, preserving palette fades. The digit layout, approved atlas and strict
comparison limits are unchanged.

Syntax checks and all 13 relevant credits, interface and scene unit tests pass.
The strict browser rerun after the underlay correction is recorded separately
with the browser evidence; this document does not substitute unit-test results
for a complete Canvas result.
