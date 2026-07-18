import { Entity } from './Entity.js';

// thrown_sword.png is 16x32 (narrow, portrait) - hitbox/render size matches
// that aspect ratio instead of squashing it into a square.
const PROJECTILE_WIDTH = 20;
const PROJECTILE_HEIGHT = 40;
const PROJECTILE_SPEED = 400;
// Despawns after traveling this far without hitting anything, so a miss
// doesn't just fly forever off the edge of the level.
const MAX_TRAVEL_PX = 300;

// How far each swept sub-step advances before re-checking for a solid tile -
// small enough that a fast throw can't tunnel through a thin wall in one
// frame (Collision.resolve()'s own X-axis check is disabled for one-way
// levels, see GameState.js, so this can't just reuse that).
const SWEEP_STEP_PX = 4;

// Continuous spin for a "thrown blade" look - thrown_sword.png is a single
// static image (no sprite sheet), so this is the only motion cue on it.
const ROTATION_PER_PX = 0.15;

// Straight horizontal throw (03_mechanics.md 4.3's "Sword Throw") - no
// gravity, thrown weapons in this game fly level rather than arcing.
export class Projectile extends Entity {
    // Takes a center position rather than top-left, so callers (GameState.js)
    // can spawn it flush with the player's own centerY/leading edge without
    // needing to know PROJECTILE_SIZE themselves.
    constructor(spawnCenterX, spawnCenterY, direction, sprite, damage) {
        super(spawnCenterX - PROJECTILE_WIDTH / 2, spawnCenterY - PROJECTILE_HEIGHT / 2, PROJECTILE_WIDTH, PROJECTILE_HEIGHT);
        this.direction = direction;
        this.vx = direction * PROJECTILE_SPEED;
        this.sprite = sprite;
        this.damage = damage;
        this.traveled = 0;
        this.dead = false;
    }

    update(dt, collision) {
        const totalDx = this.vx * dt;
        const steps = Math.max(1, Math.ceil(Math.abs(totalDx) / SWEEP_STEP_PX));
        const stepDx = totalDx / steps;

        for (let i = 0; i < steps; i++) {
            const leadingEdgeX = this.direction > 0 ? this.x + this.width + stepDx : this.x + stepDx;
            if (collision.isSolidAt(leadingEdgeX, this.centerY)) {
                this.dead = true;
                return;
            }

            this.x += stepDx;
            this.traveled += Math.abs(stepDx);
            if (this.traveled >= MAX_TRAVEL_PX) {
                this.dead = true;
                return;
            }
        }
    }

    render(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.rotate(this.traveled * ROTATION_PER_PX * this.direction);
        if (this.direction === -1) ctx.scale(-1, 1);
        ctx.drawImage(this.sprite, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}
