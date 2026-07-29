import { Entity } from './Entity.js';
import { PlayerHealth } from './PlayerHealth.js';
import { PlayerRenderer } from './PlayerRenderer.js';
import { DoubleJumpAbility } from './DoubleJumpAbility.js';
import { DashAbility } from './DashAbility.js';

// Sprite frames carry transparent padding around the character, so the
// collision hitbox is intentionally narrower than the full render size -
// matches the previous 32x64 footprint (10_technical-architecture.md 11.7.2).
const HITBOX_WIDTH = 32;
const HITBOX_HEIGHT = 64;

// attack.png frame where the blade reaches full extension - the swing
// resolves its hit exactly once, here, via consumeAttackImpact() (Combat.js).
const ATTACK_IMPACT_FRAME = 4;

// Coyote time: how long after walking off a ledge a jump still counts as
// grounded. Jump buffering: how long an early jump press still fires once
// grounded. Both mask the single-frame window a rigid grounded-check would
// otherwise need, which reads as unresponsive on a keyboard.
const COYOTE_TIME_SECONDS = 0.1;
const JUMP_BUFFER_SECONDS = 0.12;
// Variable jump height: releasing jump early while still rising clamps vy to
// this fraction of full takeoff speed, for a short hop instead of always
// launching to full height regardless of tap vs. hold.
const SHORT_HOP_VY_FRACTION = 0.45;

// Movement feel: ramps vx toward the target speed instead of snapping
// instantly. Deceleration is faster than acceleration so stopping still reads as responsive.
const ACCELERATION = 1800;
const DECELERATION = 2600;

// How long a knockback push overrides normal horizontal control - without
// this the accel/decel movement code would immediately pull vx back toward
// whatever's held, making the hit invisible.
const KNOCKBACK_LOCK_SECONDS = 0.15;

// Drop-Through-Platform (03_mechanics.md 4.2, replaces the originally-planned
// Duck): just enough to push the player past the one-way collision's
// "already below this surface" threshold before Collision.resolve() runs
// this same frame - gravity does the rest, no multi-frame "falling through" state needed.
const DROP_NUDGE_PX = 4;

/**
 * @param {number} current
 * @param {number} target
 * @param {number} maxDelta
 * @returns {number}
 */
function moveToward(current, target, maxDelta) {
    if (current < target) return Math.min(current + maxDelta, target);
    if (current > target) return Math.max(current - maxDelta, target);
    return current;
}

