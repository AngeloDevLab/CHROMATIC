import { Entity } from './Entity.js';

const DEFAULT_PATROL_SPEED = 40;
const DEFAULT_GRAVITY = 700;

// Brief white tint on taking damage, mirrors Player.js's HIT_FLASH_SECONDS
// (see SpriteAnimation.draw's flashAmount).
const HIT_FLASH_SECONDS = 0.15;

// How long a knockback push overrides the normal patrol vx assignment for -
// without this, _updatePatrol would stomp the pushed-back vx with
// patrolSpeed * facing on the very next frame, making the hit invisible.
const KNOCKBACK_LOCK_SECONDS = 0.15;

// Patroller behavior (05_enemies-bosses.md), HP bumped up from the GDD's 20
// (Zone 1 balancing draft) per playtesting feedback - 2 hits felt too fast.
const DEFAULT_HP = 50;
// Bumped from the GDD's original 5 - at 5, the difficulty multiplier's effect
// on a single Patroller hit was too small to actually notice while playing.
const DEFAULT_CONTACT_DAMAGE = 10;

// How far past its own leading edge to probe for "is the way ahead blocked" -
// small enough to react before actually stepping off, large enough to not
// trigger on the enemy's own hitbox tiles.
const LOOKAHEAD_PX = 4;

// Patroller behavior (05_enemies-bosses.md): walks left/right along whatever
// one-way floor it spawned on, gravity-bound via the shared Collision instance
// like the player. Direction flips purely from reading the tile grid ahead
// (wall, or floor about to run out) - no per-level patrol-bounds markers
// needed, see GameState.js for the spawn wiring.
export class Enemy extends Entity {
    constructor(x, y, sprite, width = sprite.width, height = sprite.height) {
        super(x, y, width, height);
        this.sprite = sprite;
        this.animations = null;
        this.currentAnimation = null;
        this.facing = 1;

        this.patrolling = false;
        this.collision = null;
        this.patrolSpeed = 0;
        this.gravity = 0;
        this.grounded = false;

        this.freeRun = false;

        this.renderSize = width;
        this.referenceAnim = null;

        this.hp = DEFAULT_HP;
        this.maxHp = DEFAULT_HP;
        this.contactDamage = DEFAULT_CONTACT_DAMAGE;
        this.contactCooldown = 0;
        this.dead = false;
        // Harmless and hidden from the HP bar until a subclass clears this
        // (Sentinel.js, through both its buried and mid-rise phases - not
        // dangerous until fully risen). Every other enemy type stays
        // false/interactive from the start.
        this.dormant = false;
        // Whether GameState should draw this before the terrain layer (fully
        // hidden behind it) instead of after (normal, visible). Separate from
        // `dormant` above - Sentinel.js clears this the instant it's
        // triggered (so the rise is visible, telegraphing the coming threat)
        // well before `dormant` itself clears (which is what actually makes
        // it dangerous) - see Sentinel.js for why those two needed to split.
        this.buried = false;
        // One-time flag so GameState's death color-reveal (see Combat/ColorZone
        // wiring in GameState.js) fires exactly once per enemy, not every frame
        // it stays dead.
        this.colorRevealed = false;

        this.hitFlashTimer = 0;
        this.knockbackTimer = 0;
    }

