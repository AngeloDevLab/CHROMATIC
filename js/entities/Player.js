import { Entity } from './Entity.js';

// Sprite frames carry transparent padding around the character (room for
// animation), so the collision hitbox is intentionally narrower than the full
// render size - matches the previous 32x64 footprint per
// 10_technical-architecture.md 11.7.2, independent of how big the sprite
// canvas itself is.
const HITBOX_WIDTH = 32;
const HITBOX_HEIGHT = 64;
const TARGET_VISIBLE_HEIGHT = 64;

// 04_health-save-system.md 5.1/5.2: both base value 100.
const MAX_HEALTH = 100;
const MAX_SHIELD = 100;
// 03_mechanics.md 4.5: "50 points (1 Secret Room) take about 50 seconds from empty".
const SHIELD_REGEN_PER_SECOND = 1;

// attack.png frame where the blade reaches full extension - the swing resolves
// its hit exactly once, here, via consumeAttackImpact() (see Combat.js).
const ATTACK_IMPACT_FRAME = 4;

// Brief invincibility after taking any hit, so multiple overlapping enemies
// (or one lingering enemy) can't stack damage every single frame - independent
// of any individual enemy's own contactCooldown in Combat.js.
const INVINCIBILITY_SECONDS = 0.5;

// Brief white tint on taking damage (see SpriteAnimation.draw's flashAmount) -
// deliberately much shorter than INVINCIBILITY_SECONDS, a quick hit reaction
// rather than a "still invincible" indicator.
const HIT_FLASH_SECONDS = 0.15;

// Jump feel (game-feel pass): how long after walking off a ledge a jump still
// counts as "grounded" (coyote time), and how long a jump press pressed
// slightly before landing is still honored once grounded (jump buffering).
// Both mask the exact single-frame window a rigid grounded-check would
// otherwise require, which reads as unresponsive on a keyboard.
const COYOTE_TIME_SECONDS = 0.1;
const JUMP_BUFFER_SECONDS = 0.12;
// Variable jump height: releasing jump early while still rising clamps vy
// down to this fraction of a full jump's takeoff speed, for a short hop
// instead of always launching to full height regardless of tap-vs-hold.
const SHORT_HOP_VY_FRACTION = 0.45;

// Movement feel: ramps vx toward the target speed instead of snapping
// instantly, so starting/stopping has a touch of weight - deceleration is
// faster than acceleration so stopping still reads as responsive.
const ACCELERATION = 1800;
const DECELERATION = 2600;

// How long a knockback push overrides normal horizontal control for - without
// this, the accel/decel movement code would immediately pull vx back toward
// whatever direction is held (or 0), making the hit invisible.
const KNOCKBACK_LOCK_SECONDS = 0.15;

function moveToward(current, target, maxDelta) {
    if (current < target) return Math.min(current + maxDelta, target);
    if (current > target) return Math.max(current - maxDelta, target);
    return current;
}

export class Player extends Entity {
    constructor(x, y, animations) {
        super(x, y, HITBOX_WIDTH, HITBOX_HEIGHT);
        this.animations = animations;
        this.currentAnimation = 'idle';
        this.facing = 1;

        // Scale the render size up so the *visible* character (excluding the
        // sprite's own padding) measures roughly TARGET_VISIBLE_HEIGHT, instead
        // of naively drawing the whole padded frame at that size - which would
        // make the actual character look noticeably smaller than intended.
        const idle = animations.idle;
        const visibleFraction = idle ? idle.groundLineRatio - idle.topRatio : 1;
        this.renderSize = TARGET_VISIBLE_HEIGHT / visibleFraction;

        this.autopilot = false;
        this._autopilotSpeed = 0;
        this._autopilotBounds = null;

        this.freeRun = false;

        this.controlled = false;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.knockbackTimer = 0;

        this.attacking = false;
        this._attackImpactResolved = false;

        this.invincibleTimer = 0;
        this.hitFlashTimer = 0;

        this.dead = false;

        this.maxHealth = MAX_HEALTH;
        this.health = MAX_HEALTH;
        this.maxShield = MAX_SHIELD;
        this.shield = MAX_SHIELD;
    }

