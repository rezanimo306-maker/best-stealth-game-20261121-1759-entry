// Level definitions and the tile grid for Shadow Vault.
// Levels are authored as rectangles and points (no ASCII art), so every
// wall, crate and shadow patch has an exact, reviewable coordinate.

import { TILE } from './utils.js';

/**
 * A level's tile grid. Tiles are solid (wall, crate), shadow floor,
 * or open floor. Crates block movement and sight: they are the cover.
 */
export class Level {
  constructor(def) {
    this.name = def.name;
    this.subtitle = def.subtitle;
    this.cols = def.cols;
    this.rows = def.rows;
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    // 0 = floor, 1 = wall, 2 = crate, 3 = shadow floor
    this.tiles = new Uint8Array(this.cols * this.rows);
    const setRect = (x, y, w, h, value) => {
      for (let r = y; r < y + h; r++) {
        for (let c = x; c < x + w; c++) {
          if (c >= 0 && r >= 0 && c < this.cols && r < this.rows) {
            this.tiles[r * this.cols + c] = value;
          }
        }
      }
    };
    // Border walls.
    setRect(0, 0, this.cols, 1, 1);
    setRect(0, this.rows - 1, this.cols, 1, 1);
    setRect(0, 0, 1, this.rows, 1);
    setRect(this.cols - 1, 0, 1, this.rows, 1);
    for (const [x, y, w, h] of def.walls) setRect(x, y, w, h, 1);
    for (const [x, y, w, h] of def.shadows) setRect(x, y, w, h, 3);
    for (const [x, y] of def.crates) setRect(x, y, 1, 1, 2);
    this.shards = def.shards.map(([c, r]) => ({ col: c, row: r, taken: false }));
    this.exit = { col: def.exit[0], row: def.exit[1] };
    this.playerStart = { col: def.player[0], row: def.player[1] };
    this.guardDefs = def.guards;
  }

  tileAt(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return 1;
    return this.tiles[row * this.cols + col];
  }

  isSolidTile(col, row) {
    const t = this.tileAt(col, row);
    return t === 1 || t === 2;
  }

  isSolidAtPixel(x, y) {
    return this.isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  isWalkableTile(col, row) {
    return !this.isSolidTile(col, row);
  }

  isShadowTile(col, row) {
    return this.tileAt(col, row) === 3;
  }

  isShadowAtPixel(x, y) {
    return this.isShadowTile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  tileCenter(col, row) {
    return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
  }

  exitCenter() {
    return this.tileCenter(this.exit.col, this.exit.row);
  }

  shardsLeft() {
    return this.shards.filter((s) => !s.taken).length;
  }

  resetShards() {
    for (const s of this.shards) s.taken = false;
  }
}

/**
 * Three hand-designed floors. Each one forces a different route:
 * the Lobby teaches cover, the Gallery teaches timing, the Vault
 * teaches patience under overlapping patrols.
 */
export const LEVEL_DEFS = [
  {
    name: 'Level 1 — The Lobby',
    subtitle: 'Learn the patrols. Crates block sight. Shadows hide you.',
    cols: 30,
    rows: 20,
    walls: [
      [8, 2, 1, 5],
      [8, 10, 1, 6],
      [21, 2, 1, 7],
      [21, 12, 1, 5],
      [12, 9, 6, 1],
      [12, 14, 6, 1],
    ],
    crates: [
      [4, 3], [5, 3], [13, 5], [14, 5], [16, 6],
      [4, 12], [5, 12], [10, 16], [11, 16], [24, 4],
      [24, 5], [26, 12], [18, 16], [6, 7],
    ],
    shadows: [
      [2, 12, 4, 3],
      [15, 2, 5, 2],
      [24, 13, 4, 3],
    ],
    shards: [[26, 2], [14, 12], [9, 17]],
    exit: [27, 17],
    player: [2, 2],
    guards: [
      { path: [[12, 3], [12, 7], [18, 7], [18, 3]], speed: 55 },
      { path: [[5, 15], [24, 15]], speed: 60 },
    ],
  },
  {
    name: 'Level 2 — The Gallery',
    subtitle: 'Long sightlines. Cross between patrols, never through them.',
    cols: 30,
    rows: 20,
    walls: [
      [6, 2, 1, 6],
      [6, 11, 1, 6],
      [14, 4, 1, 5],
      [14, 12, 1, 5],
      [22, 2, 1, 6],
      [22, 11, 1, 6],
      [10, 9, 4, 1],
      [17, 9, 4, 1],
    ],
    crates: [
      [3, 9], [4, 9], [9, 5], [10, 5], [18, 14],
      [19, 14], [25, 9], [26, 9], [12, 16], [13, 16],
      [9, 13], [20, 5],
    ],
    shadows: [
      [2, 2, 3, 3],
      [11, 15, 4, 2],
      [25, 15, 3, 3],
      [17, 2, 4, 2],
    ],
    shards: [[27, 2], [3, 17], [15, 17]],
    exit: [27, 17],
    player: [2, 9],
    guards: [
      { path: [[10, 2], [10, 7], [18, 7], [18, 2]], speed: 62 },
      { path: [[4, 12], [26, 12]], speed: 68 },
      { path: [[25, 4], [25, 16]], speed: 58 },
    ],
  },
  {
    name: 'Level 3 — The Vault',
    subtitle: 'Overlapping cones. Wait for the gap, then move like smoke.',
    cols: 30,
    rows: 20,
    walls: [
      [7, 2, 1, 5],
      [7, 11, 1, 6],
      [15, 2, 1, 4],
      [15, 8, 1, 4],
      [15, 15, 1, 3],
      [23, 2, 1, 5],
      [23, 11, 1, 6],
      [10, 9, 5, 1],
      [18, 13, 5, 1],
    ],
    crates: [
      [3, 5], [4, 5], [11, 4], [12, 4], [19, 6],
      [20, 6], [26, 8], [26, 9], [5, 14], [11, 16],
      [12, 16], [18, 10], [25, 15], [9, 12],
    ],
    shadows: [
      [2, 15, 4, 3],
      [10, 2, 4, 2],
      [25, 2, 3, 3],
      [18, 16, 4, 2],
      [12, 12, 2, 2],
    ],
    shards: [[27, 2], [2, 17], [19, 17]],
    exit: [27, 17],
    player: [2, 2],
    guards: [
      { path: [[11, 3], [11, 7], [19, 7], [19, 3]], speed: 66 },
      { path: [[4, 10], [26, 10]], speed: 72 },
      { path: [[26, 4], [26, 16]], speed: 62 },
      { path: [[11, 14], [19, 14]], speed: 70 },
    ],
  },
];

/** Build a Level from its definition index. */
export function buildLevel(index) {
  return new Level(LEVEL_DEFS[index % LEVEL_DEFS.length]);
}