    takeDamage(amount) {
        if (this.dead) return;
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp === 0) this._enterDeathAnimation();
        this.hitFlashTimer = HIT_FLASH_SECONDS;
    }

    // Switches to the one-shot death animation rather than vanishing instantly
    // - render()/deathAnimationFinished below keep it visible (and its own
    // animation still updating) until that plays out. GameState's death color
    // reveal etc. key off `dead` directly, so those still fire immediately.
    _enterDeathAnimation() {
        this.dead = true;
        if (this.animations?.dead) {
            this.currentAnimation = 'dead';
            this.animations.dead.reset();
        }
    }

    // True once the death animation has played out (or immediately if this
    // Enemy instance has no 'dead' animation wired) - mirrors Player.js's
    // deathAnimationFinished.
    get deathAnimationFinished() {
        return !this.animations?.dead || this.animations.dead.finished;
    }

    // Combat feel: a hit shoves the enemy back briefly instead of it just
    // absorbing damage in place - see Combat.js's resolveContactDamage
    // (the passive Prisma barrier / body-contact push).
    applyKnockback(vx) {
        this.vx = vx;
        this.knockbackTimer = KNOCKBACK_LOCK_SECONDS;
    }

    // Separate from applyKnockback above - used only by Combat.js's active
    // attack resolvers (resolveMeleeAttack/resolveProjectileHits), so a
    // subclass can make itself immune to being staggered by an attack
    // without also losing the passive contact-push reaction (Charger.js
    // overrides only this one, so charging through the player's body still
    // bounces it back via applyKnockback instead of clipping through).
    // Plain delegation here - every non-Charger enemy reacts identically to
    // both knockback sources.
    applyAttackKnockback(vx) {
        this.applyKnockback(vx);
    }

    setAnimations(animations, initial = 'running') {
        this.animations = animations;
        this.currentAnimation = initial;

        // Sprite frames carry transparent padding around the creature (room for
        // the animation to move within a fixed frame) - anchoring/scaling to that
        // padding's own bounds instead of stretching the whole frame into the
        // hitbox, same reasoning as Player.js's renderSize/groundLineRatio.
        // Fixed reference (not "whichever animation is playing right now") so the
        // ground line doesn't jump if a differently-padded animation is added later.
        this.referenceAnim = animations[initial];
        if (this.referenceAnim) {
            const visibleFraction = this.referenceAnim.groundLineRatio - this.referenceAnim.topRatio;
            this.renderSize = this.height / visibleFraction;
        }
    }

    enablePatrol(collision, { speed = DEFAULT_PATROL_SPEED, gravity = DEFAULT_GRAVITY } = {}) {
        this.patrolling = true;
        this.collision = collision;
        this.patrolSpeed = speed;
        this.gravity = gravity;
    }

    // Scripted, physics-free constant-velocity run (menu living background) -
    // no gravity/collision, no ledge/wall turning like enablePatrol. The
    // caller drives entrances/exits itself.
    enableFreeRun(vx) {
        this.freeRun = true;
        this.vx = vx;
        this.facing = vx >= 0 ? 1 : -1;
    }

    update(dt) {
        // Ticks down even once dead - otherwise the killing blow's white flash
        // (still active from the same frame takeDamage() set it) would never
        // fade and the whole death animation renders permanently white-tinted
        // (same fix as Player.js).
        if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);

        if (this.dead) {
            this.animations?.dead?.update(dt);
            return;
        }

        if (this.patrolling) this._updatePatrol(dt);
        else if (this.freeRun) super.update(dt);
        this.animations?.[this.currentAnimation]?.update(dt);
    }

    _updatePatrol(dt) {
        this.vy += this.gravity * dt;

        if (this.knockbackTimer > 0) {
            this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
        } else {
            // Only reconsider direction while grounded - mid-air (e.g. right
            // after spawning above its floor) there's nothing meaningful to
            // react to yet.
            if (this.grounded && this._blockedAhead()) {
                this.facing *= -1;
            }
            this.vx = this.patrolSpeed * this.facing;
        }

        this.grounded = this.collision.resolve(this, dt);
    }

    // A solid tile just past the leading edge blocks the way; no solid tile
    // below that same point means the floor is about to run out - either one
    // is a reason to turn around before stepping into it.
    _blockedAhead() {
        const edgeX = this.facing > 0
            ? this.x + this.width + LOOKAHEAD_PX
            : this.x - LOOKAHEAD_PX;

        const wallAhead = this.collision.isSolidAt(edgeX, this.centerY);
        const floorAhead = this.collision.isSolidAt(edgeX, this.y + this.height + 1);

        return wallAhead || !floorAhead;
    }

    // Bottom-anchored to the reference animation's ground line (not the raw
    // hitbox edge) - keeps the visible creature's feet flush with the ground
    // it's standing on regardless of how much transparent padding its sheet
    // carries. Shared by render() and visualTopY (HP bar placement).
    _drawY() {
        return this.y + this.height - this.referenceAnim.groundLineRatio * this.renderSize;
    }

    _drawX() {
        return this.x - (this.renderSize - this.width) / 2;
    }

    // Topmost visible pixel row in world space, used to sit the HP bar just
    // above the creature's head instead of above its (possibly padded) hitbox.
    get visualTopY() {
        if (!this.referenceAnim) return this.y;
        return this._drawY() + this.referenceAnim.topRatio * this.renderSize;
    }

    render(ctx) {
        if (this.dead && this.deathAnimationFinished) return;

        const anim = this.animations?.[this.currentAnimation];
        if (!anim || !this.referenceAnim) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
            return;
        }

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