    // Instant kill bypassing Shield/invincibility entirely - falling out of the
    // level (GameState's kill plane) shouldn't be survivable just because the
    // player happens to be mid-i-frames or still has Prisma up.
    die() {
        if (this.dead) return;
        this.shield = 0;
        this.health = 0;
        this._enterDeathAnimation();
    }

    // Switches to the one-shot fall animation rather than instantly cutting to
    // GameState's ghost-rise - deathAnimationFinished (below) gates when
    // that's allowed to start, so the player visibly collapses first.
    _enterDeathAnimation() {
        this.dead = true;
        if (this.animations.dead) {
            this.currentAnimation = 'dead';
            this.animations.dead.reset();
        }
    }

    // True once the fall animation has played out (or immediately if this
    // Player instance has no 'dead' animation wired, e.g. MenuState's
    // decorative characters) - GameState waits for this before starting the
    // ghost-rise sequence.
    get deathAnimationFinished() {
        return !this.animations.dead || this.animations.dead.finished;
    }

    // 03_mechanics.md 4.5: Prisma absorbs hits first, only once fully depleted
    // does the remainder carry over to Health.
    takeDamage(amount) {
        if (this.dead || this.invincibleTimer > 0) return;

        if (this.shield > 0) {
            const overflow = amount - this.shield;
            this.shield = Math.max(0, this.shield - amount);
            if (overflow > 0) this.health = Math.max(0, this.health - overflow);
        } else {
            this.health = Math.max(0, this.health - amount);
        }

        if (this.health === 0) this._enterDeathAnimation();

        this.invincibleTimer = INVINCIBILITY_SECONDS;
        this.hitFlashTimer = HIT_FLASH_SECONDS;
    }

    // Combat feel: getting hit shoves the player back briefly instead of
    // damage just being a number - see Combat.js callers.
    applyKnockback(vx) {
        this.vx = vx;
        this.knockbackTimer = KNOCKBACK_LOCK_SECONDS;
    }

    // True exactly once per swing, the instant the blade reaches full extension
    // - callers (GameState, via Combat.js's resolveMeleeAttack) resolve the
    // actual hit-detection against enemies from here.
    consumeAttackImpact() {
        if (!this.attacking || this._attackImpactResolved) return false;
        if (this.animations.attack.currentFrame < ATTACK_IMPACT_FRAME) return false;
        this._attackImpactResolved = true;
        return true;
    }

    enableAutopilot(speed, bounds) {
        this.autopilot = true;
        this._autopilotSpeed = speed;
        this._autopilotBounds = bounds;
        this.vx = speed;
        this.currentAnimation = 'running';
    }

    // Scripted, physics-free constant-velocity run (menu living background,
    // 08_menu-flow.md) - unlike enableAutopilot there's no bounds/bounce, and
    // unlike enableControl there's no gravity/collision; the caller drives
    // entrances/exits itself (e.g. starting off-screen, ending the pass once
    // it's fully exited the other side).
    enableFreeRun(vx) {
        this.freeRun = true;
        this.vx = vx;
        this.facing = vx >= 0 ? 1 : -1;
        this.currentAnimation = 'running';
    }

    // Real keyboard-driven movement (04_health-save-system.md base abilities:
    // Run, Jump, Duck) - used by GameState, as opposed to the menu's autopilot.
    // jumpSpeed 379 (up from 360) gives a max apex of ~102.5px instead of
    // ~92.5px (maxHeight = jumpSpeed^2 / (2*gravity)) - ~10px of extra safety
    // margin on top of the fixed-timestep fix (Game.js), for level geometry
    // that's close to the old ceiling.
    enableControl(input, collision, { moveSpeed = 150, jumpSpeed = 379, gravity = 700 } = {}) {
        this.controlled = true;
        this.input = input;
        this.collision = collision;
        this.moveSpeed = moveSpeed;
        this.jumpSpeed = jumpSpeed;
        this.gravity = gravity;
    }

