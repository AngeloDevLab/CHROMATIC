import { Enemy } from '../Enemy.js';

/**
 * Tankiest in the roster; contact damage matches every other enemy type.
 */
const SENTINEL_HP = 35;
const SENTINEL_CONTACT_DAMAGE = 20;

/**
 * Sinks the sprite while buried; actual hiding comes from GameState drawing
 * buried enemies before the terrain layer, not this offset alone.
 */
const BURY_DEPTH_PX = 64;

const DEFAULT_RISE_DURATION_SECONDS = 0.6;

/**
 * Simple radius check (not a rectangular tolerance like Charger's).
 */
const DEFAULT_AGGRO_RANGE_PX = 90;

// Sentinel never moves, even after triggering. `buried` hides the sprite
// (GameState draws it pre-terrain); `dormant` blocks contact damage and the
// HP bar, clearing later so the rise is visible first.
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
        this.hp = SENTINEL_HP;
        this.maxHp = SENTINEL_HP;
        this.contactDamage = SENTINEL_CONTACT_DAMAGE;
        this.player = null;
        this.aggroRange = DEFAULT_AGGRO_RANGE_PX;
        this.riseDuration = DEFAULT_RISE_DURATION_SECONDS;
        this.riseProgress = 0;
        this.buried = true;
        this.dormant = true;
    }

    /**
     * Arms this Sentinel to aggro on a player within range.
     * @param {Player} player - Player instance to watch for aggro range.
     * @param {object} [options] - Optional settings.
     * @param {number} [options.range=DEFAULT_AGGRO_RANGE_PX] - Aggro trigger range, in pixels.
     * @param {number} [options.riseDuration=DEFAULT_RISE_DURATION_SECONDS] - Seconds to fully rise once triggered.
     */
    enableTrigger(player, { range = DEFAULT_AGGRO_RANGE_PX, riseDuration = DEFAULT_RISE_DURATION_SECONDS } = {}) {
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
        return super._drawY() + (1 - this.riseProgress) * BURY_DEPTH_PX;
    }
}
