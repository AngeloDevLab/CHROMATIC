// Lifecycle flags: dormant keeps an enemy harmless and off the HP bar, buried controls draw order
// relative to terrain, colorRevealed guards the one-time death color-reveal.

import { Entity } from './entity.js';

const default_patrol_speed = 40;
const default_gravity = 700;

/**
 * Brief white tint on taking damage. Exported for boss.js, which needs the
 * same value in its own render() override.
 */
export const HIT_FLASH_SECONDS = 0.15;

/**
 * How long a knockback push overrides the normal patrol velocityX assignment;
 * without it, _updatePatrol would immediately overwrite the pushed-back velocityX.
 */
const knockback_lock_seconds = 0.15;

const default_health = 30;
const default_contact_damage = 20;
const lookahead_px = 4;

/** Base enemy: patrols a one-way floor, turning at walls/ledges, with HP/contact-damage/lifecycle state every enemy type shares. */
export class Enemy extends Entity {
    /**
     * Builds base render/movement/combat/lifecycle state.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite, used before setAnimations() is called.
     * @param {number} [width=sprite.width] - Hitbox width.
     * @param {number} [height=sprite.height] - Hitbox height.
     */
    constructor(x, y, sprite, width = sprite.width, height = sprite.height) {
        super(x, y, width, height);
        this._initRenderState(sprite, width);
        this._initMovementState();
        this._initCombatState();
        this._initLifecycleFlags();
    }

    /**
     * Sets up sprite/animation/facing state before setAnimations() runs.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width, used as the initial render size.
     */
    _initRenderState(sprite, width) {
        this.sprite = sprite;
        this.animations = null;
        this.currentAnimation = null;
        this.facing = 1;
        this.renderSize = width;
        this.referenceAnim = null;
        this.pendingVfx = [];
    }

    /**
     * Patrol/free-run movement state, see enablePatrol()/enableFreeRun().
     */
    _initMovementState() {
        this.patrolling = false;
        this.collision = null;
        this.patrolSpeed = 0;
        this.gravity = 0;
        this.grounded = false;
        this.freeRun = false;
    }

    /**
     * HP/contact-damage/hit-feedback state.
     */
    _initCombatState() {
        this.health = default_health;
        this.maxHealth = default_health;
        this.contactDamage = default_contact_damage;
        this.contactSelfDamageMultiplier = 1;
        this.contactCooldown = 0;
        this.dead = false;
        this.hitFlashTimer = 0;
        this.knockbackTimer = 0;
    }

    /**
     * Initializes the dormant/buried/colorRevealed lifecycle flags.
     */
    _initLifecycleFlags() {
        this.dormant = false;
        this.buried = false;
        this.colorRevealed = false;
    }

    /**
     * Applies damage and enters the death animation if it was fatal.
     * @param {number} amount - Damage to apply.
     * @returns {number} The amount actually applied (0 if already dead).
     */
    takeDamage(amount) {
        if (this.dead) return 0;
        this.health = Math.max(0, this.health - amount);
        if (this.health === 0) this._enterDeathAnimation();
        this.hitFlashTimer = HIT_FLASH_SECONDS;
        return amount;
    }

    /**
     * Switches to the one-shot death animation rather than vanishing instantly.
     */
    _enterDeathAnimation() {
        this.dead = true;
        if (this.animations?.dead) {
            this.currentAnimation = 'dead';
            this.animations.dead.reset();
        }
    }

    /**
     * True once the death animation has played out, or immediately if none is wired.
     * @returns {boolean}
     */
    get deathAnimationFinished() {
        return !this.animations?.dead || this.animations.dead.finished;
    }

    /**
     * Sets velocity and starts the knockback lock timer.
     * @param {number} velocityX - Knockback velocity to apply.
     */
    applyKnockback(velocityX) {
        this.velocityX = velocityX;
        this.knockbackTimer = knockback_lock_seconds;
    }

    /**
     * Applies knockback from an active attack (melee/projectile hit), as opposed to passive body contact.
     * @param {number} velocityX - Knockback velocity to apply.
     */
    applyAttackKnockback(velocityX) {
        this.applyKnockback(velocityX);
    }

    /**
     * Wires up the animation set and recomputes renderSize from it.
     * @param {Object<string, SpriteAnimation>} animations - Named animation set.
     * @param {string} [initial='running'] - Animation to start on, and the
     *   fixed reference for renderSize/ground-line anchoring (see _drawY()).
     */
    setAnimations(animations, initial = 'running') {
        this.animations = animations;
        this.currentAnimation = initial;

        this.referenceAnim = animations[initial];
        if (this.referenceAnim) {
            const visibleFraction = this.referenceAnim.groundLineRatio - this.referenceAnim.topRatio;
            this.renderSize = this.height / visibleFraction;
        }
    }

