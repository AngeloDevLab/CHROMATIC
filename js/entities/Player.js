import { Entity } from './Entity.js';
import { PlayerHealth } from './PlayerHealth.js';
import { PlayerRenderer } from './PlayerRenderer.js';
import { PlayerMovement } from './PlayerMovement.js';
import { DoubleJumpAbility } from './DoubleJumpAbility.js';
import { DashAbility } from './DashAbility.js';

const HITBOX_WIDTH = 32;
const HITBOX_HEIGHT = 64;

/**
 * attack.png frame where the blade reaches full extension; the swing
 * resolves its hit exactly once, here.
 */
const ATTACK_IMPACT_FRAME = 4;

/**
 * How long a knockback push overrides normal horizontal control; without it,
 * the accel/decel movement code would immediately pull vx back.
 */
const KNOCKBACK_LOCK_SECONDS = 0.15;

// autopilot/freeRun/controlled are mutually exclusive, set once by whichever
// enableX() the caller uses. Health/Shield/buff bookkeeping, rendering, and
// keyboard movement live on composed sub-objects; most getters below are thin delegates.
//
// pendingVfx is a per-frame VFX mailbox drained by LevelSession. `_wasGrounded`
// starts `null`, not `false`, so the first resolve() doesn't read as a landing.
export class Player extends Entity {
    /**
     * Builds the composed sub-objects and initializes movement/attack/ability/VFX state.
     * @param {number} x - Spawn X position.
     * @param {number} y - Spawn Y position.
     * @param {object} animations - Keyed by animation name, see SpriteAnimation.js.
     */
    constructor(x, y, animations) {
        super(x, y, HITBOX_WIDTH, HITBOX_HEIGHT);
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

    /** Synced from GameState.update() every frame via the Dev Panel toggle. @returns {boolean} */
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

    /** Falling out of the level (GameState's kill plane) is always fatal. */
    die() {
        if (this.healthState.kill()) this._enterDeathAnimation();
    }

    /**
     * Plays the one-shot fall animation; deathAnimationFinished gates when
     * GameState's ghost-rise is allowed to start.
     */
    _enterDeathAnimation() {
        if (this.animations.dead) {
            this.currentAnimation = 'dead';
            this.animations.dead.reset();
        }
    }

    /**
     * True once the fall animation has played out, or immediately if none is wired.
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
     * Applies a brief knockback push (see Combat.js callers).
     * @param {number} vx - Horizontal velocity to apply.
     */
    applyKnockback(vx) {
        this.vx = vx;
        this.knockbackTimer = KNOCKBACK_LOCK_SECONDS;
    }

    /**
     * Spends shield to absorb damage, if enough is available.
     * @param {number} amount - Damage amount to try to absorb.
     * @returns {boolean}
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
        if (this.animations.attack.currentFrame < ATTACK_IMPACT_FRAME) return false;
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

    /** Topmost visible pixel row. @returns {number} */
    get visualTopY() { return this.renderer.visualTopY; }

    /** Vertical center of the visible sprite. @returns {number} */
    get visualCenterY() { return this.renderer.visualCenterY; }

    /**
     * Delegates to PlayerRenderer's sprite-drawing pipeline.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this.renderer.render(ctx);
    }
}
