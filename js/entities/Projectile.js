import { Entity } from './Entity.js';

// thrown_sword.png is 32x64 (narrow, portrait) - hitbox/render size matches
// the sprite's native resolution instead of squashing it into a square.
const PROJECTILE_WIDTH = 32;
const PROJECTILE_HEIGHT = 64;
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

// Ghost-trail echoes rendered behind the blade using thrown_sword_trail.png
// (192x24, 8 frames of 24x24 - a motion-blur circle at 8 spin phases). Echo
// spacing/frame are derived from distance traveled rather than a timer, so
// the trail always lines up with where the blade actually was, in sync with
// its own ROTATION_PER_PX spin.
const TRAIL_SOURCE_FRAME_SIZE = 24;
const TRAIL_RENDER_SIZE = 64;
const TRAIL_FRAME_COUNT = 8;
const TRAIL_ECHO_SPACING_PX = 14;
const TRAIL_ECHO_COUNT = 3;

// Straight horizontal throw (03_mechanics.md 4.3's "Sword Throw") - no
// gravity, thrown weapons in this game fly level rather than arcing.
export class Projectile extends Entity {
    // Takes a center position rather than top-left, so callers (GameState.js)
    // can spawn it flush with the player's own centerY/leading edge without
    // needing to know PROJECTILE_SIZE themselves.
    constructor(spawnCenterX, spawnCenterY, direction, sprite, damage, trailSprite) {
        super(spawnCenterX - PROJECTILE_WIDTH / 2, spawnCenterY - PROJECTILE_HEIGHT / 2, PROJECTILE_WIDTH, PROJECTILE_HEIGHT);
        this.direction = direction;
        this.vx = direction * PROJECTILE_SPEED;
        this.sprite = sprite;
        this.trailSprite = trailSprite;
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

        this._renderTrail(ctx);

        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.rotate(this.traveled * ROTATION_PER_PX * this.direction);
        if (this.direction === -1) ctx.scale(-1, 1);
        ctx.drawImage(this.sprite, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    // Farthest echo first so the nearest (most opaque) one paints on top.
    _renderTrail(ctx) {
        if (!this.trailSprite) return;

        for (let i = TRAIL_ECHO_COUNT; i >= 1; i--) {
            const behindPx = i * TRAIL_ECHO_SPACING_PX;
            const traveledAtEcho = this.traveled - behindPx;
            if (traveledAtEcho < 0) continue;

            const frame = Math.floor(traveledAtEcho / TRAIL_ECHO_SPACING_PX) % TRAIL_FRAME_COUNT;
            const echoX = this.centerX - this.direction * behindPx;

            ctx.save();
            ctx.globalAlpha = 1 - i / (TRAIL_ECHO_COUNT + 1);
            ctx.translate(echoX, this.centerY);
            ctx.rotate(traveledAtEcho * ROTATION_PER_PX * this.direction);
            ctx.drawImage(
                this.trailSprite,
                frame * TRAIL_SOURCE_FRAME_SIZE, 0, TRAIL_SOURCE_FRAME_SIZE, TRAIL_SOURCE_FRAME_SIZE,
                -TRAIL_RENDER_SIZE / 2, -TRAIL_RENDER_SIZE / 2, TRAIL_RENDER_SIZE, TRAIL_RENDER_SIZE
            );
            ctx.restore();
        }
    }
}
