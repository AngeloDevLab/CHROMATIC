import { Enemy } from '../Enemy.js';

/**
 * 05_enemies-bosses.md 6.5 (Zone 2+ balancing draft) - distinct from the
 * base Enemy/Patroller defaults (50 HP, tuned up from playtesting - see
 * Enemy.js), no equivalent playtesting done for Charger yet so this stays
 * at the GDD's own raw value instead of guessing a similar bump.
 */
const CHARGE_HP = 25;

/**
 * Nudged down twice now (170 -> 140 -> 115) - first-guess, needs playtesting.
 */
const DEFAULT_CHARGE_SPEED = 115;

/**
 * How close (and how level with the charger, vertically) the player needs
 * to be to trigger a charge - a simple distance+height check rather than a
 * real line-of-sight raycast, consistent with the rest of this codebase's
 * 2D collision checks. Raised from 150 for an earlier detection/telegraph.
 */
const CHARGE_RANGE_PX = 190;
const CHARGE_HEIGHT_TOLERANCE_PX = 24;

/**
 * A charge travels this far and then stops, win or lose - a bit more than
 * CHARGE_RANGE_PX so it usually still reaches a player who hasn't moved,
 * but bounded rather than an indefinite homing chase (facing is locked
 * once at the start below, not re-aimed every frame) - a dodge (sidestep,
 * jump over) actually ends the encounter instead of the charger endlessly
 * re-tracking.
 */
const DEFAULT_CHARGE_DISTANCE_PX = 210;

/**
 * After a charge ends (wall hit or losing the player), how long before it
 * can trigger another one - without this it would immediately re-charge
 * the instant conditions are met again (e.g. right off a wall bounce),
 * which reads as relentless rather than a readable "rush, then recover" beat.
 */
const DEFAULT_CHARGE_COOLDOWN_SECONDS = 5;

// Charger behavior (05_enemies-bosses.md 6.1: "Spots the player, rushes in").
// Patrols exactly like the base Enemy/Patroller until the player comes within
// range on roughly the same floor, then rushes at chargeSpeed instead of
// patrolSpeed - overrides _updatePatrol() (inherited from Enemy.js) rather
// than duplicating it, reusing _blockedAhead() as-is so a charge still turns
// around at a wall/ledge instead of running through it.
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
     * Punishing by design (05_enemies-bosses.md 6.1) to offset the
     * Charger's comparatively low HP (see CHARGE_HP) - once a rush starts,
     * a sword/thrown-sword hit no longer cancels/staggers it. Damage still
     * applies as normal (takeDamage is untouched, hitFlashTimer still
     * fires), only this one knockback source is voided. Deliberately
     * doesn't touch the base applyKnockback (Combat.js's contact-damage
     * push) - actually running into the player still bounces it back and
     * ends the charge the same way a wall does, instead of clipping straight through.
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
     * Ends any active charge the instant contact damage actually connects
     * (only reachable via applyKnockback, the contact-damage push - never
     * applyAttackKnockback, voided above while charging), same as running
     * into a wall. vx is deliberately left untouched here, still whatever
     * applyKnockback() set it to.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateKnockback(dt) {
        this._setCharging(false);
        this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
    }

    /**
     * Turns at a wall/ledge, starts or continues a charge once in range and
     * off cooldown, and sets vx for whichever state applies. _canSeePlayer()
     * only gates STARTING a fresh charge - once committed, a charge is a
     * full-commitment "rush, then recover" beat (05_enemies-bosses.md 6.1),
     * facing locked in for the whole run rather than re-aimed every frame,
     * so the player can't escape mid-rush by leaving height tolerance;
     * combined with the fixed chargeDistance, it's a straight dash at a
     * fixed target, not a homing chase.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateChargeMovement(dt) {
        if (this.grounded && this._blockedAhead()) {
            this.facing *= -1;
            this._setCharging(false);
        } else if (this.grounded) {
            if (!this.charging && this.chargeCooldownTimer <= 0 && this._canSeePlayer()) {
                this.facing = this.player.centerX >= this.centerX ? 1 : -1;
                this.chargeTraveled = 0;
                this._setCharging(true);
            } else if (this.charging) {
                this.chargeTraveled += this.chargeSpeed * dt;
                if (this.chargeTraveled >= this.chargeDistance) this._setCharging(false);
            }
        }

        this.vx = (this.charging ? this.chargeSpeed : this.patrolSpeed) * this.facing;
    }

    /**
     * Starts the cooldown exactly on the true -> false edge, not every
     * frame charging happens to already be false (that would never let the
     * timer run out).
     * @param {boolean} value - New charging state.
     */
    _setCharging(value) {
        if (this.charging && !value) this.chargeCooldownTimer = this.chargeCooldownSeconds;
        this.charging = value;
    }

    /**
     * charger-charge.png is a distinct sprite from the walking/idle one -
     * swap to it while actually charging, same reset-on-switch reasoning as
     * Player.js's _updateAnimationState so it never starts mid-frame.
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
