# Committed camera interpolation

The pure `dist/painted-camera.mjs` module evaluates a display camera at RAF time.
It never runs the native simulation, changes clocks/RNG, predicts future game
state, blends old unit poses or mutates a native frame. Delivery packaging stays
frozen until the parent integration is reviewed.

## Native observations

- `Map_MoveDirection` in `src/map.c` changes the packed viewport by one map cell
  per axis and clamps to scenario bounds minus the15×10 visible cell extent.
  One cell is16 logical pixels.
- `GUI_Widget_Viewport_Click` in `src/gui/viewport.c` gates passive edge scrolling
  until more than10 game ticks since the previous move and more than20 since
  the cursor changed. The game timer increments at60Hz: nominal passive steps
  are at least11ticks, about183ms; the initial cursor dwell is at least21ticks.
  Click/drag scrolling bypasses those passive gates. Enhanced-mode click/drag
  handling has a separate more-than2tick throttle.
- `InGame_Numpad_Move` in `src/opendune.c` routes arrows/numpad directly to the
  same one-cell move function. Its event repetition is separate from passive
  edge scrolling, so one fixed interpolation duration cannot describe both.
- `GUI_DrawScreen` updates `g_minimapPosition` and copies/redraws the15×10
  committed viewport. The observer publishes `worldRevision`, `worldCommitTick`
  and matching tile/command arrays when the complete native viewport commits.
- `Map_IsPositionInViewport` accepts a16pixel fringe around unit centres.
  `GUI_DrawSprite` records complete geometry before widget clipping. Therefore
  current observed commands can be drawn into an extended world buffer without
  retaining poses from previous snapshots. This is observed command coverage;
  it is not a claim that unobserved offscreen unit states have been recovered.

## Geometry and timing

All module coordinates are original logical pixels. Native camera:

```
N = ((viewport &63)*16, (viewport >>6)*16)
D = current floating-point displayed camera
render translation = N − D
world input projection = physical screen point + D − N
```

The visible world rectangle remains `[0,40,240,160]`. A17×12 snapshot starts at
absolute tile `(nativeTileX−1,nativeTileY−1)`, including signed negative cells at
map edges. Its272×192 logical-pixel buffer is drawn at `(-16,24)` relative to
native screen coordinates. After the `N−D` translation, crop to the fixed visible
world rectangle. Equivalently, crop the buffer at source `(D−gridOrigin)*4`.
The one-cell border permits `D` to differ from `N` by at most16pixels per axis.
Out-of-map/unseen records remain authoritative black, never six-bit-wrapped.

`acceptNative(frame, now)` immediately starts a linear segment from the current
display position to the new committed target. The first duration defaults to
120ms; later motion measures the interval between actual camera changes,
responds immediately to acceleration and damps smaller slower/jittery periods.
Regular steps produce constant velocity. Duplicate same-camera callbacks never
restart the animation or alter the measured scrolling cadence. `sample(now)`
is an analytic evaluation, so30/60/144Hz sampling yields the same path.
There is no extrapolation beyond a committed target and no future-frame wait.

If an unexpectedly early second step exhausts the one-cell coverage, the start
position clamps to the nearest supported origin. `coverageClamped` and the
counter report this exceptional visible correction. This bound is preferable
to exposing an unsupported strip or stale objects; it does not claim that
arbitrarily accelerating input can remain continuous with only one-cell data.
Missing/invalid coverage snaps to native. A coverage shrink at an unchanged
viewport also snaps, rather than retaining an unsupported partial old view.

## Host and renderer contract

```js
const camera = createCamera({reducedMotion});
// Every native callback, before any expensive world-render throttle:
const view = camera.acceptNative(frame, performance.now());
const visible = lastPainted?.epoch === view.epoch ? lastPainted : view;
const q = cameraInputOffsetQ8(visible, view);
core._dune_hd_set_view_offset(q.x, q.y);
// Rebuild the world buffer from the latest complete revision only.

// Every requestAnimationFrame:
const view = camera.sample(now);
const q = cameraInputOffsetQ8(view);
core._dune_hd_set_view_offset(q.x, q.y);
// Compose the cached current world with view.offsetX/Y; then physical UI/cursor.
lastPainted = view;
```

On native acceptance, rebase the last PAINTED camera against the newly committed
native origin; do not substitute the analytic future display position before it
has been painted. On each RAF, publish the freshly painted position. Native
camera commits can occur between RAFs, and the native hook pins its origin at
setter time. Clear lastPainted on explicit scene/mode resets. Preference changes
keep the previous visible projection until the new snap is painted. The setter arguments are signed `D−N`
logical pixels multiplied by256. Only the native widget43 pixel-to-world picker
consumes this offset before tile division. Physical SDL coordinates, widget
hit-tests, edge-scroll bands, minimap and DOM cursor remain unchanged. The zero
offset branch preserves the original native calculation exactly.

Do not clamp projected pointer coordinates to the native viewport: a physical
click in a valid overscan strip can project to a negative native-local pixel.
`projectCameraPointer` exposes signed native-local and absolute world positions,
plus a flag for this case. It excludes HUD/minimap and the native left/bottom
scroll bands. The Q8 hook handles valid map cells beyond the current viewport;
outside64×64 map positions are rejected before packing.

Build world-only repairs, distortion, terrain, building pieces, native selection
and current object layers in the same extended camera space before the final
crop/translation. Overlay physical UI/messages/cursor afterward. Applying native
pixel repairs after shifting the world would stamp old camera-relative content
into a new display position. Never crossfade old/current command lists: that
would duplicate moving units, dead objects or newly hidden enemies.

`reset(frame,now,reason)` snaps to the provided native view, or clears when no
frame is supplied. Call it explicitly on mode switches, scene/load transitions
and known minimap/teleport actions. `cameraReset`/`cameraJump` flags or a changed
`cameraEpoch`/`worldEpoch`/`sceneEpoch` also force a snap. Inactive world, disabled
gameplay, regressing game tick/revision and jumps greater than one cell reset
immediately. A load that retains the same camera and monotonically increasing
counters cannot be inferred; an explicit reset/epoch is required. Reduced-motion
preferences snap immediately and never leave an in-flight old trajectory.

## Checks

Eleven camera tests cover constant-speed scrolling, learned cadence, sampling-rate
independence, no overshoot, reversals, coverage exhaustion/shrink, jumps,
scene/load boundaries, reduced motion, signed pointer round trips and Q8 signs.
Four additional terrain/camera tests preserve all150 centre tuples/worldUV,
negative edge origins, invalid extents and actual `terrain.draw` cache resizing
15×10→17×12→15×10. A Canvas2D call recorder exercises the real terrain renderer,
checking absolute world pattern origins and complete extended draw rectangles.
Together with the five existing terrain/source checks,20 tests pass.
