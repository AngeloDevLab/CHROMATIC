import { Entity } from './Entity.js';

const DEFAULT_PATROL_SPEED = 40;
const DEFAULT_GRAVITY = 700;

/**
 * Brief white tint on taking damage, mirrors Player.js's HIT_FLASH_SECONDS
 * (see SpriteAnimation.draw's flashAmount). Exported for Boss.js, which
 * needs the same value to compute flashAmount in its own non-square
 * render() override.
 */
export const HIT_FLASH_SECONDS = 0.15;

/**
 * How long a knockback push overrides the normal patrol vx assignment;
 * without it, _updatePatrol would immediately overwrite the pushed-back vx.
 */
const KNOCKBACK_LOCK_SECONDS = 0.15;

/**
 * Patroller behavior (05_enemies-bosses.md). 30 HP (3 melee hits).
 */
const DEFAULT_HP = 30;

const DEFAULT_CONTACT_DAMAGE = 10;

/**
 * How far past its own leading edge to probe for whether the way ahead is blocked.
 */
const LOOKAHEAD_PX = 4;

// Patroller behavior (05_enemies-bosses.md): walks left/right along whatever
// one-way floor it spawned on, gravity-bound via the shared Collision
// instance. Direction flips from reading the tile grid ahead (wall, or
// floor about to run out).
//
// Lifecycle flags: `dormant` keeps an enemy harmless and off the HP bar
// until a subclass clears it. `buried` controls draw order relative to the
// terrain layer. `colorRevealed` guards GameState's one-time death color-reveal.
//
// Knockback: applyKnockback() is the passive contact-push reaction;
// applyAttackKnockback() handles active attacks and delegates to it by
// default (Charger.js overrides it separately).
export class Enemy extends Entity {
    /**
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
        this.hp = DEFAULT_HP;
        this.maxHp = DEFAULT_HP;
        this.contactDamage = DEFAULT_CONTACT_DAMAGE;
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
     * @param {number} amount - Damage to apply.
     * @returns {number} The amount actually applied (0 if already dead).
     */
    takeDamage(amount) {
        if (this.dead) return 0;
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp === 0) this._enterDeathAnimation();
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
     * True once the death animation has played out (or immediately if this
     * Enemy instance has no 'dead' animation wired) - mirrors Player.js's
     * deathAnimationFinished.
     * @returns {boolean}
     */
    get deathAnimationFinished() {
        return !this.animations?.dead || this.animations.dead.finished;
    }

    /**
     * Applies a brief knockback push (see Combat.js's resolveContactDamage).
     * @param {number} vx - Knockback velocity to apply.
     */
    applyKnockback(vx) {
        this.vx = vx;
        this.knockbackTimer = KNOCKBACK_LOCK_SECONDS;
    }

    /**
     * Applies knockback from an active attack (melee/projectile hit), as opposed to passive body contact.
     * @param {number} vx - Knockback velocity to apply.
     */
    applyAttackKnockback(vx) {
        this.applyKnockback(vx);
    }

    /**
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
     * @param {Collision} collision - Level collision to patrol against.
     * @param {object} [options]
     * @param {number} [options.speed=DEFAULT_PATROL_SPEED]
     * @param {number} [options.gravity=DEFAULT_GRAVITY]
     */
    enablePatrol(collision, { speed = DEFAULT_PATROL_SPEED, gravity = DEFAULT_GRAVITY } = {}) {
        this.patrolling = true;
        this.collision = collision;
        this.patrolSpeed = speed;
        this.gravity = gravity;
    }

    /**
     * Scripted, physics-free constant-velocity run (menu living background)
     * - no gravity/collision, no ledge/wall turning like enablePatrol(). The
     * caller drives entrances/exits itself.
     * @param {number} vx - Constant horizontal velocity.
     */
    enableFreeRun(vx) {
        this.freeRun = true;
        this.vx = vx;
        this.facing = vx >= 0 ? 1 : -1;
    }

    /**
     * hitFlashTimer ticks down even once dead, so the killing blow's white flash still fades.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);

        if (this.dead) {
            this.animations?.dead?.update(dt);
            return;
        }

        if (this.patrolling) this._updatePatrol(dt);
        else if (this.freeRun) super.update(dt);
        this.animations?.[this.currentAnimation]?.update(dt);
    }

    /**
     * Direction is only reconsidered while grounded.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updatePatrol(dt) {
        this.vy += this.gravity * dt;

        if (this.knockbackTimer > 0) {
            this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
        } else {
            if (this.grounded && this._blockedAhead()) {
                this.facing *= -1;
            }
            this.vx = this.patrolSpeed * this.facing;
        }

        this.grounded = this.collision.resolve(this, dt);
    }

    /**
     * A solid tile just past the leading edge blocks the way; no solid tile
     * below that point means the floor is about to run out.
     * @returns {boolean}
     */
    _blockedAhead() {
        const edgeX = this.facing > 0
            ? this.x + this.width + LOOKAHEAD_PX
            : this.x - LOOKAHEAD_PX;

        const wallAhead = this.collision.isSolidAt(edgeX, this.centerY);
        const floorAhead = this.collision.isSolidAt(edgeX, this.y + this.height + 1);

        return wallAhead || !floorAhead;
    }

    /**
     * Bottom-anchored to the reference animation's ground line, not the raw
     * hitbox edge. Shared by render() and visualTopY (HP bar placement).
     * @returns {number}
     */
    _drawY() {
        return this.y + this.height - this.referenceAnim.groundLineRatio * this.renderSize;
    }

    /**
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