    update(dt) {
        // Ticks down even once dead - otherwise the killing blow's white flash
        // (still active from the same frame takeDamage() set it) would never
        // fade and the whole death animation renders permanently white-tinted.
        if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);

        if (this.dead) {
            this.animations.dead?.update(dt);
            return;
        }

        if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

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

    _updateControlled(dt) {
        this.shield = Math.min(this.maxShield, this.shield + SHIELD_REGEN_PER_SECOND * dt);

        // Always drain the click flag, even mid-swing or mid-air - otherwise a
        // click that arrives while unable to act right now would queue up and
        // fire late once the state allows it, instead of being simply missed.
        const attackPressed = this.input.consumeAttackPress();
        if (attackPressed && !this.attacking && this.animations.attack) {
            this._startAttack();
        }

        // Attack only roots the player while grounded - airborne, physics keep
        // running normally (momentum, direction changes) instead of freezing
        // horizontal movement mid-air.
        const groundedAttack = this.attacking && this.grounded;
        const left = !groundedAttack && this.input.isDown('left');
        const right = !groundedAttack && this.input.isDown('right');
        // Ducking has no crouch sprite/hitbox yet - placeholder just locks
        // movement, reusing the idle animation, until real duck art exists.
        const ducking = !this.attacking && this.input.isDown('duck') && this.grounded;

        // Coyote time: this.grounded still reflects last frame's collision
        // result at this point (this frame's own resolve() happens below), so
        // walking off a ledge doesn't instantly close the jump window.
        this.coyoteTimer = this.grounded ? COYOTE_TIME_SECONDS : Math.max(0, this.coyoteTimer - dt);

        // Jump buffering: queue a press for JUMP_BUFFER_SECONDS so a tap
        // slightly before landing still fires once grounded, instead of being
        // silently dropped for arriving a frame or two too early.
        if (this.input.consumeJumpPress()) this.jumpBufferTimer = JUMP_BUFFER_SECONDS;
        else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

        if (this.knockbackTimer > 0) this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
        const inKnockback = this.knockbackTimer > 0;

        let targetVx = 0;
        if (!inKnockback && !(groundedAttack || ducking)) {
            if (left && !right) {
                targetVx = -this.moveSpeed;
                this.facing = -1;
            } else if (right && !left) {
                targetVx = this.moveSpeed;
                this.facing = 1;
            }
        }
        const accelRate = targetVx === 0 ? DECELERATION : ACCELERATION;
        this.vx = inKnockback ? this.vx : ((groundedAttack || ducking) ? 0 : moveToward(this.vx, targetVx, accelRate * dt));

        this.vy += this.gravity * dt;

        if (!this.attacking && this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !ducking) {
            this.vy = -this.jumpSpeed;
            this.jumpBufferTimer = 0;
            this.coyoteTimer = 0;
        } else if (this.vy < 0 && !this.input.isDown('jump')) {
            // Variable jump height: released early while still rising, so cut
            // the ascent short instead of always launching to full height
            // regardless of a quick tap vs. a held press.
            this.vy = Math.max(this.vy, -this.jumpSpeed * SHORT_HOP_VY_FRACTION);
        }

        this.grounded = this.collision.resolve(this, dt);

        if (this.attacking && this.animations.attack.finished) {
            this.attacking = false;
        }

        this._updateAnimationState(ducking);
    }

    // Locks movement for the swing's duration (base Attack, as opposed to the
    // later Air Attack/Slide+Attack unlockables - 03_mechanics.md 4.2) - gravity
    // and collision keep resolving as normal, only horizontal input is ignored.
    _startAttack() {
        this.attacking = true;
        this._attackImpactResolved = false;
        this.currentAnimation = 'attack';
        this.animations.attack.reset();
    }