    /**
     * Starts gravity-bound left/right patrol against the level's collision.
     * @param {Collision} collision - Level collision to patrol against.
     * @param {object} [options] - Optional settings.
     * @param {number} [options.speed=default_patrol_speed] - Patrol speed, in pixels/second.
     * @param {number} [options.gravity=default_gravity] - Gravity applied while patrolling.
     */
    enablePatrol(collision, { speed = default_patrol_speed, gravity = default_gravity } = {}) {
        this.patrolling = true;
        this.collision = collision;
        this.patrolSpeed = speed;
        this.gravity = gravity;
    }

    /**
     * Starts a scripted constant-velocity run - no gravity/collision, no
     * ledge/wall turning like enablePatrol().
     * @param {number} velocityX - Constant horizontal velocity.
     */
    enableFreeRun(velocityX) {
        this.freeRun = true;
        this.velocityX = velocityX;
        this.facing = velocityX >= 0 ? 1 : -1;
    }

    /**
     * Runs one enemy frame; hit-flash still ticks while dead.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    update(deltaTime) {
        if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - deltaTime);

        if (this.dead) {
            this.animations?.dead?.update(deltaTime);
            return;
        }

        if (this.patrolling) this._updatePatrol(deltaTime);
        else if (this.freeRun) super.update(deltaTime);
        this.animations?.[this.currentAnimation]?.update(deltaTime);
    }

    /**
     * Applies gravity and patrol movement, deferring to an active knockback.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _updatePatrol(deltaTime) {
        this.velocityY += this.gravity * deltaTime;

        if (this.knockbackTimer > 0) {
            this.knockbackTimer = Math.max(0, this.knockbackTimer - deltaTime);
        } else {
            if (this.grounded && this._blockedAhead()) {
                this.facing *= -1;
            }
            this.velocityX = this.patrolSpeed * this.facing;
        }

        this.grounded = this.collision.resolve(this, deltaTime);
    }

    /**
     * Probes just past the leading edge for a wall or missing floor.
     * @returns {boolean}
     */
    _blockedAhead() {
        const edgeX = this.facing > 0
            ? this.x + this.width + lookahead_px
            : this.x - lookahead_px;

        const wallAhead = this.collision.isSolidAt(edgeX, this.centerY);
        const floorAhead = this.collision.isSolidAt(edgeX, this.y + this.height + 1);

        return wallAhead || !floorAhead;
    }

    /**
     * Bottom-anchored to the reference animation's ground line, not the raw hitbox edge.
     * @returns {number}
     */
    _drawY() {
        return this.y + this.height - this.referenceAnim.groundLineRatio * this.renderSize;
    }

    /**
     * Centers the sprite over the hitbox.
     * @returns {number}
     */
    _drawX() {
        return this.x - (this.renderSize - this.width) / 2;
    }

    /**
     * Topmost visible pixel row in world space, used to sit the HP bar just
     * above the creature's head instead of above its (possibly padded) hitbox.
     * @returns {number}
     */
    get visualTopY() {
        if (!this.referenceAnim) return this.y;
        return this._drawY() + this.referenceAnim.topRatio * this.renderSize;
    }

    /**
     * Draws the current animation, or the fallback sprite if none is set.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.dead && this.deathAnimationFinished) return;

        const anim = this.animations?.[this.currentAnimation];
        if (!anim || !this.referenceAnim) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
            return;
        }

        this._renderAnimated(ctx, anim);
    }

    /**
     * Draws the current frame, mirrored horizontally when facing left.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {SpriteAnimation} anim - Currently playing animation.
     */
    _renderAnimated(ctx, anim) {
        const drawY = this._drawY();
        const drawX = this._drawX();
        const flashAmount = this.hitFlashTimer / HIT_FLASH_SECONDS;

        ctx.save();
        if (this.facing === -1) {
            ctx.translate(drawX + this.renderSize, drawY);
            ctx.scale(-1, 1);
            anim.draw(ctx, 0, 0, this.renderSize, this.renderSize, flashAmount);
        } else {
            anim.draw(ctx, drawX, drawY, this.renderSize, this.renderSize, flashAmount);
        }
        ctx.restore();
    }
}
