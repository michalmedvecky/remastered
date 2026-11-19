# Source-bound camera Canvas review

The local browser observed the inert `camera-canvas-review.py` fixture using
`createPaintedRenderer`, exact decoded native ICON/SHP descriptors, the original
palette/SCREEN.CPS evidence and synthetic immutable17×12 committed snapshots.
It did not launch the DOS game, WASM simulation, timers or RNG. The screenshot
and compact JSON results are retained alongside this file.

The observed run rendered91 RAF composites from30 native callbacks, rebuilding
the world only9 times for9 committed revisions. The median recorded animation
interval was16.7ms and80 samples were in motion. Independent rock-pattern probes
compared120 Canvas observations against absolute world UV: maximum channel
difference4/255, mean difference about0.273/255. Indexed source prediction had
zero mismatched pixels; renderer errors and native repair pixels were zero.

A current full Trike command at native-local x−16 was entirely clipped from the
original viewport, but its pre-clipping pose produced423 painted blue pixels in
the visible interpolated edge strip. Removing the current Tank owner left zero
painted blue pixels in its test region. This exercises current snapshot fringe
coverage and cache clearing without retaining old unit poses.

The initial cold preparation reached81.5ms. The final captured steady
preparation and composition were0.3ms, with a0.7ms last world rebuild. These are
observations of this bounded fixture on the tested browser/machine. They do not
guarantee60FPS for every mission, device, viewport, effect or cold asset load.

The helper subsequently gained an additional inter-frame input check: a native
commit must rebase the last PAINTED display position against its new native
origin, rather than expose a not-yet-painted analytic position. The pure
camera regression covers that case; the JSON explicitly distinguishes the
recorded Canvas run from the later helper extension until the browser rerun.

`dist/camera-qa.html` is temporary and must be removed after review and before
packaging/snapshot. Retain the generator and this evidence in corresponding
source. The production renderer remains owned by the parent integration.

Final rerun with last-painted projection: 90 composites /9 world refreshes, median16.7ms. Maximum signed-Q8 projection error 0.0019035301298231389 logical pixels (below1/256 pixel). It includes offsets beyond16 logical pixels between commits and the next RAF.
