// Read-only, render-time tracking of committed native Dune camera positions.
// GPL-2.0-only. No clock, DOM, native mutation, simulation tick or prediction.
export const CAMERA_WORLD_RECT = Object.freeze([0, 40, 240, 160]);
// Native left/bottom scroll widgets overlap the viewport by two logical pixels.
export const CAMERA_WORLD_INPUT_RECT = Object.freeze([2, 40, 238, 158]);
const finite = (value, name) => { if (!Number.isFinite(value)) throw new RangeError(name + ' must be finite'); return value; };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const inside = (x, y, r) => x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];

export function nativeCameraPosition(frame, tileSize = 16) {
  if (!Number.isInteger(frame?.viewport) || frame.viewport < 0 || frame.viewport > 4095) return null;
  return {x: (frame.viewport & 63) * tileSize, y: (frame.viewport >>> 6) * tileSize};
}

/** Current-snapshot coverage, expressed as allowed DISPLAY camera origins.
 * The overscan origin is an absolute tile coordinate and can be negative at a
 * map edge. Unseen/out-of-map cells remain the snapshot's authoritative black.
 */
export function cameraCoverage(frame, {tileSize = 16, worldRect = CAMERA_WORLD_RECT} = {}) {
  const b = frame?.overscan;
  if (!b || !['x', 'y', 'width', 'height'].every(k => Number.isInteger(b[k])) || b.width <= 0 || b.height <= 0) return null;
  if (b.tiles && b.tiles.length !== b.width * b.height * 4) return null;
  const minX = b.x * tileSize, minY = b.y * tileSize;
  const maxX = minX + b.width * tileSize - worldRect[2], maxY = minY + b.height * tileSize - worldRect[3];
  return maxX >= minX && maxY >= minY ? {minX, minY, maxX, maxY} : null;
}

/**
 * Positions interpolate immediately toward the latest committed target. Regular
 * tile steps produce constant-speed movement after the measured cadence is
 * available. sample(time) evaluates an analytic segment; sampling frequency can
 * never change the trajectory. There is no extrapolation beyond native state.
 *
 * A single native step is16 logical pixels. With17x12 overscan the current
 * buffer permits at most16 pixels of lag in either axis. An unexpectedly early
 * second step may exhaust this coverage: clamp to the nearest supported origin
 * rather than draw a black strip or retain stale units. coverageClamped reports
 * that exceptional correction. Larger jumps and missing overscan snap directly.
 */
