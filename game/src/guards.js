// Guard patrols, vision cones and the detection system for Shadow Vault.
// A guard patrols waypoints, watches a cone of sight, and moves through
// four states: patrolling, suspicious, chasing, and investigating a noise.

import { TILE, clamp, distance, angleTo, angleDifference, insideVisionCone } from './utils.js';

export const CONE_RANGE = 175;
export const CONE_HALF_ANGLE = Math.PI / 5.2; // ~35 degrees
export const PATROL_SPEED = 55;
export const CHASE_SPEED = 102;
export const INVESTIGATE_SPEED = 76;
export const DETECTION_MAX = 100;
export const SUSPICIOUS_AT = 35;

/**
 * One guard. `world` is the object the game passes each update:
 * { level, player, alarm, time }.
 */
export class Guard {
  constructor(def, level) {
    this.waypoints = def.path.map(([c, r]) => level.tileCenter(c, r));
    this.speed = def.speed || PATROL_SPEED;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.waypointIndex = 1 % this.waypoints.length;
    this.facing = 0;
    this.state = 'patrol'; // patrol | suspicious | chase | investigate | return
    this.detection = 0;
    this.pauseTimer = 0;
    this.loseSightTimer = 0;
    this.investigateTarget = null;
    this.investigateTimer = 0;
    this.lastSeen = null;
    this.returnTarget = null;
  }

  /** Distance to the player right now. */
  distanceToPlayer(player) {
    return distance(this.x, this.y, player.x, player.y);
  }

  /** True when the player stands inside this guard's cone with sight. */
  canSeePlayer(level, player) {
    return insideVisionCone(
      level, player.x, player.y, this.x, this.y,
      this.facing, CONE_HALF_ANGLE, CONE_RANGE,
    );
  }

  /** Move toward a point at a speed, stopping within 2px. Returns true on arrival. */
  moveToward(tx, ty, speed, dt) {
    const d = distance(this.x, this.y, tx, ty);
    if (d <= 2) return true;
    const step = Math.min(d, speed * dt);
    this.facing = angleTo(this.x, this.y, tx, ty);
    this.x += ((tx - this.x) / d) * step;
    this.y += ((ty - this.y) / d) * step;
    return step >= d;
  }

  /** Step one guard forward by dt seconds. */
  update(dt, world) {
    const { level, player } = world;
    const seesPlayer = this.canSeePlayer(level, player);
    if (seesPlayer) {
      this.lastSeen = { x: player.x, y: player.y };
      this.loseSightTimer = 0;
      const d = this.distanceToPlayer(player);
      let rate = 70 * (1.25 - d / CONE_RANGE);
      if (player.sneaking) rate *= 0.5;
      if (level.isShadowAtPixel(player.x, player.y)) rate *= 0.45;
      if (d < 40) rate *= 1.4;
      this.detection = clamp(this.detection + rate * dt, 0, DETECTION_MAX);
      this.facing = angleTo(this.x, this.y, player.x, player.y);
    } else {
      this.detection = clamp(this.detection - 30 * dt, 0, DETECTION_MAX);
    }

    if (this.detection >= DETECTION_MAX && this.state !== 'chase') {
      this.state = 'chase';
      world.raiseAlarm(this);
    }
    if (this.state === 'chase' && !seesPlayer) {
      this.loseSightTimer += dt;
      if (this.loseSightTimer > 4) {
        this.state = 'return';
        this.detection = 30;
      }
    }
    if (this.detection >= SUSPICIOUS_AT && this.state === 'patrol') {
      this.state = 'suspicious';
    }
    if (this.state === 'suspicious' && this.detection < SUSPICIOUS_AT) {
      this.state = 'patrol';
    }

    switch (this.state) {
      case 'patrol': {
        if (this.pauseTimer > 0) {
          this.pauseTimer -= dt;
          break;
        }
        const target = this.waypoints[this.waypointIndex];
        if (this.moveToward(target.x, target.y, this.speed, dt)) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
          this.pauseTimer = 0.7;
        }
        break;
      }
      case 'suspicious': {
        // Freeze and stare at the last seen spot: a near miss.
        if (this.lastSeen) this.facing = angleTo(this.x, this.y, this.lastSeen.x, this.lastSeen.y);
        break;
      }
      case 'chase': {
        const target = this.lastSeen || { x: player.x, y: player.y };
        this.moveToward(target.x, target.y, CHASE_SPEED, dt);
        break;
      }
      case 'investigate': {
        if (this.investigateTarget) {
          const arrived = this.moveToward(
            this.investigateTarget.x, this.investigateTarget.y,
            INVESTIGATE_SPEED, dt,
          );
          if (arrived) {
            this.investigateTimer -= dt;
            this.facing += dt * 1.8; // look around the spot
            if (this.investigateTimer <= 0) this.state = 'return';
          }
        } else {
          this.state = 'return';
        }
        break;
      }
      case 'return': {
        if (!this.returnTarget) {
          let best = Infinity;
          let bestPoint = this.waypoints[0];
          for (const w of this.waypoints) {
            const d = distance(this.x, this.y, w.x, w.y);
            if (d < best) { best = d; bestPoint = w; }
          }
          this.returnTarget = bestPoint;
          this.waypointIndex = this.waypoints.indexOf(bestPoint);
        }
        if (this.moveToward(this.returnTarget.x, this.returnTarget.y, this.speed, dt)) {
          this.returnTarget = null;
          this.state = 'patrol';
        }
        break;
      }
      default:
        break;
    }
  }

  /** Send this guard to check out a noise (a thrown coin). */
  hearNoise(x, y) {
    if (this.state === 'chase') return;
    this.state = 'investigate';
    this.investigateTarget = { x, y };
    this.investigateTimer = 3.5;
    this.returnTarget = null;
  }

  /** Cone colour for the renderer, by state. */
  coneColor() {
    if (this.state === 'chase') return 'rgba(255, 64, 64, 0.30)';
    if (this.state === 'suspicious' || this.state === 'investigate') return 'rgba(255, 170, 40, 0.26)';
    return 'rgba(255, 230, 110, 0.20)';
  }

  /** Body colour for the renderer, by state. */
  bodyColor() {
    if (this.state === 'chase') return '#ff5252';
    if (this.state === 'suspicious' || this.state === 'investigate') return '#ffb02e';
    return '#e8e8e8';
  }
}

/** Build the guards of a level from its definitions. */
export function buildGuards(level) {
  return level.guardDefs.map((def) => new Guard(def, level));
}

/**
 * The highest detection meter across guards: the HUD's single number.
 */
export function maxDetection(guards) {
  let max = 0;
  for (const g of guards) max = Math.max(max, g.detection);
  return max;
}

/** True when any guard is chasing the player. */
export function anyChasing(guards) {
  return guards.some((g) => g.state === 'chase');
}

/** True when any guard stands close enough to catch the player. */
export function anyGuardTouching(guards, player, radius = 20) {
  return guards.some((g) => distance(g.x, g.y, player.x, player.y) < radius);
}
