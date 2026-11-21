// Shadow Vault: the game itself. Owns the loop, the state machine,
// input, the alarm, shard pickup and the level flow. Rendering lives
// in render.js, sound in audio.js, staging in shots.js.

import { buildLevel } from './levels.js';
import { buildGuards, anyChasing, anyGuardTouching } from './guards.js';
import { Player } from './player.js';
import { Renderer } from './render.js';
import { SoundFX } from './audio.js';
import { stageScene, runBrowserSelfTest, urlParam } from './shots.js';
import { distance } from './utils.js';

/** Game states: title, playing, caught, levelclear, win. */
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.sound = new SoundFX();
    this.levelIndex = 0;
    this.level = buildLevel(0);
    this.player = new Player(this.level);
    this.guards = buildGuards(this.level);
    this.coins = [];
    this.state = 'title';
    this.alarm = false;
    this.alarmTimer = 0;
    this.elapsed = 0;
    this.totalTime = 0;
    this.totalAlarms = 0;
    this.alarmsThisLevel = 0;
    this.shardsTaken = 0;
    this.time = 0;
    this.staged = false;
    this.frozen = false; // screenshots: hold the staged pose, no simulation
    this.lastTimestamp = 0;
    this.lastFootstepPhase = 0;
    this.wasSuspicious = false;
    this.input = { up: false, down: false, left: false, right: false, sneak: false };
    this.message = null;
    this.messageTimer = 0;
    this.bindInput();
  }

  /** Load a floor fresh: new level, player, guards, coins, timers. */
  loadLevel(index) {
    this.levelIndex = index;
    this.level = buildLevel(index);
    this.player = new Player(this.level);
    this.guards = buildGuards(this.level);
    this.coins = [];
    this.alarm = false;
    this.alarmTimer = 0;
    this.elapsed = 0;
    this.alarmsThisLevel = 0;
    this.shardsTaken = 0;
    this.staged = false;
    this.frozen = false;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  /** Raise the alarm once: sting, banner, and count it for the ghost run. */
  raiseAlarm(guard) {
    if (this.alarm) return;
    this.alarm = true;
    this.alarmTimer = 0;
    this.alarmsThisLevel += 1;
    this.totalAlarms += 1;
    this.sound.alarm();
    void guard;
  }

  /** Keyboard and mouse input. Click throws a coin; Enter advances screens. */
  bindInput() {
    const keyMap = {
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ShiftLeft: 'sneak', ShiftRight: 'sneak',
    };
    window.addEventListener('keydown', (event) => {
      this.sound.unlock();
      if (event.code === 'Enter') { this.advance(); return; }
      if (event.code === 'KeyM') {
        const muted = this.sound.toggleMute();
        this.flashMessage(muted ? 'Muted' : 'Sound on');
        return;
      }
      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (this.state === 'playing') this.state = 'paused';
        else if (this.state === 'paused') this.state = 'playing';
        return;
      }
      const key = keyMap[event.code];
      if (key) {
        this.input[key] = true;
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      const key = keyMap[event.code];
      if (key) this.input[key] = false;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      this.sound.unlock();
      if (this.state !== 'playing') { this.advance(); return; }
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const tx = (event.clientX - rect.left) * scaleX;
      const ty = (event.clientY - rect.top) * scaleY;
      const landed = this.player.throwCoin(tx, ty);
      if (landed) {
        this.coins.push({ x: landed.x, y: landed.y, ttl: 6 });
        this.sound.coinClink();
        for (const g of this.guards) g.hearNoise(landed.x, landed.y);
      }
    });
    window.addEventListener('blur', () => {
      this.input.up = this.input.down = this.input.left = this.input.right = false;
      this.input.sneak = false;
    });
  }

  flashMessage(text) {
    this.message = text;
    this.messageTimer = 1.5;
  }

  /** Enter/click advances: title -> play, caught -> retry, clear -> next. */
  advance() {
    if (this.state === 'title') {
      this.loadLevel(0);
      this.state = 'playing';
    } else if (this.state === 'caught') {
      this.loadLevel(this.levelIndex);
      this.state = 'playing';
    } else if (this.state === 'levelclear') {
      if (this.levelIndex + 1 >= 3) {
        this.state = 'win';
      } else {
        this.totalTime += this.elapsed;
        this.loadLevel(this.levelIndex + 1);
        this.state = 'playing';
      }
    } else if (this.state === 'win') {
      this.totalTime = 0;
      this.totalAlarms = 0;
      this.loadLevel(0);
      this.state = 'playing';
    }
  }

  /** One fixed step of simulation. Used by the loop and the self-test. */
  step(dt, input) {
    if (this.frozen) return;
    this.time += dt;
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    const activeInput = input || this.input;
    const moving = this.player.update(dt, activeInput, this.level);
    if (moving) {
      const phase = Math.floor(this.player.stepPhase);
      if (phase !== this.lastFootstepPhase) {
        this.lastFootstepPhase = phase;
        this.sound.footstep(this.player.sneaking, phase % 2 === 0);
      }
    }
    // Shard pickup.
    for (const shard of this.level.shards) {
      if (shard.taken) continue;
      const c = this.level.tileCenter(shard.col, shard.row);
      if (distance(this.player.x, this.player.y, c.x, c.y) < 22) {
        shard.taken = true;
        this.shardsTaken += 1;
        this.sound.pickup();
      }
    }
    // Guards see, chase, and lose the trail.
    const world = {
      level: this.level,
      player: this.player,
      alarm: this.alarm,
      time: this.time,
      raiseAlarm: (g) => this.raiseAlarm(g),
    };
    for (const g of this.guards) g.update(dt, world);
    // Suspicion tick when a guard first starts noticing you.
    const suspiciousNow = this.guards.some((g) => g.detection >= 35 && g.detection < 100);
    if (suspiciousNow && !this.wasSuspicious) this.sound.suspiciousTick();
    this.wasSuspicious = suspiciousNow;
    // Alarm cools down once nobody can see you.
    if (this.alarm) {
      if (!anyChasing(this.guards)) {
        this.alarmTimer += dt;
        if (this.alarmTimer > 4) {
          this.alarm = false;
          this.alarmTimer = 0;
        }
      } else {
        this.alarmTimer = 0;
      }
    }
    // Coin markers fade.
    for (const coin of this.coins) coin.ttl -= dt;
    this.coins = this.coins.filter((c) => c.ttl > 0);
    // Caught: a guard touches you.
    if (anyGuardTouching(this.guards, this.player)) {
      this.state = 'caught';
      this.sound.caught();
      return;
    }
    // Exit opens once every shard is taken; stepping on it clears the floor.
    if (this.level.shardsLeft() === 0) {
      const exit = this.level.exitCenter();
      if (distance(this.player.x, this.player.y, exit.x, exit.y) < 24) {
        this.sound.levelClear();
        if (this.levelIndex + 1 >= 3) {
          this.totalTime += this.elapsed;
          this.state = 'win';
        } else {
          this.state = 'levelclear';
        }
      }
    }
    if (this.messageTimer > 0) this.messageTimer -= dt;
  }

  /** Draw the current state. */
  draw() {
    if (this.state === 'title') this.renderer.drawTitle(this);
    else if (this.state === 'caught') this.renderer.drawCaught(this);
    else if (this.state === 'levelclear') this.renderer.drawLevelClear(this);
    else if (this.state === 'win') this.renderer.drawWin(this);
    else if (this.state === 'paused') {
      this.renderer.drawGame(this);
      this.renderer.drawPanel('PAUSED', ['Take a breath. The guards wait.'], 'Press P or Esc to resume');
    } else this.renderer.drawGame(this);
    if (this.message && this.messageTimer > 0 && this.state === 'playing') {
      const ctx = this.renderer.ctx;
      ctx.save();
      ctx.fillStyle = '#e8ecf4';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.message, this.canvas.width / 2, 52);
      ctx.restore();
    }
  }

  /** Animation loop: fixed steps, capped delta. */
  loop(timestamp) {
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000 || 0);
    this.lastTimestamp = timestamp;
    this.step(dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  start() {
    requestAnimationFrame((t) => {
      this.lastTimestamp = t;
      this.loop(t);
    });
  }
}

// Boot the game once the page loads.
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.__shadowVault = game;
  window.addEventListener('error', (event) => {
    document.title = `PAGE ERROR ${event.message}`;
  });
  const scene = urlParam('scene');
  const selftest = urlParam('selftest');
  game.start();
  if (selftest === '1') {
    // Let one frame render, then run the scripted checks.
    setTimeout(() => runBrowserSelfTest(game), 300);
  } else if (scene) {
    setTimeout(() => {
      stageScene(game, scene);
      game.draw();
      document.title = `SCENE ${scene} READY`;
    }, 300);
  }
});
