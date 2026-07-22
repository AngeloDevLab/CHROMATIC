import { Enemy } from '../Enemy.js';

// 05_enemies-bosses.md 6.5 (Zone 2+ balancing draft) - distinct from the base
// Enemy/Patroller defaults (50 HP, tuned up from playtesting - see Enemy.js),
// no equivalent playtesting done for Charger yet so this stays at the GDD's
// own raw value instead of guessing a similar bump.
const CHARGE_HP = 25;

// Nudged down twice now (170 -> 140 -> 115) - first-guess, needs playtesting.
const DEFAULT_CHARGE_SPEED = 115;
// How close (and how level with the charger, vertically) the player needs to
// be to trigger a charge - a simple distance+height check rather than a real
// line-of-sight raycast, consistent with the rest of this codebase's 2D
// collision checks. Raised from 150 for an earlier detection/telegraph.
const CHARGE_RANGE_PX = 190;
const CHARGE_HEIGHT_TOLERANCE_PX = 24;
// A charge travels this far and then stops, win or lose - a bit more than
// CHARGE_RANGE_PX so it usually still reaches a player who hasn't moved, but
// bounded rather than an indefinite homing chase (facing is locked once at
// the start below, not re-aimed every frame) - a dodge (sidestep, jump over)
// actually ends the encounter instead of the charger endlessly re-tracking.
// Trimmed from 220 alongside the CHARGE_RANGE_PX increase above, keeping it
// just past that range rather than growing the gap between them.
const DEFAULT_CHARGE_DISTANCE_PX = 210;
// After a charge ends (wall hit or losing the player), how long before it can
// trigger another one - without this it would immediately re-charge the
// instant conditions are met again (e.g. right off a wall bounce), which
// reads as relentless rather than a readable "rush, then recover" beat.
const DEFAULT_CHARGE_COOLDOWN_SECONDS = 5;

// Charger behavior (05_enemies-bosses.md 6.1: "Spots the player, rushes in").
// Patrols exactly like the base Enemy/Patroller until the player comes within
// range on roughly the same floor, then rushes at chargeSpeed instead of
// patrolSpeed - overrides _updatePatrol() (inherited from Enemy.js) rather
// than duplicating it, reusing _blockedAhead() as-is so a charge still turns
// around at a wall/ledge instead of running through it.
export class Charger extends Enemy {
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

    // Punishing by design (05_enemies-bosses.md 6.1) to offset the Charger's
    // comparatively low HP (see CHARGE_HP above) - once a rush starts, a
    // sword/thrown-sword hit no longer cancels/staggers it (Enemy.js's
    // applyAttackKnockback, overridden here). Damage still applies as normal
    // (takeDamage is untouched, hitFlashTimer still fires), only that one
    // knockback source is voided. Deliberately doesn't touch the base
    // applyKnockback (Combat.js's contact-damage push) - actually running
    // into the player still bounces it back and ends the charge the same way
    // a wall does, instead of clipping straight through.
    applyAttackKnockback(vx) {
        if (this.charging) return;
        super.applyAttackKnockback(vx);
    }

    _updatePatrol(dt) {
        this.vy += this.gravity * dt;

        if (this.chargeCooldownTimer > 0) this.chargeCooldownTimer = Math.max(0, this.chargeCooldownTimer - dt);

        if (this.knockbackTimer > 0) {
            // Only reachable via applyKnockback (contact damage) now, never
            // applyAttackKnockback (sword/thrown-sword, voided above while
            // charging) - so a charge still ends here the moment it actually
            // connects with the player's body, same as running into a wall,
            // it just can't be staggered by being hit from a distance/side.
            this._setCharging(false);
            this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
        } else {
            if (this.grounded && this._blockedAhead()) {
                this.facing *= -1;
                this._setCharging(false);
            } else if (this.grounded) {
                // _canSeePlayer() only gates STARTING a fresh charge (cooldown
                // elapsed and the player's currently in range/level) - once
                // committed, a charge is meant to be a full-commitment "rush,
                // then recover" beat (05_enemies-bosses.md 6.1), not something
                // the player can escape by jumping over the height tolerance
                // mid-rush. Facing is locked in for the whole charge right
                // here, not re-aimed every frame - combined with the fixed
                // chargeDistance below, a charge is a straight dash at a
                // fixed target, not a homing chase that re-tracks if the
                // player dodges sideways or doubles back.
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

        this._updateChargeAnimation();
        this.grounded = this.collision.resolve(this, dt);
    }

    // Starts the cooldown exactly on the true -> false edge, not every frame
    // charging happens to be false (that would never let the timer run out).
    _setCharging(value) {
        if (this.charging && !value) this.chargeCooldownTimer = this.chargeCooldownSeconds;
        this.charging = value;
    }

    // charger-charge.png is a distinct sprite from the walking/idle one - swap
    // to it while actually charging, same reset-on-switch reasoning as
    // Player.js's _updateAnimationState so it never starts mid-frame.
    _updateChargeAnimation() {
        if (!this.animations?.charge) return;

        const nextAnimation = this.charging ? 'charge' : 'running';
        if (nextAnimation !== this.currentAnimation) {
            this.currentAnimation = nextAnimation;
            this.animations[nextAnimation].reset();
        }
    }

    _canSeePlayer() {
        if (!this.player || this.player.dead) return false;
        const withinHeight = Math.abs(this.player.centerY - this.centerY) <= CHARGE_HEIGHT_TOLERANCE_PX;
        const withinRange = Math.abs(this.player.centerX - this.centerX) <= CHARGE_RANGE_PX;
        return withinHeight && withinRange;
    }
}