    // Airborne takes priority over running/idle regardless of horizontal
    // input, so jumping while moving still shows the jump pose. Switching
    // animations resets it, so a jump never starts mid-way through whatever
    // frame idle/running happened to be on last.
    _updateAnimationState(ducking) {
        let nextAnimation;
        if (this.attacking) {
            nextAnimation = 'attack';
        } else if (!this.grounded) {
            nextAnimation = 'jump';
        } else if (ducking || this.vx === 0) {
            nextAnimation = 'idle';
        } else {
            nextAnimation = 'running';
        }

        if (nextAnimation !== this.currentAnimation) {
            this.currentAnimation = nextAnimation;
            this.animations[this.currentAnimation]?.reset();
        }
    }

    // Always anchored to idle's feet position, not the current animation's own
    // - jump's tucked-legs pose has a much higher "lowest opaque pixel" than
    // standing idle, so anchoring per-animation would shift the character up
    // and down on screen every time it switches animation (looking like it
    // floats above the ground, or sinks through a ceiling it's not actually
    // touching, relative to the real hitbox). One fixed reference keeps the
    // visible sprite stable regardless of pose.
    _drawY(referenceAnim = this.animations.idle, renderSize = this.renderSize) {
        const groundSurfaceY = this.y + this.height;
        return groundSurfaceY - referenceAnim.groundLineRatio * renderSize;
    }

    // The sprite is drawn wider/taller than the hitbox (renderSize vs
    // width/height) - center it horizontally over the narrower hitbox instead
    // of aligning their left edges, or the character would visibly lean to one
    // side of its own collision box.
    _drawX(renderWidth = this.renderSize) {
        return this.x - (renderWidth - this.width) / 2;
    }

    // The true visual middle of the character (accounting for sprite padding),
    // as opposed to Entity's generic centerY which is just the hitbox midpoint.
    get visualCenterY() {
        const referenceAnim = this.animations.idle;
        if (!referenceAnim) return this.centerY;

        const drawY = this._drawY();
        const topY = drawY + referenceAnim.topRatio * this.renderSize;
        const bottomY = drawY + referenceAnim.groundLineRatio * this.renderSize;
        return (topY + bottomY) / 2;
    }

    render(ctx) {
        const anim = this.animations[this.currentAnimation];
        if (!anim) return;

        // Idle/running/jump/dead share idle's own render size and ground line
        // (see _drawY's default params) so switching between those poses never
        // jitters vertically - all drawn from the same 96x96 sheet convention.
        // Attack is a distinct one-shot pose that can use a differently-sized/
        // padded sheet - including non-square, e.g. extra side padding for the
        // sword to swing past the body without needing extra vertical padding
        // too - without throwing that off, so it's anchored to and scaled from
        // its own bounds instead. Scaled by height only, then width follows the
        // frame's own aspect ratio, or a non-square frame would stretch/squash
        // instead of just having more padding.
        const isAttacking = this.currentAnimation === 'attack';
        let renderWidth;
        let renderHeight;
        if (isAttacking) {
            renderHeight = TARGET_VISIBLE_HEIGHT / (anim.groundLineRatio - anim.topRatio);
            renderWidth = renderHeight * (anim.frameWidth / anim.frameHeight);
        } else {
            renderWidth = this.renderSize;
            renderHeight = this.renderSize;
        }
        const drawX = this._drawX(renderWidth);
        const drawY = isAttacking ? this._drawY(anim, renderHeight) : this._drawY();
        const flashAmount = this.hitFlashTimer / HIT_FLASH_SECONDS;

        ctx.save();
        if (this.facing === -1) {
            ctx.translate(drawX + renderWidth, drawY);
            ctx.scale(-1, 1);
            anim.draw(ctx, 0, 0, renderWidth, renderHeight, flashAmount);
        } else {
            anim.draw(ctx, drawX, drawY, renderWidth, renderHeight, flashAmount);
        }
        ctx.restore();
    }
}
