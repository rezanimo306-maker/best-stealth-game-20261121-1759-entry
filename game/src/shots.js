// Screenshot staging and the in-browser self-test for Shadow Vault.
// URL parameters stage a deterministic scene for screenshots:
//   ?scene=cover   level 1, mid-infiltration: cones, cover, exit visible
//   ?scene=patrol  level 2, guards mid-patrol with cones sweeping
//   ?scene=alarm   level 2, alarm tripped, red cones, banner up
//   ?scene=win     the win screen after all three floors
//   ?selftest=1    run scripted logic checks, report via document.title
// None of this ships as gameplay: it only stages what the camera sees.

import { TILE, angleTo } from './utils.js';

/** Read one URL parameter, or null. */
export function urlParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/**
 * Stage a screenshot scene on a started game. Called once after the
 * first frame so positions, cones and the HUD are all settled.
 */
export function stageScene(game, scene) {
  const s = scene || 'cover';
  if (s === 'win') {
    game.state = 'win';
    game.totalTime = 274;
    game.totalAlarms = 0;
    return;
  }
  if (s === 'patrol' || s === 'alarm') game.loadLevel(1);
  else game.loadLevel(0);
  game.state = 'playing';
  const level = game.level;
  const tile = (c, r) => level.tileCenter(c, r);
  if (s === 'cover') {
    // Sneak behind the crate cluster while two cones sweep past.
    const p = tile(6, 4);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.sneaking = true;
    game.player.facing = Math.PI / 2;
    game.guards[0].x = tile(12, 5).x;
    game.guards[0].y = tile(12, 5).y;
    game.guards[0].facing = Math.PI / 2;
    game.guards[0].detection = 42;
    game.guards[0].state = 'suspicious';
    game.guards[1].x = tile(16, 15).x;
    game.guards[1].y = tile(16, 15).y;
    game.guards[1].facing = Math.PI;
    game.shardsTaken = 1;
    level.shards[0].taken = true;
  } else if (s === 'patrol') {
    const p = tile(4, 9);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.facing = 0;
    game.guards[0].x = tile(14, 4).x;
    game.guards[0].y = tile(14, 4).y;
    game.guards[0].facing = Math.PI / 2;
    game.guards[1].x = tile(18, 12).x;
    game.guards[1].y = tile(18, 12).y;
    game.guards[1].facing = -Math.PI / 2;
    game.guards[2].x = tile(25, 10).x;
    game.guards[2].y = tile(25, 10).y;
    game.guards[2].facing = Math.PI;
    game.shardsTaken = 2;
    level.shards[0].taken = true;
    level.shards[1].taken = true;
  } else if (s === 'alarm') {
    const p = tile(10, 12);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.facing = -Math.PI / 2;
    game.alarm = true;
    game.alarmTimer = 1.2;
    game.alarmsThisLevel = 1;
    game.guards[0].x = tile(12, 10).x;
    game.guards[0].y = tile(12, 10).y;
    game.guards[0].state = 'chase';
    game.guards[0].detection = 100;
    game.guards[0].lastSeen = { x: p.x, y: p.y };
    game.guards[0].facing = angleTo(game.guards[0].x, game.guards[0].y, p.x, p.y);
    game.guards[1].x = tile(20, 12).x;
    game.guards[1].y = tile(20, 12).y;
    game.guards[1].state = 'chase';
    game.guards[1].detection = 88;
    game.guards[1].lastSeen = { x: p.x, y: p.y };
    game.guards[1].facing = angleTo(game.guards[1].x, game.guards[1].y, p.x, p.y);
    game.guards[2].x = tile(25, 6).x;
    game.guards[2].y = tile(25, 6).y;
    game.guards[2].state = 'chase';
    game.guards[2].detection = 64;
    game.guards[2].lastSeen = { x: p.x, y: p.y };
    game.guards[2].facing = angleTo(game.guards[2].x, game.guards[2].y, p.x, p.y);
    game.shardsTaken = 2;
    level.shards[0].taken = true;
    level.shards[1].taken = true;
  }
  game.elapsed = 87;
  game.staged = true;
  game.frozen = true; // hold the pose: patrols must not catch the player mid-shot
}

/**
 * In-browser self-test (?selftest=1): step the live game with scripted
 * input for a few seconds and write PASS/FAIL into document.title.
 * The headless screenshot run reads the title back from the DOM dump.
 */
export function runBrowserSelfTest(game) {
  const results = [];
  const check = (name, ok) => results.push(`${name}:${ok ? 'ok' : 'FAIL'}`);
  try {
    game.loadLevel(0);
    game.state = 'playing';
    // Guards patrol: positions must change over 2 simulated seconds.
    const before = game.guards.map((g) => [g.x, g.y]);
    for (let i = 0; i < 120; i++) game.step(1 / 60, { up: false, down: false, left: false, right: false, sneak: false });
    const moved = game.guards.some((g, i) => Math.hypot(g.x - before[i][0], g.y - before[i][1]) > 5);
    check('patrol-moves', moved);
    // Player walks: holding right must move the player.
    const px = game.player.x;
    for (let i = 0; i < 60; i++) game.step(1 / 60, { up: false, down: false, left: false, right: true, sneak: false });
    check('player-walks', game.player.x > px + 20);
    // Detection rises inside a cone: teleport the player in front of a guard.
    const g0 = game.guards[0];
    g0.x = 400;
    g0.y = 200;
    g0.facing = 0;
    g0.state = 'patrol';
    g0.detection = 0;
    game.player.x = 480;
    game.player.y = 200;
    game.step(1 / 60, { up: false, down: false, left: false, right: false, sneak: false });
    check('detection-rises', g0.detection > 0);
    // Shard pickup: standing on a shard collects it.
    const shard = game.level.shards.find((s) => !s.taken);
    const c = game.level.tileCenter(shard.col, shard.row);
    game.player.x = c.x;
    game.player.y = c.y;
    game.step(1 / 60, { up: false, down: false, left: false, right: false, sneak: false });
    check('shard-pickup', shard.taken === true);
    // Coin throw: consumes a coin and sends a guard to investigate.
    const coinsBefore = game.player.coins;
    const landed = game.player.throwCoin(game.player.x + 100, game.player.y);
    check('coin-throw', landed !== null && game.player.coins === coinsBefore - 1);
    game.guards.forEach((g) => g.hearNoise(landed.x, landed.y));
    check('coin-distracts', game.guards.some((g) => g.state === 'investigate'));
    // Win path: collect every shard and stand on the exit.
    for (const s of game.level.shards) {
      const sc = game.level.tileCenter(s.col, s.row);
      game.player.x = sc.x;
      game.player.y = sc.y;
      game.step(1 / 60, { up: false, down: false, left: false, right: false, sneak: false });
    }
    const exit = game.level.exitCenter();
    game.player.x = exit.x;
    game.player.y = exit.y;
    game.step(1 / 60, { up: false, down: false, left: false, right: false, sneak: false });
    check('exit-wins', game.state === 'levelclear' || game.state === 'win');
    const failed = results.filter((r) => r.endsWith('FAIL'));
    document.title = failed.length === 0
      ? `SELFTEST PASS ${results.join(' ')}`
      : `SELFTEST FAIL ${results.join(' ')}`;
  } catch (err) {
    document.title = `SELFTEST ERROR ${String(err && err.message ? err.message : err)}`;
  }
}

export { TILE };
