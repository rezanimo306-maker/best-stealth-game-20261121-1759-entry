// Shared math and line-of-sight helpers for Shadow Vault.
// Pure functions only: no DOM, no canvas, so the game logic can be
// exercised from Node as well as from the browser.

export const TILE = 32;

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Euclidean distance between two points. */
export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Angle from (ax, ay) toward (bx, by), in radians. */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/**
 * Smallest absolute difference between two angles, in [0, PI].
 */
export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * True when the straight segment from (x0, y0) to (x1, y1) crosses no
 * solid tile. Samples along the ray; solid means a wall or a crate,
 * because both block a guard's sight as well as movement.
 */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dist = distance(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t);
    if (level.isSolidAtPixel(x, y)) return false;
  }
  return true;
}

/**
 * Distance from (x0, y0) along `angle` until the ray hits a solid tile,
 * capped at maxDist. Steps in small increments: cheap, exact enough for
 * drawing a clipped vision cone.
 */
export function castRay(level, x0, y0, angle, maxDist) {
  const step = 4;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let x = x0;
  let y = y0;
  for (let d = 0; d < maxDist; d += step) {
    x += dx;
    y += dy;
    if (level.isSolidAtPixel(x, y)) return d;
  }
  return maxDist;
}

/**
 * True when (px, py) lies inside a vision cone: within range, within
 * the half-angle of the facing direction, and with line of sight.
 */
export function insideVisionCone(level, px, py, ox, oy, facing, halfAngle, range) {
  const d = distance(ox, oy, px, py);
  if (d > range) return false;
  if (d < 14) return hasLineOfSight(level, ox, oy, px, py);
  const toTarget = angleTo(ox, oy, px, py);
  if (angleDifference(toTarget, facing) > halfAngle) return false;
  return hasLineOfSight(level, ox, oy, px, py);
}

/**
 * Breadth-first search over walkable tiles. Returns an array of tile
 * coordinates from start to goal (inclusive), or null when unreachable.
 * Used by the self-test to prove every shard and the exit can be reached.
 */
export function findPath(level, startCol, startRow, goalCol, goalRow) {
  const key = (c, r) => `${c},${r}`;
  const prev = new Map();
  const queue = [[startCol, startRow]];
  prev.set(key(startCol, startRow), null);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === goalCol && r === goalRow) {
      const path = [];
      let cur = [c, r];
      while (cur) {
        path.unshift(cur);
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows) continue;
      if (!level.isWalkableTile(nc, nr)) continue;
      if (prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), [c, r]);
      queue.push([nc, nr]);
    }
  }
  return null;
}
