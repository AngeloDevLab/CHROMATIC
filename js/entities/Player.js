import { Entity } from './Entity.js';
import { PlayerHealth } from './PlayerHealth.js';
import { PlayerRenderer } from './PlayerRenderer.js';
import { PlayerMovement } from './PlayerMovement.js';
import { DoubleJumpAbility } from './DoubleJumpAbility.js';
import { DashAbility } from './DashAbility.js';

/**
 * Collision hitbox, intentionally narrower than the full render size due to
 * sprite padding (10_technical-architecture.md 11.7.2).
 */
const HITBOX_WIDTH = 32;
const HITBOX_HEIGHT = 64;

/**
 * attack.png frame where the blade reaches full extension - the swing
 * resolves its hit exactly once, here, via consumeAttackImpact() (Combat.js).
 */
const ATTACK_IMPACT_FRAME = 4;

/**
 * How long a knockback push overrides normal horizontal control; without it,
 * the accel/decel movement code would immediately pull vx back.
 */
const KNOCKBACK_LOCK_SECONDS = 0.15;

// Three mutually-exclusive movement modes, set once by whichever enableX()
// the caller uses: autopilot (menu bounce-between-bounds demo), freeRun
// (menu living-background scripted pass, no physics), controlled (real
// keyboard play, see enableControl()/PlayerMovement.js's update()).
// Health/Shield/buff bookkeeping, the sprite-drawing pipeline, and the real
// keyboard-movement logic live on composed sub-objects (PlayerHealth.js/
// PlayerRenderer.js/PlayerMovement.js); most getters below are thin
// delegates onto those.
//
// pendingVfx is a mailbox (same pattern as Wraith.js's pendingProjectile),
// drained every frame by LevelSession's _drainPlayerVfx(). _wasGrounded
// tracks the previous frame's grounded state and starts `null` rather than
// `false`, so the level's first resolve() doesn't read as a landing.
export class Player extends Entity {
    /**
     * @param {number} x
     * @param {number} y
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

    /** @see unlockAbility */
    _initAbilityState() {
        this.doubleJump = new DoubleJumpAbility();
        this.dash = new DashAbility();
    }

    /** @see enableAutopilot, enableFreeRun, enableControl */
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

    /** @see consumeAttackImpact, PlayerMovement.js's _startAttack */
    _initAttackState() {
        this.attacking = false;
        this._attackImpactResolved = false;
    }

    /** @returns {number} */
    get health() { return this.healthState.health; }

    /** @returns {number} */
    get maxHealth() { return this.healthState.maxHealth; }

    /** @returns {number} */
    get shield() { return this.healthState.shield; }

    /** @returns {number} */
    get maxShield() { return this.healthState.maxShield; }

    /** @returns {boolean} */
    get dead() { return this.healthState.dead; }

    /** Synced from GameState.update() every frame via the Dev Panel toggle. @returns {boolean} */
    get godmode() { return this.healthState.godmode; }

    /** @param {boolean} value */
    set godmode(value) { this.healthState.godmode = value; }

    /**
     * @param {'maxHealth'|'shieldRegen'|'maxShield'} buffId
     */
    applyBuff(buffId) {
        this.healthState.applyBuff(buffId);
    }

    /**
     * Called by the Merchant shop on a successful purchase, and by
     * DevPanel.js's ability buttons as a free testing shortcut. One-way (no
     * re-lock) and idempotent.
     * @param {'doubleJump'|'dash'} id
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
     * True once the fall animation has played out (or immediately if this
     * Player has no 'dead' animation wired, e.g. MenuState's decorative characters).
     * @returns {boolean}
     */
    get deathAnimationFinished() {
        return !this.animations.dead || this.animations.dead.finished;
    }

    /**
     * @param {number} amount
     */
    takeDamage(amount) {
        if (this.healthState.takeDamage(amount)) this._enterDeathAnimation();
    }

    /**
     * Applies a brief knockback push (see Combat.js callers).
     * @param {number} vx
     */
    applyKnockback(vx) {
        this.vx = vx;
        this.knockbackTimer = KNOCKBACK_LOCK_SECONDS;
    }

    /**
     * @param {number} amount
     * @returns {boolean}
     */
    consumeShield(amount) {
        return this.healthState.consumeShield(amount);
    }

    /**
     * True exactly once per swing, the instant the blade reaches full
     * extension - callers (Combat.js's resolveMeleeAttack) resolve the
     * actual hit-detection against enemies from here.
     * @returns {boolean}
     */
    consumeAttackImpact() {
        if (!this.attacking || this._attackImpactResolved) return false;
        if (this.animations.attack.currentFrame < ATTACK_IMPACT_FRAME) return false;
        this._attackImpactResolved = true;
        return true;
    }

    /**
     * @param {number} speed
     * @param {{minX:number, maxX:number}} bounds
     */
    enableAutopilot(speed, bounds) {
        this.autopilot = true;
        this._autopilotSpeed = speed;
        this._autopilotBounds = bounds;
        this.vx = speed;
        this.currentAnimation = 'running';
    }

    /**
     * Scripted constant-velocity run (menu living background, 08_menu-flow.md) -
     * unlike autopilot there's no bounds/bounce, and unlike controlled
     * there's no gravity/collision; the caller drives entrances/exits itself.
     * @param {number} vx
     */
    enableFreeRun(vx) {
        this.freeRun = true;
        this.vx = vx;
        this.facing = vx >= 0 ? 1 : -1;
        this.currentAnimation = 'running';
    }

    /**
     * Real keyboard-driven movement (Run/Jump/Drop Through Platform), used by GameState.
     * @param {InputHandler} input
     * @param {Collision} collision
     * @param {{moveSpeed?:number, jumpSpeed?:number, gravity?:number}} [options]
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
     * @param {number} dt
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
     * @param {number} dt
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

    /** @returns {number} */
    get visualTopY() { return this.renderer.visualTopY; }

    /** @returns {number} */
    get visualCenterY() { return this.renderer.visualCenterY; }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        this.renderer.render(ctx);
    }
}
