// Canvas rendering for Shadow Vault: the floor, cover, vision cones,
// the infiltrator, the guards, and every screen and HUD element.

import { TILE, castRay } from './utils.js';
import { DETECTION_MAX, CONE_HALF_ANGLE, CONE_RANGE } from './guards.js';
import { PLAYER_RADIUS } from './player.js';

/** All drawing goes through this renderer; it owns no game state. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Draw the whole playing field for one frame. */
  drawGame(game) {
    const { level, player, guards, coins, time } = game;
    const ctx = this.ctx;
    this.clear();
    this.drawFloor(level);
    this.drawExit(level, time);
    this.drawShards(level, time);
    this.drawCoins(coins, time);
    this.drawCones(level, guards);
    this.drawGuards(guards, time);
    this.drawPlayer(player, level, time);
    this.drawHud(game);
    if (game.alarm) this.drawAlarmBanner(time);
  }

  drawFloor(level) {
    const ctx = this.ctx;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        const t = level.tileAt(c, r);
        const x = c * TILE;
        const y = r * TILE;
        if (t === 1) {
          ctx.fillStyle = '#3a4152';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#4d5872';
          ctx.fillRect(x, y, TILE, 6);
          ctx.fillStyle = '#2c3242';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else if (t === 2) {
          ctx.fillStyle = '#7a5a33';
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.strokeStyle = '#5a3f22';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
        } else if (t === 3) {
          ctx.fillStyle = (c + r) % 2 === 0 ? '#141a2e' : '#121828';
          ctx.fillRect(x, y, TILE, TILE);
        } else {
          ctx.fillStyle = (c + r) % 2 === 0 ? '#232838' : '#20242f';
          ctx.fillRect(x, y, TILE, TILE);
        }
      }
    }
  }

  drawExit(level, time) {
    const ctx = this.ctx;
    const { x, y } = level.exitCenter();
    const locked = level.shardsLeft() > 0;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.save();
    ctx.globalAlpha = locked ? 0.35 + 0.2 * pulse : 0.75 + 0.25 * pulse;
    ctx.fillStyle = locked ? '#e04848' : '#37d67a';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = locked ? '#ff8080' : '#8affb0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#0b1020';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(locked ? '🔒' : 'EXIT', x, y + 0.5);
    ctx.restore();
  }

  drawShards(level, time) {
    const ctx = this.ctx;
    for (const s of level.shards) {
      if (s.taken) continue;
      const { x, y } = level.tileCenter(s.col, s.row);
      const bob = Math.sin(time * 2.5 + s.col) * 3;
      const glow = 0.55 + 0.35 * Math.sin(time * 4 + s.row);
      ctx.save();
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#37e0ff';
      ctx.beginPath();
      ctx.moveTo(x, y - 11 + bob);
      ctx.lineTo(x + 8, y + bob);
      ctx.lineTo(x, y + 11 + bob);
      ctx.lineTo(x - 8, y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d8fbff';
      ctx.beginPath();
      ctx.moveTo(x, y - 5 + bob);
      ctx.lineTo(x + 3.5, y + bob);
      ctx.lineTo(x, y + 5 + bob);
      ctx.lineTo(x - 3.5, y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawCoins(coins, time) {
    const ctx = this.ctx;
    for (const coin of coins) {
      const shimmer = 0.6 + 0.4 * Math.sin(time * 6);
      ctx.save();
      ctx.globalAlpha = shimmer;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a8842a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draw a guard's vision cone, clipped at walls and crates: one ray per
   * step across the cone, each stopping at the first solid tile. What you
   * see is what the guard can see.
   */
  drawCones(level, guards) {
    const ctx = this.ctx;
    const steps = 26;
    for (const g of guards) {
      ctx.save();
      ctx.fillStyle = g.coneColor();
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      for (let i = 0; i <= steps; i++) {
        const angle = g.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / steps;
        const dist = castRay(level, g.x, g.y, angle, CONE_RANGE);
        ctx.lineTo(g.x + Math.cos(angle) * dist, g.y + Math.sin(angle) * dist);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGuards(guards, time) {
    const ctx = this.ctx;
    for (const g of guards) {
      // Body: a watchman with a visor line in his facing direction.
      ctx.fillStyle = g.bodyColor();
      ctx.beginPath();
      ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1e2a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#1a1e2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.facing) * 15, g.y + Math.sin(g.facing) * 15);
      ctx.stroke();
      // Detection ring over a guard who is noticing you.
      if (g.detection > 2) {
        const frac = g.detection / DETECTION_MAX;
        ctx.strokeStyle = frac > 0.8 ? '#ff4040' : '#ffb02e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
      }
      if (g.state === 'chase') {
        ctx.fillStyle = '#ff4040';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', g.x, g.y - 22 + Math.sin(time * 8) * 2);
      } else if (g.state === 'suspicious' || g.state === 'investigate') {
        ctx.fillStyle = '#ffb02e';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', g.x, g.y - 22);
      }
    }
  }

  drawPlayer(player, level, time) {
    const ctx = this.ctx;
    const inShadow = player.inShadow(level);
    // Soft shadow-hint ring while hidden in darkness.
    if (inShadow) {
      ctx.strokeStyle = 'rgba(120, 170, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cloaked infiltrator: hood, face, cloak.
    ctx.fillStyle = '#7b61ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d2b8f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#efeaff';
    ctx.beginPath();
    ctx.arc(
      player.x + Math.cos(player.facing) * 4,
      player.y + Math.sin(player.facing) * 4,
      5, 0, Math.PI * 2,
    );
    ctx.fill();
    if (player.sneaking) {
      ctx.fillStyle = '#cfc4ff';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('sneak', player.x, player.y + 24);
    }
    void time;
  }

  drawHud(game) {
    const ctx = this.ctx;
    const { level, player, guards, shardsTaken, levelIndex, elapsed } = game;
    const totalShards = level.shards.length;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
    ctx.fillRect(0, 0, this.canvas.width, 30);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${level.name}`, 10, 15);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#37e0ff';
    ctx.fillText(`◆ ${shardsTaken}/${totalShards} shards`, this.canvas.width / 2 - 60, 15);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(`● ${player.coins} coins`, this.canvas.width / 2 + 60, 15);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8ecf4';
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
    ctx.fillText(`Level ${levelIndex + 1}/3   ${mins}:${secs}`, this.canvas.width - 10, 15);
    // Detection meter along the bottom.
    const detection = Math.max(0, ...guards.map((g) => g.detection));
    const barW = 320;
    const barX = (this.canvas.width - barW) / 2;
    const barY = this.canvas.height - 22;
    ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
    ctx.fillRect(barX - 34, barY - 4, barW + 68, 18);
    ctx.fillStyle = '#e8ecf4';
    ctx.textAlign = 'left';
    ctx.fillText('👁', barX - 30, barY + 5);
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(barX, barY, barW, 10);
    ctx.fillStyle = detection > 80 ? '#ff4040' : detection > 35 ? '#ffb02e' : '#37d67a';
    ctx.fillRect(barX, barY, barW * (detection / DETECTION_MAX), 10);
    ctx.restore();
  }

  drawAlarmBanner(time) {
    const ctx = this.ctx;
    const blink = 0.55 + 0.45 * Math.sin(time * 10);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ ALARM — BREAK LINE OF SIGHT ⚠', this.canvas.width / 2, 58);
    ctx.restore();
  }

  /** Full-screen text panel used by the menu and end screens. */
  drawPanel(title, lines, hint) {
    const ctx = this.ctx;
    this.clear();
    ctx.fillStyle = '#0d1120';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#7b61ff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, this.canvas.width / 2, 150);
    ctx.fillStyle = '#c9d2e8';
    ctx.font = '17px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, this.canvas.width / 2, 220 + i * 30);
    });
    if (hint) {
      ctx.fillStyle = '#8fa0c0';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(hint, this.canvas.width / 2, this.canvas.height - 90);
    }
  }

  drawTitle(game) {
    this.drawPanel('SHADOW VAULT', [
      'A top-down stealth heist in three floors.',
      'Collect all 3 shards on each floor, then reach the EXIT unseen.',
      'Guards patrol with vision cones. Crates block their sight.',
      'Shadows hide you. Shift sneaks. Click throws a coin to distract.',
      'If the alarm trips, break line of sight until it cools down.',
    ], 'Press ENTER or click to start  •  WASD / arrows to move  •  Shift to sneak  •  M to mute');
    void game;
  }

  drawCaught(game) {
    this.drawPanel('CAUGHT!', [
      `The guards caught you on ${game.level.name}.`,
      'Watch the cones. Wait for the gap. Move like smoke.',
    ], 'Press ENTER or click to try the floor again');
  }

  drawLevelClear(game) {
    const ghost = game.alarmsThisLevel === 0 ? '  •  GHOST: never spotted!' : '';
    this.drawPanel('FLOOR CLEAR', [
      `${game.level.name} complete in ${game.formatTime(game.elapsed)}.`,
      `Shards ${game.shardsTaken}/${game.level.shards.length}${ghost}`,
    ], 'Press ENTER or click for the next floor');
  }

  drawWin(game) {
    this.drawPanel('THE VAULT IS YOURS', [
      `All three floors cleared in ${game.formatTime(game.totalTime)}.`,
      game.totalAlarms === 0
        ? 'GHOST RUN: not once did an alarm sound. Flawless.'
        : `${game.totalAlarms} alarm${game.totalAlarms === 1 ? '' : 's'} tripped along the way.`,
      'Thank you for playing Shadow Vault.',
    ], 'Press ENTER or click to play again');
  }
}
