// The infiltrator: movement, collision, sneaking and the coin toss.

import { TILE, clamp, distance, angleTo } from './utils.js';

export const WALK_SPEED = 132;
export const SNEAK_SPEED = 66;
export const PLAYER_RADIUS = 12;
export const COIN_RANGE = 240;
export const COINS_PER_LEVEL = 3;

/**
 * The player. Movement is axis-separated so sliding along walls feels
 * right; sneaking halves speed and halves how fast guards spot you.
 */
export class Player {
  constructor(level) {
    const start = level.tileCenter(level.playerStart.col, level.playerStart.row);
    this.x = start.x;
    this.y = start.y;
    this.facing = 0;
    this.sneaking = false;
    this.moving = false;
    this.coins = COINS_PER_LEVEL;
    this.stepPhase = 0;
  }

  reset(level) {
    const start = level.tileCenter(level.playerStart.col, level.playerStart.row);
    this.x = start.x;
    this.y = start.y;
    this.facing = 0;
    this.sneaking = false;
    this.moving = false;
    this.coins = COINS_PER_LEVEL;
    this.stepPhase = 0;
  }

  /** Try to move by (dx, dy); walls and crates stop each axis. */
  tryMove(level, dx, dy) {
    const r = PLAYER_RADIUS;
    const blocked = (x, y) => {
      for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
        if (level.isSolidAtPixel(cx, cy)) return true;
      }
      return false;
    };
    if (dx !== 0 && !blocked(this.x + dx, this.y)) this.x += dx;
    if (dy !== 0 && !blocked(this.x, this.y + dy)) this.y += dy;
    this.x = clamp(this.x, TILE + r, level.width - TILE - r);
    this.y = clamp(this.y, TILE + r, level.height - TILE - r);
  }

  /**
   * Step the player by dt. `input` is { up, down, left, right, sneak }.
   * Returns true while the player is moving (for footsteps).
   */
  update(dt, input, level) {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    this.sneaking = Boolean(input.sneak);
    this.moving = mx !== 0 || my !== 0;
    if (!this.moving) return false;
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const speed = this.sneaking ? SNEAK_SPEED : WALK_SPEED;
    this.facing = angleTo(0, 0, mx, my);
    this.tryMove(level, mx * speed * dt, my * speed * dt);
    this.stepPhase += dt * (this.sneaking ? 5 : 9);
    return true;
  }

  /** Tile the player currently stands on. */
  tile() {
    return { col: Math.floor(this.x / TILE), row: Math.floor(this.y / TILE) };
  }

  /** True when the player stands in a shadow patch. */
  inShadow(level) {
    return level.isShadowAtPixel(this.x, this.y);
  }

  /**
   * Throw a coin toward (tx, ty). Returns the landing spot, or null
   * when no coins are left. The coin flies at most COIN_RANGE.
   */
  throwCoin(tx, ty) {
    if (this.coins <= 0) return null;
    this.coins -= 1;
    const d = distance(this.x, this.y, tx, ty);
    const range = Math.min(d, COIN_RANGE);
    const angle = angleTo(this.x, this.y, tx, ty);
    return {
      x: this.x + Math.cos(angle) * range,
      y: this.y + Math.sin(angle) * range,
    };
  }
}
