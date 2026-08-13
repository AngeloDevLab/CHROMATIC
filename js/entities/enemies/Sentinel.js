import { Enemy } from '../Enemy.js';

/**
 * 05_enemies-bosses.md 6.5. 35 HP, the tankiest in the roster. Contact
 * damage unified (matches every other enemy type).
 */
const SENTINEL_HP = 35;
const SENTINEL_CONTACT_DAMAGE = 20;

/**
 * Sinks the sprite by its full 64px frame height while buried. The actual
 * hiding mechanism is GameState's render() drawing buried enemies before
 * the terrain layer, not this offset alone.
 */
const BURY_DEPTH_PX = 64;

/**
 * How long the rise takes once triggered, visible in front of the terrain
 * the whole time (see `buried`/`dormant` split below). First-guess, needs playtesting.
 */
const DEFAULT_RISE_DURATION_SECONDS = 0.6;

/**
 * Simple radius check (not a rectangular tolerance like Charger's).
 */
const DEFAULT_AGGRO_RANGE_PX = 90;

// Sentinel behavior (05_enemies-bosses.md 6.1: "Static, aggros when
// approached"). The simplest enemy in the roster - it never moves at all,
// not even after triggering.
//
// Two separate flags drive this:
// - `buried` (starts true): while true, GameState draws this before the
//   terrain layer, fully hidden behind it. Clears once aggro range triggers.
// - `dormant`: while true, Combat.js's contact damage skips it and HUD.js
//   hides its HP bar. Clears only once fully risen.
// The gap between the two makes the rise visible (drawn in front, climbing
// out of the ground) before it can actually hurt the player.
export class Sentinel extends Enemy {
    /**
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
     * @param {Player} player - Player instance to watch for aggro range.
     * @param {object} [options]
     * @param {number} [options.range=DEFAULT_AGGRO_RANGE_PX]
     * @param {number} [options.riseDuration=DEFAULT_RISE_DURATION_SECONDS]
     */
    enableTrigger(player, { range = DEFAULT_AGGRO_RANGE_PX, riseDuration = DEFAULT_RISE_DURATION_SECONDS } = {}) {
        this.player = player;
        this.aggroRange = range;
        this.riseDuration = riseDuration;
    }

    /**
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
