export const VIEW_WIDTH = 1040;
export const VIEW_HEIGHT = 600;

const CELL = 24, OX = 40, OY = 68;
const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const hash = (x, y) => ((Math.imul(x + 41, 73856093) ^ Math.imul(y + 73, 19349663)) >>> 0) / 4294967295;

function rounded(ctx, x, y, width, height, radius, fill, stroke, lineWidth = 1.5) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth = 1.5, rotation = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function gradient(ctx, x, y, bottom, topColor, bottomColor) {
  const fill = ctx.createLinearGradient(x, y, x, bottom);
  fill.addColorStop(0, topColor); fill.addColorStop(1, bottomColor);
  return fill;
}

function line(ctx, points, color, width = 1.5) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function star(ctx, x, y, radius, color, inner = .4) {
  ctx.beginPath();
  for (let n = 0; n < 8; n++) {
    const a = n * Math.PI / 4 - Math.PI / 2;
    const r = n % 2 ? radius * inner : radius;
    if (!n) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function glow(ctx, x, y, radius, color) {
  const fill = ctx.createRadialGradient(x, y, 0, x, y, radius);
  fill.addColorStop(0, color); fill.addColorStop(1, 'transparent');
  ctx.fillStyle = fill; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function position(entity, blend, reducedMotion) {
  const t = reducedMotion ? 1 : clamp(blend);
  return {
    x: OX + ((entity.prevX ?? entity.x) + (entity.x - (entity.prevX ?? entity.x)) * t) * CELL,
    y: OY + ((entity.prevY ?? entity.y) + (entity.y - (entity.prevY ?? entity.y)) * t) * CELL,
  };
}

function background(ctx) {
  ctx.fillStyle = gradient(ctx, 0, 0, VIEW_HEIGHT, '#fbf6e9', '#e2eee3');
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ellipse(ctx, 520, 579, 465, 13, '#406d5320');
  rounded(ctx, 28, 33, 984, 551, 22, '#f5f0df', '#91b39e', 2);
  rounded(ctx, 33, 38, 974, 541, 18, '#dcebdc');

  ctx.save();
  ctx.beginPath(); ctx.roundRect(40, 44, 960, 528, 10); ctx.clip();
  ctx.fillStyle = gradient(ctx, 0, 44, 572, '#f7f6e8', '#d6e9d9');
  ctx.fillRect(40, 44, 960, 528);
  ellipse(ctx, 870, 117, 66, 66, '#fff9db9c');
  ctx.beginPath(); ctx.moveTo(40, 365);
  ctx.bezierCurveTo(180, 256, 293, 300, 434, 355);
  ctx.bezierCurveTo(642, 235, 805, 284, 1000, 345);
  ctx.lineTo(1000, 572); ctx.lineTo(40, 572); ctx.closePath();
  ctx.fillStyle = '#c2decd80'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(40, 457);
  ctx.bezierCurveTo(233, 383, 354, 436, 519, 454);
  ctx.bezierCurveTo(718, 344, 836, 371, 1000, 431);
  ctx.lineTo(1000, 572); ctx.lineTo(40, 572); ctx.closePath();
  ctx.fillStyle = '#b9d7c16b'; ctx.fill();
  ctx.restore();
}

function drawStone(ctx, x, y, seed, grass = false) {
  const tone = Math.floor(seed * 10);
  rounded(ctx, x + .7, y + 1, CELL - 1.4, CELL - 1.5, 3.2,
    `rgb(${139 + tone},${157 + tone},${145 + tone})`, '#657e7166', 1);
  line(ctx, [[x + 4, y + 4], [x + 19, y + 4]], '#e2e9d3b0', 1.7);
  line(ctx, [[x + 4, y + 21], [x + 19, y + 21]], '#667f7170', 1.4);
  if (seed > .68) line(ctx, [[x + 13, y + 10], [x + 16, y + 13], [x + 15, y + 16]], '#708b7d80', 1.1);
  else if (seed < .25) ellipse(ctx, x + 7, y + 14, 2.1, 1.2, '#bac9ae88');
  if (!grass) return;
  rounded(ctx, x + 1, y + 1, CELL - 2, 4.5, 2.2, '#7ba880');
  line(ctx, [[x + 5, y + 2], [x + 8, y - 1], [x + 10, y + 2]], '#729f6d', 1.5);
  if (seed > .72) {
    line(ctx, [[x + 16, y + 1], [x + 17, y - 4]], '#638c62', 1.2);
    ellipse(ctx, x + 17, y - 5, 2.7, 2.5, seed > .86 ? '#f2ce79' : '#f0e9d6');
    ellipse(ctx, x + 17, y - 5, .8, .8, '#c59e56');
  }
}

function drawBricks(ctx, engine) {
  const solid = (x, y) => typeof engine.isBrick === 'function' ? engine.isBrick(x, y)
    : x < 0 || x >= 40 || y < 0 || y >= 20 || engine.brickMasks[Math.floor(y / 2)][x] === '1';
  for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) {
    if (solid(x, y)) drawStone(ctx, OX + x * CELL, OY + y * CELL, hash(x, y), y > 0 && !solid(x, y - 1));
  }
  for (let x = 0; x < 40; x++) {
    drawStone(ctx, OX + x * CELL, OY - CELL, hash(x, -1), true);
    drawStone(ctx, OX + x * CELL, OY + 20 * CELL, hash(x, 20));
  }
}

function drawNest(ctx, goal, now, reducedMotion) {
  const x = OX + (goal.x + 1) * CELL, y = OY + goal.y * CELL;
  const wave = reducedMotion ? 0 : Math.sin(now / 700) * .12;
  glow(ctx, x, y - 11, 47, `rgba(71,181,155,${.22 + wave * .25})`);
  ellipse(ctx, x, y + 9, 25, 7, '#447b6633');
  ctx.beginPath(); ctx.moveTo(x - 23, y - 2);
  ctx.quadraticCurveTo(x - 19, y + 18, x, y + 19);
  ctx.quadraticCurveTo(x + 19, y + 18, x + 23, y - 2);
  ctx.closePath(); ctx.fillStyle = '#69a18e'; ctx.fill();
  ctx.strokeStyle = '#3c7d6d'; ctx.lineWidth = 2; ctx.stroke();
  ellipse(ctx, x, y - 2, 23, 7, '#a9d4b8', '#417c68', 2);
  ellipse(ctx, x, y - 2, 17, 3.7, '#e9e8b6');
  line(ctx, [[x - 17, y + 7], [x - 1, y + 11], [x + 16, y + 6]], '#c6dfb3', 1.5);
  line(ctx, [[x - 12, y + 12], [x + 7, y + 15], [x + 15, y + 11]], '#c6dfb3', 1.3);
  const sparkle = reducedMotion ? 1 : .8 + Math.sin(now / 430) * .2;
  star(ctx, x - 29, y - 15, 4 * sparkle, '#48a993');
  star(ctx, x + 31, y - 24, 3 * sparkle, '#7fbb9a');
}

function drawEgg(ctx, entity, blend, reducedMotion) {
  const p = position(entity, blend, reducedMotion), x = p.x + 24, y = p.y + 24;
  ellipse(ctx, x, p.y + 45, 17, 3.5, '#416b5430');
  ctx.beginPath(); ctx.moveTo(x, y - 22);
  ctx.bezierCurveTo(x - 13, y - 22, x - 22, y + 2, x - 19, y + 12);
  ctx.bezierCurveTo(x - 15, y + 28, x + 15, y + 28, x + 19, y + 12);
  ctx.bezierCurveTo(x + 22, y + 2, x + 13, y - 22, x, y - 22);
  ctx.closePath();
  ctx.fillStyle = gradient(ctx, x, y - 22, y + 24, '#fffefa', '#e4eee3'); ctx.fill();
  ctx.strokeStyle = '#418d80'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y - 14); ctx.quadraticCurveTo(x - 13, y - 7, x - 13, y + 2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke();
  ellipse(ctx, x + 8, y + 15, 6, 2, '#c2ddce77', null, 0, -.25);
}

function drawRock(ctx, entity, blend, now, reducedMotion) {
  const p = position(entity, blend, reducedMotion), x = p.x + 24, y = p.y + 24;
  ellipse(ctx, x, p.y + 45, 19, 3.7, '#49674c30');
  if (entity.breaking) glow(ctx, x, y, 33, '#8ed6b75c');
  ctx.beginPath(); ctx.moveTo(x - 11, y - 21);
  ctx.quadraticCurveTo(x + 3, y - 25, x + 15, y - 16);
  ctx.quadraticCurveTo(x + 24, y - 6, x + 20, y + 13);
  ctx.quadraticCurveTo(x + 15, y + 24, x - 6, y + 22);
  ctx.quadraticCurveTo(x - 23, y + 21, x - 22, y + 3);
  ctx.quadraticCurveTo(x - 22, y - 13, x - 11, y - 21);
  ctx.closePath(); ctx.fillStyle = gradient(ctx, x, y - 22, y + 23, '#d3c7a5', '#b3ad90'); ctx.fill();
  ctx.strokeStyle = '#7b816c'; ctx.lineWidth = 2; ctx.stroke();
  line(ctx, [[x - 13, y - 10], [x - 2, y - 15], [x + 10, y - 10]], '#eee3c19c', 2.4);
  line(ctx, [[x - 3, y - 12], [x - 6, y], [x + 2, y + 8], [x, y + 17]], entity.breaking ? '#e4ffdc' : '#8b937b', entity.breaking ? 2.8 : 1.5);
  line(ctx, [[x - 6, y], [x - 14, y + 5]], entity.breaking ? '#e4ffdc' : '#969b83', 1.5);
  if (entity.breaking) {
    const drift = reducedMotion ? 0 : Math.sin(now / 100) * 2;
    star(ctx, x + 23, y - 17 + drift, 4, '#bbd9a9');
    star(ctx, x - 25, y + 11 - drift, 3, '#d5d7ac');
  }
}

function drawChick(ctx, player, blend, now, reducedMotion, bumped) {
  const p = position(player, blend, reducedMotion), x = p.x + 24, y = p.y + 24;
  const moving = player.x !== player.prevX || player.y !== player.prevY;
  const bob = moving && !reducedMotion ? Math.sin(now / 90) * 1.1 : 0;
  ellipse(ctx, x, p.y + 46, 17, 3, '#4a765434');
  ctx.save(); ctx.translate(x, y + bob);
  if (player.dir === 'left') ctx.scale(-1, 1);
  rounded(ctx, -23, -2, 12, 25, 5, '#7da491', '#476f61', 1.8);
  line(ctx, [[-22, 6], [-12, 6]], '#bed0a7', 1.5);
  rounded(ctx, -19, 9, 7, 9, 2, '#b1c1a1');
  ellipse(ctx, -9, 21, 8, 3.5, '#dba567', '#aa7d4d', 1.3);
  ellipse(ctx, 11, 21, 8, 3.5, '#dba567', '#aa7d4d', 1.3);
  ellipse(ctx, 0, 3, 18, 19, gradient(ctx, 0, -12, 22, '#f5d772', '#edbd57'), '#ad8844', 2);
  ellipse(ctx, 3, -9, 17, 15, '#f7dc7d', '#ad8844', 2);
  ctx.beginPath(); ctx.moveTo(-7, -21); ctx.quadraticCurveTo(-13, -31, -3, -27);
  ctx.quadraticCurveTo(-3, -36, 3, -28); ctx.quadraticCurveTo(10, -34, 8, -22);
  ctx.fillStyle = '#f5d575'; ctx.fill(); ctx.strokeStyle = '#ad8844'; ctx.lineWidth = 1.7; ctx.stroke();
  // An explorer scarf and little satchel make the silhouette easy to follow.
  rounded(ctx, -12, 1, 28, 6, 3, '#6aa393');
  ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(-11, 17); ctx.lineTo(-3, 13); ctx.lineTo(0, 5); ctx.closePath();
  ctx.fillStyle = '#6aa393'; ctx.fill();
  ellipse(ctx, -8, 10, 7, 10, '#eab957', '#b38d48', 1.3, -.25);
  line(ctx, [[-11, 10], [-7, 13]], '#d4a248', 1.2);
  ctx.beginPath(); ctx.moveTo(17, -10); ctx.quadraticCurveTo(29, -6, 18, -2);
  ctx.closePath(); ctx.fillStyle = '#dfa263'; ctx.fill(); ctx.strokeStyle = '#b2824b'; ctx.lineWidth = 1.5; ctx.stroke();
  const gaze = player.dir === 'up' ? -2 : player.dir === 'down' ? 1 : 0;
  if (bumped) {
    ctx.beginPath(); ctx.arc(8, -9 + gaze, 3.5, .12, Math.PI - .12);
    ctx.strokeStyle = '#5b6049'; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ellipse(ctx, 9, -9 + gaze, 3, 4, '#4e5844');
    ellipse(ctx, 9.8, -10.4 + gaze, .9, 1.2, '#fffcef');
  }
  ellipse(ctx, 13, -1, 4, 2.3, '#e6a37770');
  ctx.restore();
}

function sleepy(ctx, x, y, now, reducedMotion) {
  const rise = reducedMotion ? 0 : Math.sin(now / 450) * 2;
  ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#657f79'; ctx.fillText('z', x + 20, y - 20 + rise);
  ctx.font = '600 9px system-ui, sans-serif'; ctx.fillText('z', x + 27, y - 29 + rise);
}

function eyes(ctx, left, right, y, sleeping, color) {
  if (sleeping) {
    for (const x of [left, right]) {
      ctx.beginPath(); ctx.arc(x, y - 1, 3, .2, Math.PI - .2);
      ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke();
    }
  } else {
    for (const x of [left, right]) {
      ellipse(ctx, x, y, 2.4, 3.7, color);
      ellipse(ctx, x + .6, y - 1.3, .7, 1, '#fffdf4');
    }
  }
}

function drawBlob(ctx, entity, blend, now, reducedMotion) {
  const p = position(entity, blend, reducedMotion), x = p.x + 24, y = p.y + 24;
  const bob = reducedMotion || entity.sleep > 0 ? 0 : Math.sin(now / 330 + entity.x) * 1.8;
  ellipse(ctx, x, p.y + 45, 18, 3.2, '#647a6a25');
  ctx.save(); ctx.translate(x, y + bob);
  ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(-20, -3);
  ctx.bezierCurveTo(-20, -27, 20, -27, 20, -3); ctx.lineTo(20, 12);
  ctx.quadraticCurveTo(20, 23, 11, 17); ctx.quadraticCurveTo(6, 25, 0, 18);
  ctx.quadraticCurveTo(-8, 25, -12, 17); ctx.quadraticCurveTo(-20, 23, -20, 12);
  ctx.closePath(); ctx.fillStyle = gradient(ctx, 0, -23, 23, entity.sleep > 0 ? '#ddd9e5' : '#d4c8e9', '#b8afd1'); ctx.fill();
  ctx.strokeStyle = '#827c9f'; ctx.lineWidth = 2; ctx.stroke();
  ellipse(ctx, -9, -10, 4, 7, '#f0eaf08c', null, 0, .4);
  eyes(ctx, -7, 7, -3, entity.sleep > 0, '#5e6078');
  ctx.beginPath(); ctx.arc(0, 3, 4, .25, Math.PI - .25); ctx.strokeStyle = '#827b99'; ctx.lineWidth = 1.4; ctx.stroke();
  ellipse(ctx, -13, 4, 3, 1.8, '#c79abd5e'); ellipse(ctx, 13, 4, 3, 1.8, '#c79abd5e');
  ctx.restore();
  if (entity.sleep > 0) sleepy(ctx, x, y, now, reducedMotion);
}

function drawFrog(ctx, entity, blend, now, reducedMotion) {
  const p = position(entity, blend, reducedMotion), x = p.x + 24, y = p.y + 24;
  ellipse(ctx, x, p.y + 45, 20, 3.2, '#56795727');
  ctx.save(); ctx.translate(x, y);
  const body = entity.sleep > 0 ? '#a5bd98' : '#9cbe81';
  ellipse(ctx, -16, 17, 8, 5, '#79a575', '#608b67', 1.5, -.2);
  ellipse(ctx, 16, 17, 8, 5, '#79a575', '#608b67', 1.5, .2);
  ellipse(ctx, 0, 5, 21, 17, body, '#608b67', 2);
  ellipse(ctx, -12, -10, 9, 10, body, '#608b67', 1.8);
  ellipse(ctx, 12, -10, 9, 10, body, '#608b67', 1.8);
  ellipse(ctx, 0, 10, 12, 7, '#c8d7a58c');
  eyes(ctx, -12, 12, -11, entity.sleep > 0, '#4f6b56');
  ctx.beginPath(); ctx.moveTo(-8, 5); ctx.quadraticCurveTo(0, 11, 8, 5);
  ctx.strokeStyle = '#5a825f'; ctx.lineWidth = 1.6; ctx.stroke();
  ellipse(ctx, -14, 3, 3, 1.8, '#c2a77866'); ellipse(ctx, 14, 3, 3, 1.8, '#c2a77866');
  ctx.restore();
  if (entity.sleep > 0) sleepy(ctx, x, y, now, reducedMotion);
}

function drawPod(ctx, entity, now, reducedMotion) {
  const x = OX + (entity.x + .5) * CELL, y = OY + (entity.y + .5) * CELL;
  const pulse = reducedMotion ? 0 : Math.sin(now / 550 + entity.x * .8) * .6;
  ellipse(ctx, x, y + 9, 7, 2.2, '#5f948328');
  ellipse(ctx, x, y, 8.5 + pulse, 9 + pulse, '#9ad4db', '#528fa0', 1.7);
  ellipse(ctx, x - 3, y - 4, 2, 3.3, '#eafbfa', null, 0, .4);
  star(ctx, x + 1.5, y + 1, 4, '#f7f5ca');
  ctx.beginPath(); ctx.moveTo(x - 4, y + 7); ctx.quadraticCurveTo(x - 8, y + 13, x - 1, y + 10);
  ctx.quadraticCurveTo(x + 6, y + 13, x + 5, y + 7);
  ctx.strokeStyle = '#6d9f89'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawBubble(ctx, entity, blend, reducedMotion) {
  const p = position(entity, blend, reducedMotion), x = p.x + CELL / 2, y = p.y + CELL / 2;
  for (let n = 2; n >= 1; n--) ellipse(ctx, x - entity.dx * n * 7, y - entity.dy * n * 7, 3.7 - n, 3.7 - n, '#b4dde27d');
  ellipse(ctx, x, y, 8.5, 8.5, '#c7eff0ae', '#5f9eaf', 1.8);
  ellipse(ctx, x - 2, y - 3, 2, 2.9, '#ffffffc9', null, 0, .45);
  star(ctx, x + 3, y + 2, 2.3, '#fff7ce');
}

export function renderGame(ctx, engine, {now = 0, blend = 1, reducedMotion = false, particles = []} = {}) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  background(ctx);
  if (engine) {
    drawBricks(ctx, engine);
    drawNest(ctx, engine.goal, now, reducedMotion);
    for (const pod of engine.mushrooms ?? []) if (pod.alive) drawPod(ctx, pod, now, reducedMotion);
    for (const object of engine.objects ?? []) {
      if (object.kind === 'egg') drawEgg(ctx, object, blend, reducedMotion);
      else drawRock(ctx, object, blend, now, reducedMotion);
    }
    for (const enemy of engine.enemies ?? []) if (enemy.alive) {
      if (enemy.kind === 'frog') drawFrog(ctx, enemy, blend, now, reducedMotion);
      else drawBlob(ctx, enemy, blend, now, reducedMotion);
    }
    drawChick(ctx, engine.player, blend, now, reducedMotion, engine.status === 'bumped');
    for (const shot of engine.shots ?? []) drawBubble(ctx, shot, blend, reducedMotion);
  }
  for (const particle of particles) {
    const life = clamp(particle.life);
    if (!life) continue;
    ctx.globalAlpha = life;
    star(ctx, particle.x, particle.y, Math.max(1, (particle.size ?? 4) * life), particle.color ?? '#f2d178');
  }
  ctx.restore();
}
