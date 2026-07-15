import { Entity } from './Entity.js';

const DEFAULT_PATROL_SPEED = 40;
const DEFAULT_GRAVITY = 700;

// Patroller behavior (05_enemies-bosses.md), HP bumped up from the GDD's 20
// (Zone 1 balancing draft) per playtesting feedback - 2 hits felt too fast.
const DEFAULT_HP = 50;
const DEFAULT_CONTACT_DAMAGE = 5;

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

        this.renderSize = width;
        this.referenceAnim = null;

        this.hp = DEFAULT_HP;
        this.maxHp = DEFAULT_HP;
        this.contactDamage = DEFAULT_CONTACT_DAMAGE;
        this.contactCooldown = 0;
        this.dead = false;
    }

    takeDamage(amount) {
        if (this.dead) return;
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp === 0) this.dead = true;
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

    update(dt) {
        if (this.dead) return;
        if (this.patrolling) this._updatePatrol(dt);
        this.animations?.[this.currentAnimation]?.update(dt);
    }

    _updatePatrol(dt) {
        this.vy += this.gravity * dt;

        // Only reconsider direction while grounded - mid-air (e.g. right after
        // spawning above its floor) there's nothing meaningful to react to yet.
        if (this.grounded && this._blockedAhead()) {
            this.facing *= -1;
        }
        this.vx = this.patrolSpeed * this.facing;

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
        if (this.dead) return;

        const anim = this.animations?.[this.currentAnimation];
        if (!anim || !this.referenceAnim) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
            return;
        }

        const drawY = this._drawY();
        const drawX = this._drawX();

        ctx.save();
        if (this.facing === -1) {
            ctx.translate(drawX + this.renderSize, drawY);
            ctx.scale(-1, 1);
            anim.draw(ctx, 0, 0, this.renderSize, this.renderSize);
        } else {
            anim.draw(ctx, drawX, drawY, this.renderSize, this.renderSize);
        }
        ctx.restore();
    }
}