export function createCamera({
  tileSize = 16, worldRect = CAMERA_WORLD_RECT,
  initialDurationMs = 120, minDurationMs = 24, maxDurationMs = 260,
  idleResetMs = 750, maxStepTiles = 1, reducedMotion = false,
  requireOverscan = true,
} = {}) {
  for (const [k, v] of Object.entries({tileSize, initialDurationMs, minDurationMs, maxDurationMs, idleResetMs, maxStepTiles})) finite(v, k);
  if (tileSize <= 0 || minDurationMs <= 0 || maxDurationMs < minDurationMs || initialDurationMs < 0 || maxStepTiles < 0 || idleResetMs <= 0) throw new RangeError('Invalid camera configuration');
  if (!Array.isArray(worldRect) || worldRect.length !== 4 || !worldRect.every(Number.isFinite) || worldRect[2] <= 0 || worldRect[3] <= 0) throw new RangeError('Invalid camera viewport');
  let motionReduced = !!reducedMotion, state = null, cadence = null, lastMoveAt = null;
  let accepted = 0, moves = 0, clamps = 0, resets = 0, lastReset = 'initial';
  const activeFrame = f => !!f?.worldVisible && f.worldAvailable !== false && f.gameplayActive !== false;
  const epoch = f => f?.cameraEpoch ?? f?.worldEpoch ?? f?.sceneEpoch ?? null;
  const pointAt = now => {
    if (!state) return {x: 0, y: 0, moving: false};
    const fraction = state.duration > 0 ? clamp((now - state.startAt) / state.duration, 0, 1) : 1;
    return {x: state.startX + (state.nativeX - state.startX) * fraction,
      y: state.startY + (state.nativeY - state.startY) * fraction,
      moving: fraction < 1 && (state.startX !== state.nativeX || state.startY !== state.nativeY)};
  };
  function sample(now) {
    finite(now, 'sample time');
    const p = pointAt(now), n = state ?? {nativeX: 0, nativeY: 0};
    return {
      active: !!state?.active, x: p.x, y: p.y, displayX: p.x, displayY: p.y,
      nativeX: n.nativeX, nativeY: n.nativeY,
      offsetX: n.nativeX - p.x, offsetY: n.nativeY - p.y,
      inputOffsetX: p.x - n.nativeX, inputOffsetY: p.y - n.nativeY,
      inputOffsetXQ8: Math.round((p.x - n.nativeX) * 256),
      inputOffsetYQ8: Math.round((p.y - n.nativeY) * 256),
      moving: !!state?.active && p.moving, reducedMotion: motionReduced,
      viewport: state?.viewport ?? null, worldRevision: state?.revision ?? null,
      epoch: state?.epoch ?? null,
      cadenceMs: cadence ?? clamp(initialDurationMs, minDurationMs, maxDurationMs),
      durationMs: state?.duration ?? 0, coverageClamped: !!state?.coverageClamped,
      resetReason: lastReset,
    };
  }
  function install(frame, now, reason, active = activeFrame(frame)) {
    const p = nativeCameraPosition(frame, tileSize) ?? {x: 0, y: 0};
    state = {active: active && !!nativeCameraPosition(frame, tileSize), nativeX: p.x, nativeY: p.y,
      startX: p.x, startY: p.y, startAt: now, duration: 0, acceptedAt: now,
      viewport: frame?.viewport ?? null, revision: frame?.worldRevision ?? null,
      tick: frame?.gameTick ?? null, epoch: epoch(frame), coverageClamped: false};
    cadence = null; lastMoveAt = null; lastReset = reason; resets++;
    return sample(now);
  }
  function reset(frame = null, now = 0, reason = 'explicit-reset') {
    finite(now, 'reset time');
    return install(frame, now, reason);
  }
  function acceptNative(frame, now) {
    finite(now, 'native acceptance time'); accepted++;
    const target = nativeCameraPosition(frame, tileSize);
    if (!target || !activeFrame(frame)) return install(frame, now, !target ? 'invalid-native-camera' : 'inactive-world', false);
    if (!state?.active) return install(frame, now, 'world-enter');
    if (frame.cameraReset || frame.cameraJump) return install(frame, now, 'native-reset');
    if (now < state.acceptedAt) return install(frame, now, 'clock-regression');
    if (epoch(frame) !== state.epoch) return install(frame, now, 'scene-epoch');
    if (Number.isFinite(frame.gameTick) && Number.isFinite(state.tick) && frame.gameTick < state.tick) return install(frame, now, 'load-or-tick-regression');
    if (Number.isFinite(frame.worldRevision) && Number.isFinite(state.revision) && frame.worldRevision < state.revision) return install(frame, now, 'world-revision-regression');
    const dx = target.x - state.nativeX, dy = target.y - state.nativeY;
    if (Math.abs(dx) > tileSize * maxStepTiles || Math.abs(dy) > tileSize * maxStepTiles) return install(frame, now, 'camera-jump');
    const bounds = cameraCoverage(frame, {tileSize, worldRect});
    if ((requireOverscan && !bounds) || (bounds && (target.x < bounds.minX || target.x > bounds.maxX || target.y < bounds.minY || target.y > bounds.maxY))) return install(frame, now, 'missing-or-invalid-coverage');
    if (motionReduced) return install(frame, now, 'reduced-motion');
    // Native UI-only callbacks often repeat the same committed world. They must
    // not restart a segment or masquerade as a faster scrolling cadence.
    if (!dx && !dy) {
      const current = pointAt(now);
      if (bounds && (current.x < bounds.minX || current.x > bounds.maxX || current.y < bounds.minY || current.y > bounds.maxY)) return install(frame, now, 'coverage-changed');
      state.acceptedAt = now; state.revision = frame.worldRevision ?? state.revision;
      state.tick = frame.gameTick ?? state.tick;
      return sample(now);
    }
    let current = pointAt(now), coverageClamped = false;
    if (bounds) {
      const x = clamp(current.x, bounds.minX, bounds.maxX), y = clamp(current.y, bounds.minY, bounds.maxY);
      coverageClamped = x !== current.x || y !== current.y;
      current = {...current, x, y};
      if (coverageClamped) clamps++;
    }
    const interval = lastMoveAt === null ? null : now - lastMoveAt;
    if (interval !== null && interval > 0 && interval <= idleResetMs) {
      // Respond immediately to acceleration; damp small slower/jittery periods.
      cadence = cadence === null || interval < cadence ? interval : cadence + (interval - cadence) * .35;
    } else cadence = null;
    let duration = clamp(cadence ?? initialDurationMs, minDurationMs, maxDurationMs);
    if (initialDurationMs === 0 && cadence === null) duration = 0;
    state = {active: true, nativeX: target.x, nativeY: target.y,
      startX: current.x, startY: current.y, startAt: now, duration, acceptedAt: now,
      viewport: frame.viewport, revision: frame.worldRevision ?? null, tick: frame.gameTick ?? null,
      epoch: epoch(frame), coverageClamped};
    lastMoveAt = now; moves++;
    return sample(now);
  }
  function setReducedMotion(value, now = 0) {
    finite(now, 'reduced-motion change time'); motionReduced = !!value;
    if (state && motionReduced) {state.startX = state.nativeX; state.startY = state.nativeY; state.startAt = now; state.duration = 0; cadence = null; lastMoveAt = null; lastReset = 'reduced-motion';}
    return sample(now);
  }
  function diagnostics() {return {accepted, moves, coverageClamps: clamps, resets, lastReset, cadenceMs: cadence, reducedMotion: motionReduced};}
  return {acceptNative, sample, reset, setReducedMotion, diagnostics};
}

