import { Enemy } from '../Enemy.js';

// 05_enemies-bosses.md 6.5 (Zone 1 balancing draft) - untested, so this stays
// at the GDD's own raw values rather than guessing a bump (same reasoning as
// Charger.js's CHARGE_HP).
const SENTINEL_HP = 30;
const SENTINEL_CONTACT_DAMAGE = 8;

// Fully below its own former position while buried (its whole 64px frame
// height, not a partial sink) - belt-and-suspenders in case the terrain art
// at a given spawn point isn't fully opaque there. The actual hiding
// mechanism is GameState's render() drawing buried enemies before the
// terrain layer, not this offset alone.
const BURY_DEPTH_PX = 64;
// How long the rise takes once triggered, visible in front of the terrain
// the whole time (see `buried`/`dormant` split below) - long enough to be a
// real dodge window, not just a "notice it, too late" flash. First-guess,
// needs playtesting.
const DEFAULT_RISE_DURATION_SECONDS = 0.6;
// Simple radius check (not a rectangular tolerance like Charger's) - a static
// sentry reacting to distance in every direction reads fine, no need for the
// same-floor nuance a moving charge attack needs.
const DEFAULT_AGGRO_RANGE_PX = 80;

// Sentinel behavior (05_enemies-bosses.md 6.1: "Static, aggros when
// approached"). Deliberately the simplest enemy in the roster - unlike
// Patroller/Charger it never moves at all, not even after triggering.
//
// Two separate flags drive this, not one:
// - `buried` (Enemy.js default false, starts true here): while true,
//   GameState draws this BEFORE the terrain layer, fully hidden behind it.
//   Clears the instant the aggro range triggers.
// - `dormant` (Enemy.js): while true, Combat.js's contact damage skips it and
//   HUD.js hides its HP bar. Stays true through the rise animation too,
//   clearing only once fully risen.
// The gap between the two is the point: the rise is visible (drawn in front,
// climbing out of the ground over riseDuration) well before it can actually
// hurt the player, instead of a hard cut from invisible-and-harmless straight
// to visible-and-dangerous in the same frame.
export class Sentinel extends Enemy {
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.hp = SENTINEL_HP;
        this.maxHp = SENTINEL_HP;
        this.contactDamage = SENTINEL_CONTACT_DAMAGE;

        this.player = null;
        this.aggroRange = DEFAULT_AGGRO_RANGE_PX;
        this.riseDuration = DEFAULT_RISE_DURATION_SECONDS;
        this.riseProgress = 0; // 0 = fully sunk, 1 = fully risen
        this.buried = true;
        this.dormant = true;
    }

    enableTrigger(player, { range = DEFAULT_AGGRO_RANGE_PX, riseDuration = DEFAULT_RISE_DURATION_SECONDS } = {}) {
        this.player = player;
        this.aggroRange = range;
        this.riseDuration = riseDuration;
    }

    update(dt) {
        super.update(dt);
        if (this.dead) return;

        if (this.buried) {
            if (this._playerInRange()) this.buried = false;
        } else if (this.riseProgress < 1) {
            this.riseProgress = Math.min(1, this.riseProgress + dt / this.riseDuration);
            if (this.riseProgress >= 1) this.dormant = false;
        } else {
            // Fully risen - the only "life" it shows once active, since it
            // never actually moves toward the player.
            this.facing = this.player.centerX >= this.centerX ? 1 : -1;
        }
    }

    _playerInRange() {
        if (!this.player || this.player.dead) return false;
        return Math.hypot(this.player.centerX - this.centerX, this.player.centerY - this.centerY) <= this.aggroRange;
    }

    // Only affects rendering (and visualTopY's HP-bar anchor, moot anyway
    // since HUD.js's dormant check keeps the bar hidden until the rise
    // finishes) - the actual hitbox (this.x/this.y) never moves.
    _drawY() {
        return super._drawY() + (1 - this.riseProgress) * BURY_DEPTH_PX;
    }
}