// Three mutually-exclusive movement modes, set once by whichever enableX()
// the caller uses: autopilot (menu bounce-between-bounds demo), freeRun
// (menu living-background scripted pass, no physics), controlled (real
// keyboard play, see enableControl()/_updateControlled()). Health/Shield/buff
// bookkeeping and the sprite-drawing pipeline live on composed sub-objects
// (PlayerHealth.js/PlayerRenderer.js) instead of here - most of the getters
// below are thin delegates so external callers can keep reading
// player.health/shield/dead/godmode/visualTopY directly.
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

        this._initMovementState();
        this._initAttackState();
        this._initAbilityState();
        this._initVfxState();
    }

    /**
     * pendingVfx mailbox (same pattern as Wraith.js's pendingProjectile) -
     * drained every frame by LevelSession's _drainPlayerVfx(). _wasGrounded
     * tracks the previous frame's grounded state so _updateControlled() can
     * detect the airborne->grounded edge for the landing effect - starts
     * `null` (unknown) rather than `false`, so the level's very first
     * resolve() (spawning already on the ground) doesn't read as a landing.
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
    }

    /** @see consumeAttackImpact, _startAttack */
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
     * Dev/test-only unlock path today (js/ui/DevPanel.js's Double Jump/Dash
     * buttons) - the real Merchant/Token spend UI doesn't exist yet
     * (TODO.md). One-way, like a real purchase (no re-lock) - idempotent, so
     * LevelSession can call this every frame off Game.abilities without
     * tracking what's already applied.
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
     * Plays the one-shot fall animation instead of instantly cutting to
     * GameState's ghost-rise - deathAnimationFinished gates when that's allowed to start.
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
     * Getting hit shoves the player back briefly instead of damage just
     * being a number - see Combat.js callers.
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
     * Real keyboard-driven movement (Run/Jump/Drop Through Platform), used by
     * GameState. jumpSpeed 379 (up from 360) gives ~10px of extra apex
     * margin over the fixed-timestep fix (Game.js), for level geometry close to the old ceiling.
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

        if (this.autopilot) {
            this._updateAutopilot();
            super.update(dt);
        } else if (this.controlled) {
            this._updateControlled(dt);
        } else if (this.freeRun) {
            super.update(dt);
        }

        this.animations[this.currentAnimation]?.update(dt);
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

    /**
     * @param {number} dt
     */
    _updateControlled(dt) {
        this.healthState.regen(dt);
        this._handleAttackInput();

        const groundedAttack = this.attacking && this.grounded;
        this._updateJumpTimers(dt);
        this.dash.update(dt, this);
        this._updateHorizontalVelocity(dt, groundedAttack);
        this._applyGravityAndJump(dt);
        this._updateDropThrough();

        this.grounded = this.collision.resolve(this, dt);
        if (this._wasGrounded === false && this.grounded) this.pendingVfx.push('landing');
        this._wasGrounded = this.grounded;
        if (this.attacking && this.animations.attack.finished) this.attacking = false;
        this._updateAnimationState();
    }

    /**
     * Always drains the click flag, even mid-swing or mid-air - otherwise a
     * click arriving while unable to act would queue up and fire late once
     * allowed, instead of simply being missed.
     */
    _handleAttackInput() {
        const attackPressed = this.input.consumeAttackPress();
        if (attackPressed && !this.attacking && this.animations.attack) {
            this._startAttack();
        }
    }

    /**
     * Coyote time: this.grounded still reflects last frame's collision
     * result here (this frame's own resolve() happens later), so walking off
     * a ledge doesn't instantly close the jump window. Jump buffering: a
     * press is queued for JUMP_BUFFER_SECONDS so a tap slightly before
     * landing still fires once grounded.
     * @param {number} dt
     */
    _updateJumpTimers(dt) {
        this.coyoteTimer = this.grounded ? COYOTE_TIME_SECONDS : Math.max(0, this.coyoteTimer - dt);
        if (this.grounded) this.doubleJump.reset();

        if (this.input.consumeJumpPress()) this.jumpBufferTimer = JUMP_BUFFER_SECONDS;
        else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    /**
     * Attack only roots the player while grounded - airborne, physics keep
     * running normally instead of freezing horizontal movement mid-air. A
     * knockback push, or an active Dash burst (DashAbility.js's _trigger()
     * sets vx/facing once, this just holds them for its duration), overrides
     * this entirely until it expires.
     * @param {number} dt
     * @param {boolean} groundedAttack
     */
    _updateHorizontalVelocity(dt, groundedAttack) {
        if (this.knockbackTimer > 0) this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
        const inKnockback = this.knockbackTimer > 0;
        const inDash = this.dash.timer > 0;

        const left = !groundedAttack && this.input.isDown('left');
        const right = !groundedAttack && this.input.isDown('right');
        let targetVx = 0;
        if (!inKnockback && !inDash && !groundedAttack) {
            if (left && !right) {
                targetVx = -this.moveSpeed;
                this.facing = -1;
            } else if (right && !left) {
                targetVx = this.moveSpeed;
                this.facing = 1;
            }
        }
        const accelRate = targetVx === 0 ? DECELERATION : ACCELERATION;
        this.vx = (inKnockback || inDash) ? this.vx : (groundedAttack ? 0 : moveToward(this.vx, targetVx, accelRate * dt));
    }

    /**
     * @param {number} dt
     */
    _applyGravityAndJump(dt) {
        this.vy += this.gravity * dt;

        if (!this._tryGroundJump() && !this._tryDoubleJump()
            && this.vy < 0 && !this.input.isDown('jump')) {
            this.vy = Math.max(this.vy, -this.jumpSpeed * SHORT_HOP_VY_FRACTION);
        }
    }

    /**
     * Coyote-time/jump-buffer-gated normal jump.
     * @returns {boolean} Whether it fired.
     */
    _tryGroundJump() {
        if (this.attacking || this.jumpBufferTimer <= 0 || this.coyoteTimer <= 0) return false;
        this.vy = -this.jumpSpeed;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this.pendingVfx.push('jump');
        return true;
    }

    /**
     * Only reached once _tryGroundJump() has already failed this frame, so
     * this never fires within the same frame as a normal/coyote-time jump.
     * Reuses jumpBufferTimer as the "a jump press is pending" signal
     * (already fed by consumeJumpPress() in _updateJumpTimers()) rather than
     * a separate raw press check - consuming it here also stops the same
     * buffered press from replaying as a bogus extra jump the instant the
     * player lands. Note: walking off a ledge without jumping (coyote
     * expires with doubleJump.used still false) means the next mid-air jump
     * press fires as the "double" jump even without a first one - intentional,
     * the usual "one bonus airborne jump per grounded cycle" genre convention.
     * @returns {boolean} Whether it fired.
     */
    _tryDoubleJump() {
        if (this.attacking || !this.doubleJump.unlocked || this.doubleJump.used) return false;
        if (this.jumpBufferTimer <= 0) return false;
        this.vy = -this.jumpSpeed;
        this.jumpBufferTimer = 0;
        this.doubleJump.used = true;
        return true;
    }

    /**
     * Only if there's a real floor below to land on (Collision.hasFloorBelow,
     * not a pit) and the current platform isn't tagged no-drop
     * (Collision.isNoDropBelow - an intended solid path). The resolve() call
     * right after immediately overwrites `grounded` with this frame's real
     * result, so the nudge is the only thing that actually matters here.
     */
    _updateDropThrough() {
        if (this.input.consumeDropPress() && !this.attacking && this.grounded
            && this.collision.hasFloorBelow(this) && !this.collision.isNoDropBelow(this)) {
            this.y += DROP_NUDGE_PX;
        }
    }

    /**
     * Locks movement for the swing's duration (base Attack, as opposed to the
     * later Air Attack/Slide+Attack unlockables) - gravity and collision keep
     * resolving normally, only horizontal input is ignored.
     */
    _startAttack() {
        this.attacking = true;
        this._attackImpactResolved = false;
        this.currentAnimation = 'attack';
        this.animations.attack.reset();
    }

    /**
     * Airborne takes priority over running/idle regardless of horizontal
     * input. Switching animations resets it, so a jump never starts mid-way
     * through whatever frame idle/running happened to be on.
     */
    _updateAnimationState() {
        let nextAnimation;
        if (this.attacking) {
            nextAnimation = 'attack';
        } else if (!this.grounded) {
            nextAnimation = 'jump';
        } else if (this.vx === 0) {
            nextAnimation = 'idle';
        } else {
            nextAnimation = 'running';
        }

        if (nextAnimation !== this.currentAnimation) {
            this.currentAnimation = nextAnimation;
            this.animations[this.currentAnimation]?.reset();
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