/** Signed floating-point projection only. Never send a clamped projection into
 * SDL: preserve physical widget/scroll hit-testing, and apply inputOffset in the
 * native VIEWPORT pixel-to-world picker after it selects the physical widget.
 */
export function projectCameraPointer(point, camera, {worldRect = CAMERA_WORLD_RECT, inputRect = CAMERA_WORLD_INPUT_RECT} = {}) {
  const x = finite(point.x, 'pointer x'), y = finite(point.y, 'pointer y');
  const projected = !!camera?.active && inside(x, y, inputRect);
  const dx = projected ? camera.inputOffsetX : 0, dy = projected ? camera.inputOffsetY : 0;
  const nativeX = x + dx, nativeY = y + dy;
  return {x: nativeX, y: nativeY, nativeX, nativeY, physicalX: x, physicalY: y,
    worldX: projected ? camera.displayX + x - worldRect[0] : null,
    worldY: projected ? camera.displayY + y - worldRect[1] : null,
    projected, requiresWorldProjection: projected && (!!dx || !!dy),
    outsideNativeViewport: projected && !inside(nativeX, nativeY, worldRect)};
}

/** Inverse for a known WORLD point; intentionally accepts negative/off-viewport
 * native coordinates so the overscan edge strip round-trips without clamping. */
export function unprojectCameraPointer(point, camera) {
  const x = finite(point.x, 'native pointer x'), y = finite(point.y, 'native pointer y');
  return {x: x + (camera?.active ? camera.offsetX : 0), y: y + (camera?.active ? camera.offsetY : 0)};
}

/** Arguments for the read-only `_dune_hd_set_view_offset(dx_q8,dy_q8)`
 * presentation input hook. Native widget hit-testing keeps physical coordinates;
 * only its world picker consumes these signed D−N offsets. */
export function cameraInputOffsetQ8(camera, nativeTarget = null) {
  if (!camera?.active || (nativeTarget && !nativeTarget.active)) return {x: 0, y: 0};
  // Between native callbacks and RAF, the pixels still show the last PAINTED D.
  // Rebase that D against the new committed N, rather than projecting against
  // the analytic camera position that will only become visible on the next RAF.
  const x = nativeTarget ? finite(camera.displayX, 'painted camera x') - finite(nativeTarget.nativeX, 'native camera x') : finite(camera.inputOffsetX, 'camera input offset x');
  const y = nativeTarget ? finite(camera.displayY, 'painted camera y') - finite(nativeTarget.nativeY, 'native camera y') : finite(camera.inputOffsetY, 'camera input offset y');
  return {x: Math.round(x * 256), y: Math.round(y * 256)};
}
