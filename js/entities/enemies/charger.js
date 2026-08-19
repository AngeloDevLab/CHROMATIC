import { Enemy } from '../enemy.js';

const charge_hp = 25;
const default_charge_speed = 115;
const charge_range_px = 190;
const charge_height_tolerance_px = 24;

/**
 * Facing is locked at the start of a charge, not re-aimed every frame.
 */
const default_charge_distance_px = 210;

const default_charge_cooldown_seconds = 5;

/** Enemy that patrols normally until the player is in range, then rushes at chargeSpeed. */
export class Charger extends Enemy {
    /**
     * Sets Charger's HP and default charge state.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.hp = charge_hp;
        this.maxHp = charge_hp;
        this.player = null;
        this.chargeSpeed = default_charge_speed;
        this.chargeCooldownSeconds = default_charge_cooldown_seconds;
        this.chargeDistance = default_charge_distance_px;
        this.charging = false;
        this.chargeCooldownTimer = 0;
        this.chargeTraveled = 0;
    }

    /**
     * Arms this Charger to track a player and rush it once in range.
     * @param {Player} player - Player instance to watch for range/line of sight.
     * @param {object} [options] - Optional settings.
     * @param {number} [options.chargeSpeed=default_charge_speed] - Speed while charging.
     * @param {number} [options.chargeCooldownSeconds=default_charge_cooldown_seconds] - Seconds between charges.
     * @param {number} [options.chargeDistance=default_charge_distance_px] - Max distance a charge travels.
     */
    enableCharge(player, {
        chargeSpeed = default_charge_speed,
        chargeCooldownSeconds = default_charge_cooldown_seconds,
        chargeDistance = default_charge_distance_px,
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
     * Runs one frame of gravity, knockback-or-charge movement, and animation.
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
     * Ends any active charge when contact-damage knockback lands, same as running into a wall.
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
     * Starts a charge when eligible, or advances/ends one already running.
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
     * Starts the cooldown on the true -> false edge and queues the dash VFX
     * on the false -> true edge, not every frame the value is unchanged.
     * @param {boolean} value - New charging state.
     */
    _setCharging(value) {
        if (this.charging && !value) this.chargeCooldownTimer = this.chargeCooldownSeconds;
        if (!this.charging && value) this.pendingVfx.push('dash');
        this.charging = value;
    }

    /**
     * Swaps to the charge sprite while charging, resetting on switch.
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
     * Checks whether the player is within charge range and height.
     * @returns {boolean}
     */
    _canSeePlayer() {
        if (!this.player || this.player.dead) return false;
        const withinHeight = Math.abs(this.player.centerY - this.centerY) <= charge_height_tolerance_px;
        const withinRange = Math.abs(this.player.centerX - this.centerX) <= charge_range_px;
        return withinHeight && withinRange;
    }
}
