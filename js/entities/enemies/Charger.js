import { Enemy } from '../Enemy.js';

/**
 * 05_enemies-bosses.md 6.5 (Zone 2+ balancing draft) - distinct from the
 * base Enemy/Patroller defaults (50 HP, see Enemy.js).
 */
const CHARGE_HP = 25;

/**
 * Nudged down twice now (170 -> 140 -> 115) - first-guess, needs playtesting.
 */
const DEFAULT_CHARGE_SPEED = 115;

/**
 * How close (and how level with the charger, vertically) the player needs
 * to be to trigger a charge.
 */
const CHARGE_RANGE_PX = 190;
const CHARGE_HEIGHT_TOLERANCE_PX = 24;

/**
 * A charge travels this far and then stops, win or lose. Facing is locked
 * at the start, not re-aimed every frame.
 */
const DEFAULT_CHARGE_DISTANCE_PX = 210;

/**
 * After a charge ends (wall hit or losing the player), how long before it
 * can trigger another one.
 */
const DEFAULT_CHARGE_COOLDOWN_SECONDS = 5;

// Charger behavior (05_enemies-bosses.md 6.1: "Spots the player, rushes in").
// Patrols like the base Enemy/Patroller until the player comes within range
// on roughly the same floor, then rushes at chargeSpeed instead of
// patrolSpeed - overrides _updatePatrol() rather than duplicating it.
//
// While charging, applyAttackKnockback() (active attacks) is voided; damage
// still applies, only the stagger is skipped. Passive contact-push
// (applyKnockback()) is untouched, so running into the player still ends
// the charge, like hitting a wall does.
export class Charger extends Enemy {
    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.hp = CHARGE_HP;
        this.maxHp = CHARGE_HP;
        this.player = null;
        this.chargeSpeed = DEFAULT_CHARGE_SPEED;
        this.chargeCooldownSeconds = DEFAULT_CHARGE_COOLDOWN_SECONDS;
        this.chargeDistance = DEFAULT_CHARGE_DISTANCE_PX;
        this.charging = false;
        this.chargeCooldownTimer = 0;
        this.chargeTraveled = 0;
    }

    /**
     * @param {Player} player - Player instance to watch for range/line of sight.
     * @param {object} [options]
     * @param {number} [options.chargeSpeed=DEFAULT_CHARGE_SPEED]
     * @param {number} [options.chargeCooldownSeconds=DEFAULT_CHARGE_COOLDOWN_SECONDS]
     * @param {number} [options.chargeDistance=DEFAULT_CHARGE_DISTANCE_PX]
     */
    enableCharge(player, {
        chargeSpeed = DEFAULT_CHARGE_SPEED,
        chargeCooldownSeconds = DEFAULT_CHARGE_COOLDOWN_SECONDS,
        chargeDistance = DEFAULT_CHARGE_DISTANCE_PX,
    } = {}) {
        this.player = player;
        this.chargeSpeed = chargeSpeed;
        this.chargeCooldownSeconds = chargeCooldownSeconds;
        this.chargeDistance = chargeDistance;
    }

    /**
     * Voids attack-triggered knockback while charging; passive contact knockback still applies.
     * @param {number} vx - Knockback velocity to apply.
     */
    applyAttackKnockback(vx) {
        if (this.charging) return;
        super.applyAttackKnockback(vx);
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     */
    _updatePatrol(dt) {
        this.vy += this.gravity * dt;

        if (this.chargeCooldownTimer > 0) this.chargeCooldownTimer = Math.max(0, this.chargeCooldownTimer - dt);

        if (this.knockbackTimer > 0) {
            this._updateKnockback(dt);
        } else {
            this._updateChargeMovement(dt);
        }

        this._updateChargeAnimation();
        this.grounded = this.collision.resolve(this, dt);
    }

    /**
     * Ends any active charge when contact-damage knockback lands, same as
     * running into a wall. Leaves vx untouched (whatever applyKnockback() set it to).
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateKnockback(dt) {
        this._setCharging(false);
        this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
    }

    /**
     * Turns at a wall/ledge, starts or continues a charge once in range and off cooldown, and sets vx accordingly.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateChargeMovement(dt) {
        if (this.grounded && this._blockedAhead()) {
            this.facing *= -1;
            this._setCharging(false);
        } else if (this.grounded) {
            this._updateGroundedCharge(dt);
        }

        this.vx = (this.charging ? this.chargeSpeed : this.patrolSpeed) * this.facing;
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateGroundedCharge(dt) {
        if (!this.charging && this.chargeCooldownTimer <= 0 && this._canSeePlayer()) {
            this.facing = this.player.centerX >= this.centerX ? 1 : -1;
            this.chargeTraveled = 0;
            this._setCharging(true);
        } else if (this.charging) {
            this.chargeTraveled += this.chargeSpeed * dt;
            if (this.chargeTraveled >= this.chargeDistance) this._setCharging(false);
        }
    }

    /**
     * Starts the cooldown only on the true -> false edge, not every frame
     * charging is already false.
     * @param {boolean} value - New charging state.
     */
    _setCharging(value) {
        if (this.charging && !value) this.chargeCooldownTimer = this.chargeCooldownSeconds;
        this.charging = value;
    }

    /**
     * Swaps to the charge sprite while charging, resetting on switch so it never starts mid-frame.
     */
    _updateChargeAnimation() {
        if (!this.animations?.charge) return;

        const nextAnimation = this.charging ? 'charge' : 'running';
        if (nextAnimation !== this.currentAnimation) {
            this.currentAnimation = nextAnimation;
            this.animations[nextAnimation].reset();
        }
    }

    /**
     * @returns {boolean}
     */
    _canSeePlayer() {
        if (!this.player || this.player.dead) return false;
        const withinHeight = Math.abs(this.player.centerY - this.centerY) <= CHARGE_HEIGHT_TOLERANCE_PX;
        const withinRange = Math.abs(this.player.centerX - this.centerX) <= CHARGE_RANGE_PX;
        return withinHeight && withinRange;
    }
}
