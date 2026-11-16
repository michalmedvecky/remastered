const CANVAS_WIDTH = 1040;
const CANVAS_HEIGHT = 600;
const CELL = 24;
const BOARD = {left:40, top:68, right:1000, bottom:548};
const SWIPE_THRESHOLD = 18;
const EDGE_EPSILON = 1e-7;

const isPoint = value => value != null && Number.isFinite(value.x) && Number.isFinite(value.y);

function inside(point, left, top, right, bottom) {
  return isPoint(point)
    && point.x >= left - EDGE_EPSILON && point.x <= right + EDGE_EPSILON
    && point.y >= top - EDGE_EPSILON && point.y <= bottom + EDGE_EPSILON;
}

function direction(dx, dy) {
  // A diagonal tie consistently chooses the horizontal direction.
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * Resolve a completed pointer gesture without reading the DOM or devicePixelRatio.
 * rect is the CSS canvas box, with centered object-fit:contain content.
 * Tap endpoints must stay on the board; swipes may also use the canvas margins.
 */
export function resolveBoardGesture(start, end, rect, player) {
  if (!isPoint(start) || !isPoint(end) || !rect
    || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
    || rect.width <= 0 || rect.height <= 0) return null;

  const scale = Math.min(rect.width / CANVAS_WIDTH, rect.height / CANVAS_HEIGHT);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const contentLeft = rect.left + (rect.width - CANVAS_WIDTH * scale) / 2;
  const contentTop = rect.top + (rect.height - CANVAS_HEIGHT * scale) / 2;
  const toCanvas = point => ({x:(point.x - contentLeft) / scale, y:(point.y - contentTop) / scale});
  const from = toCanvas(start);
  const to = toCanvas(end);
  if (!inside(from, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    || !inside(to, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_THRESHOLD) return direction(dx, dy);

  if (!inside(from, BOARD.left, BOARD.top, BOARD.right, BOARD.bottom)
    || !inside(to, BOARD.left, BOARD.top, BOARD.right, BOARD.bottom)
    || !isPoint(player)) return null;
  const center = {x:BOARD.left + (player.x + 1) * CELL, y:BOARD.top + (player.y + 1) * CELL};
  if (!isPoint(center)) return null;
  const distanceX = to.x - center.x;
  const distanceY = to.y - center.y;
  if (Math.abs(distanceX) <= CELL && Math.abs(distanceY) <= CELL) return null;
  return direction(distanceX, distanceY);
}
