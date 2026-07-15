import { Entity } from './Entity.js';

const DEFAULT_PATROL_SPEED = 40;
const DEFAULT_GRAVITY = 700;

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

    render(ctx) {
        const anim = this.animations?.[this.currentAnimation];
        if (!anim || !this.referenceAnim) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
            return;
        }

        // Bottom-anchored to the reference animation's ground line (not the raw
        // hitbox edge) and centered over the hitbox width - keeps the visible
        // creature's feet flush with the ground it's standing on regardless of
        // how much transparent padding its sheet carries.
        const drawY = this.y + this.height - this.referenceAnim.groundLineRatio * this.renderSize;
        const drawX = this.x - (this.renderSize - this.width) / 2;

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
