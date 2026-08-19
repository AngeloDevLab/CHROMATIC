// dormant clears only after buried, so the rise is visible before contact damage/the HP bar
// activate.

import { Enemy } from '../enemy.js';

/**
 * Tankiest in the roster; contact damage matches every other enemy type.
 */
const sentinel_hp = 35;
const sentinel_contact_damage = 20;

/**
 * Sinks the sprite while buried; actual hiding comes from GameState drawing
 * buried enemies before the terrain layer, not this offset alone.
 */
const bury_depth_px = 64;

const default_rise_duration_seconds = 0.6;

/**
 * Manual nudge - the sprite's auto-detected ground line lands a bit above the actual floor.
 */
const ground_offset_px = 10;

/**
 * Simple radius check (not a rectangular tolerance like Charger's).
 */
const default_aggro_range_px = 90;

/** Stationary enemy that stays buried/dormant until the player triggers its rise. */
export class Sentinel extends Enemy {
    /**
     * Sets Sentinel's HP and starts it buried/dormant.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.hp = sentinel_hp;
        this.maxHp = sentinel_hp;
        this.contactDamage = sentinel_contact_damage;
        this.player = null;
        this.aggroRange = default_aggro_range_px;
        this.riseDuration = default_rise_duration_seconds;
        this.riseProgress = 0;
        this.buried = true;
        this.dormant = true;
    }

    /**
     * Arms this Sentinel to aggro on a player within range.
     * @param {Player} player - Player instance to watch for aggro range.
     * @param {object} [options] - Optional settings.
     * @param {number} [options.range=default_aggro_range_px] - Aggro trigger range, in pixels.
     * @param {number} [options.riseDuration=default_rise_duration_seconds] - Seconds to fully rise once triggered.
     */
    enableTrigger(player, { range = default_aggro_range_px, riseDuration = default_rise_duration_seconds } = {}) {
        this.player = player;
        this.aggroRange = range;
        this.riseDuration = riseDuration;
    }

    /**
     * Rises from buried once the player is in range, then tracks facing once fully risen.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        super.update(dt);
        if (this.dead) return;

        if (this.buried) {
            if (this._playerInRange()) this.buried = false;
        } else if (this.riseProgress < 1) {
            this.riseProgress = Math.min(1, this.riseProgress + dt / this.riseDuration);
            if (this.riseProgress >= 1) this.dormant = false;
        } else {
            this.facing = this.player.centerX >= this.centerX ? 1 : -1;
        }
    }

    /**
     * Checks whether the player is within aggro radius.
     * @returns {boolean}
     */
    _playerInRange() {
        if (!this.player || this.player.dead) return false;
        return Math.hypot(this.player.centerX - this.centerX, this.player.centerY - this.centerY) <= this.aggroRange;
    }

    /**
     * Only affects rendering - the actual hitbox (this.x/this.y) never moves.
     * @returns {number}
     */
    _drawY() {
        return super._drawY() + (1 - this.riseProgress) * bury_depth_px + ground_offset_px;
    }
}
