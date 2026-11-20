// Fixed six-column presentation of the native rolling-credit counter.
// GPL-2.0-only. GUI_DrawCredits remains authoritative for values and motion.
const freezeRect = values => Object.freeze(values);
export const CREDIT_COUNTER = Object.freeze({
  columns: 6,
  nativeFirstX: 260,
  nativePitch: 10,
  nativeGlyphWidth: 8,
  nativeGlyphHeight: 8,
  // Widget4 [256,44,64,9] is copied to widget5, forty pixels higher.
  nativeClip: freezeRect([256, 4, 64, 9]),
  paintedFirstX: 258,
  paintedPitch: 8,
  // The approved HUD's dark well ends before the bevel at x308..310.
  // Reserve two logical pixels before that bevel, including glyph stroke.
  paintedClip: freezeRect([258, 4, 48, 9]),
  factoryPanel: freezeRect([255, 1, 55, 15]),
});

const sceneName = scene => String(scene?.kind ?? scene ?? '').toLowerCase();
export function isPaintedCreditScene(scene) {
  return ['hud', 'choam.cps', 'factory'].includes(sceneName(scene));
}

export function suppressNativeCreditBackground(command, scene) {
  // Source12 is84 pixels wide, clipped by a64-pixel native widget. Repainting
  // that rectangle would erase the new narrower counter frame and its rim.
  return command?.id === 12 && isPaintedCreditScene(scene);
}

export function paintedCreditPanel(scene) {
  // The factory source has a metal header behind native widget5. Give the
  // digits the same bounded painted inset instead of the old solid BG12 fill.
  return ['choam.cps', 'factory'].includes(sceneName(scene)) ? [...CREDIT_COUNTER.factoryPanel] : null;
}

function intersect(a, b) {
  const x = Math.max(a[0], b[0]), y = Math.max(a[1], b[1]);
  const right = Math.min(a[0] + a[2], b[0] + b[2]);
  const bottom = Math.min(a[1] + a[3], b[1] + b[3]);
  return right > x && bottom > y ? [x, y, right - x, bottom - y] : null;
}

/** Map source slot identity, never the number or bounds of visible digits.
 * Native y, glyph height and vertical window are retained through all carries.
 * Return null for a different source command; a clipped-out valid phase returns
 * an object with clip:null, so the caller omits it instead of using a fallback.
 */
export function creditDigitLayout(command, scene) {
  if (!isPaintedCreditScene(scene) || !Number.isInteger(command?.id) || command.id < 14 || command.id > 23) return null;
  const c = CREDIT_COUNTER;
  const column = (command.x - c.nativeFirstX) / c.nativePitch;
  if (!Number.isInteger(column) || column < 0 || column >= c.columns || command.width !== c.nativeGlyphWidth || command.height !== c.nativeGlyphHeight || !Number.isFinite(command.y)) return null;
  const x = c.paintedFirstX + column * c.paintedPitch;
  const rect = [x, command.y, c.nativeGlyphWidth, c.nativeGlyphHeight];
  const nativeClip = command.nativeClip ?? c.nativeClip;
  // Copies may preserve only part of a source glyph. Move that source window
  // with its column; never use a surviving-ink bbox to refit or position type.
  const movedClip = [nativeClip[0] + x - command.x, nativeClip[1], nativeClip[2], nativeClip[3]];
  const window = intersect(movedClip, c.paintedClip);
  return {
    column,
    label: String(command.id - 14),
    rect,
    clip: window && intersect(window, rect),
    insets: [.75, .75, .75, .75],
    sourceX: command.x,
    nativeY: command.y,
  };
}
