// _wasGrounded starts null, not false, so the first resolve() doesn't read as a landing.

import { Entity } from './entity.js';
import { PlayerHealth } from './player-health.js';
import { PlayerRenderer } from './player-renderer.js';
import { PlayerMovement } from './player-movement.js';
import { DoubleJumpAbility } from './double-jump-ability.js';
import { DashAbility } from './dash-ability.js';

const hitbox_width = 32;
const hitbox_height = 64;

/**
 * attack.png frame where the blade reaches full extension; the swing
 * resolves its hit exactly once, here.
 */
const attack_impact_frame = 4;

/**
 * How long a knockback push overrides normal horizontal control; without it,
 * the accel/decel movement code would immediately pull vx back.
 */
const knockback_lock_seconds = 0.15;

/** The playable character: composes health/renderer/movement sub-objects, plus attack/ability/VFX state. */
export class Player extends Entity {
    /**
     * Builds the composed sub-objects and initializes movement/attack/ability/VFX state.
     * @param {number} x - Spawn X position.
     * @param {number} y - Spawn Y position.
     * @param {object} animations - Keyed by animation name, see sprite-animation.js.
     */
    constructor(x, y, animations) {
        super(x, y, hitbox_width, hitbox_height);
        this.animations = animations;
        this.currentAnimation = 'idle';
        this.facing = 1;
        this.healthState = new PlayerHealth();
        this.renderer = new PlayerRenderer(this);
        this.movement = new PlayerMovement(this);

        this._initMovementState();
        this._initAttackState();
        this._initAbilityState();
        this._initVfxState();
    }

    /**
     * Initializes the pendingVfx mailbox and landing-edge tracking state.
     */
    _initVfxState() {
        this.pendingVfx = [];
        this._wasGrounded = null;
    }

    /** Creates the ability instances. @see unlockAbility */
    _initAbilityState() {
        this.doubleJump = new DoubleJumpAbility();
        this.dash = new DashAbility();
    }

    /** Initializes movement-mode flags and timers. @see enableAutopilot, enableFreeRun, enableControl */
    _initMovementState() {
        this.autopilot = false;
        this._autopilotSpeed = 0;
        this._autopilotBounds = null;
        this.freeRun = false;
        this.controlled = false;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.knockbackTimer = 0;
        this.afkTimer = 0;
    }

    /** Initializes attack-in-progress state. @see consumeAttackImpact */
    _initAttackState() {
        this.attacking = false;
        this._attackImpactResolved = false;
    }

    /** Current health. @returns {number} */
    get health() { return this.healthState.health; }

    /** Current max health. @returns {number} */
    get maxHealth() { return this.healthState.maxHealth; }

    /** Current shield. @returns {number} */
    get shield() { return this.healthState.shield; }

    /** Current max shield. @returns {number} */
    get maxShield() { return this.healthState.maxShield; }

    /** Whether the player has died. @returns {boolean} */
    get dead() { return this.healthState.dead; }

    /** Whether godmode is currently enabled (synced from GameState.update() via the Dev Panel toggle). @returns {boolean} */
    get godmode() { return this.healthState.godmode; }

    /** Enables or disables godmode. @param {boolean} value - Whether godmode is enabled. */
    set godmode(value) { this.healthState.godmode = value; }

    /**
     * Applies a chosen buff to PlayerHealth.
     * @param {'maxHealth'|'shieldRegen'|'maxShield'} buffId - Buff to apply.
     */
    applyBuff(buffId) {
        this.healthState.applyBuff(buffId);
    }

    /**
     * Marks an ability as permanently unlocked.
     * @param {'doubleJump'|'dash'} id - Ability to unlock.
     */
    unlockAbility(id) {
        if (id === 'doubleJump') this.doubleJump.unlocked = true;
        else if (id === 'dash') this.dash.unlocked = true;
    }

    /** Kills the player outright and starts the death animation. */
    die() {
        if (this.healthState.kill()) this._enterDeathAnimation();
    }

    /** Plays the one-shot fall animation, if one is wired for the current character. */
    _enterDeathAnimation() {
        if (this.animations.dead) {
            this.currentAnimation = 'dead';
            this.animations.dead.reset();
        }
    }

    /**
     * True once the fall animation has played out, or immediately if none is wired.
     * Gates when GameState's ghost-rise is allowed to start.
     * @returns {boolean}
     */
    get deathAnimationFinished() {
        return !this.animations.dead || this.animations.dead.finished;
    }

    /**
     * Applies damage and enters the death animation if it was fatal.
     * @param {number} amount - Damage amount.
     */
    takeDamage(amount) {
        if (this.healthState.takeDamage(amount)) this._enterDeathAnimation();
    }

    /**
     * Applies a brief knockback push (see combat.js callers).
     * @param {number} vx - Horizontal velocity to apply.
     */
    applyKnockback(vx) {
        this.vx = vx;
        this.knockbackTimer = knockback_lock_seconds;
    }

    /**
     * Spends shield to absorb damage, if enough is available.
     * @param {number} amount - Damage amount to try to absorb.
     * @returns {boolean} Whether enough shield was available (all-or-nothing; nothing is consumed on false).
     */
    consumeShield(amount) {
        return this.healthState.consumeShield(amount);
    }

    /**
     * True exactly once per swing, the instant the blade reaches full extension.
     * @returns {boolean}
     */
    consumeAttackImpact() {
        if (!this.attacking || this._attackImpactResolved) return false;
        if (this.animations.attack.currentFrame < attack_impact_frame) return false;
        this._attackImpactResolved = true;
        return true;
    }

    /**
     * Starts a scripted bounce-between-bounds run.
     * @param {number} speed - Horizontal run speed, in pixels/second.
     * @param {{minX:number, maxX:number}} bounds - X range to bounce between.
     */
    enableAutopilot(speed, bounds) {
        this.autopilot = true;
        this._autopilotSpeed = speed;
        this._autopilotBounds = bounds;
        this.vx = speed;
        this.currentAnimation = 'running';
    }

    /**
     * Starts a scripted constant-velocity run, with no gravity or collision.
     * @param {number} vx - Constant horizontal velocity.
     */
    enableFreeRun(vx) {
        this.freeRun = true;
        this.vx = vx;
        this.facing = vx >= 0 ? 1 : -1;
        this.currentAnimation = 'running';
    }

    /**
     * Real keyboard-driven movement (Run/Jump/Drop Through Platform), used by GameState.
     * @param {InputHandler} input - Input handler to read held/pressed actions from.
     * @param {Collision} collision - Level collision to resolve movement against.
     * @param {{moveSpeed?:number, jumpSpeed?:number, gravity?:number}} [options] - Optional movement tuning.
     */
    enableControl(input, collision, { moveSpeed = 150, jumpSpeed = 379, gravity = 700 } = {}) {
        this.controlled = true;
        this.input = input;
        this.collision = collision;
        this.moveSpeed = moveSpeed;
        this.jumpSpeed = jumpSpeed;
        this.gravity = gravity;
    }

    /**
     * Advances health/animation state and whichever movement mode is active.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        this.healthState.tickHitFlash(dt);

        if (this.dead) {
            this.animations.dead?.update(dt);
            return;
        }

        this.healthState.tickInvincibility(dt);
        this._updateMovementMode(dt);
        this.animations[this.currentAnimation]?.update(dt);
    }

    /**
     * Dispatches update() to whichever of autopilot/controlled/freeRun is active.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateMovementMode(dt) {
        if (this.autopilot) {
            this._updateAutopilot();
            super.update(dt);
        } else if (this.controlled) {
            this.movement.update(dt);
        } else if (this.freeRun) {
            super.update(dt);
        }
    }

    /**
     * Bounces between the fixed bounds instead of walking past them.
     */
    _updateAutopilot() {
        const { minX, maxX } = this._autopilotBounds;
        if (this.x <= minX && this.vx < 0) {
            this.x = minX;
            this.vx = this._autopilotSpeed;
            this.facing = 1;
        } else if (this.x >= maxX && this.vx > 0) {
            this.x = maxX;
            this.vx = -this._autopilotSpeed;
            this.facing = -1;
        }
    }

    /** Topmost visible pixel row, from PlayerRenderer - where damage numbers float from. @returns {number} */
    get visualTopY() { return this.renderer.visualTopY; }

    /** Vertical center of the visible sprite, from PlayerRenderer - the color-reveal/proximity anchor point. @returns {number} */
    get visualCenterY() { return this.renderer.visualCenterY; }

    /**
     * Delegates to PlayerRenderer's sprite-drawing pipeline.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this.renderer.render(ctx);
    }
}
