import { Entity } from '../entity.js';
import { SpriteAnimation } from '../../utils/sprite-animation.js';

// shooter-projectile.png is a baked spin-cycle strip, unlike the player's
// code-spun thrown-sword.png - kept as its own simpler class rather than folded into projectile.js.
const FRAME_SIZE = 64;
const FRAME_COUNT = 8;
const FPS = 16;

/**
 * The sprite's actual dot only fills a fraction of its frame; render size
 * stays FRAME_SIZE, only the hitbox shrinks.
 */
const HITBOX_SIZE = 28;

/**
 * Paired with shooter.js's own shot-cooldown.
 */
const SPEED = 180;

/**
 * A bit more than shooter.js's own SHOOTER_RANGE_PX (260).
 */
const MAX_TRAVEL_PX = 300;

/**
 * Same tunneling-prevention approach as projectile.js - small enough that a
 * fast shot can't skip through a thin wall in one frame.
 */
const SWEEP_STEP_PX = 4;

export class ShooterProjectile extends Entity {
    /**
     * Spawns a projectile traveling in one direction.
     * @param {number} spawnCenterX - Spawn center X.
     * @param {number} spawnCenterY - Spawn center Y.
     * @param {1|-1} direction - Travel direction.
     * @param {HTMLImageElement} sprite - Spin-cycle sprite strip; gets its own SpriteAnimation instance (not shared).
     * @param {number} damage - Damage dealt on hit.
     */
    constructor(spawnCenterX, spawnCenterY, direction, sprite, damage) {
        super(spawnCenterX - HITBOX_SIZE / 2, spawnCenterY - HITBOX_SIZE / 2, HITBOX_SIZE, HITBOX_SIZE);
        this.direction = direction;
        this.vx = direction * SPEED;
        this.damage = damage;
        this.traveled = 0;
        this.dead = false;
        this.spin = new SpriteAnimation(sprite, FRAME_SIZE, FRAME_SIZE, FRAME_COUNT, FPS);
    }

    /**
     * Sweeps forward in small steps, checking for a solid tile at each one.
     * @param {number} dt - Elapsed time in seconds.
     * @param {Collision} collision - Level collision to check against.
     */
    update(dt, collision) {
        const totalDx = this.vx * dt;
        const steps = Math.max(1, Math.ceil(Math.abs(totalDx) / SWEEP_STEP_PX));
        const stepDx = totalDx / steps;

        for (let i = 0; i < steps; i++) {
            if (this._sweepStep(stepDx, collision)) return;
        }

        this.spin.update(dt);
    }

    /**
     * Advances one sub-step and checks for a wall hit or max-travel despawn.
     * @param {number} stepDx - This sub-step's X delta.
     * @param {Collision} collision - Level collision to check against.
     * @returns {boolean} Whether the projectile died this step.
     */
    _sweepStep(stepDx, collision) {
        const leadingEdgeX = this.direction > 0 ? this.x + this.width + stepDx : this.x + stepDx;
        if (collision.isSolidAt(leadingEdgeX, this.centerY)) {
            this.dead = true;
            return true;
        }

        this.x += stepDx;
        this.traveled += Math.abs(stepDx);
        if (this.traveled >= MAX_TRAVEL_PX) {
            this.dead = true;
            return true;
        }
        return false;
    }

    /**
     * Draws the spin animation, mirrored horizontally for leftward travel.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.dead) return;

        const renderX = this.centerX - FRAME_SIZE / 2;
        const renderY = this.centerY - FRAME_SIZE / 2;

        ctx.save();
        if (this.direction === -1) {
            ctx.translate(renderX + FRAME_SIZE, renderY);
            ctx.scale(-1, 1);
            this.spin.draw(ctx, 0, 0, FRAME_SIZE, FRAME_SIZE);
        } else {
            this.spin.draw(ctx, renderX, renderY, FRAME_SIZE, FRAME_SIZE);
        }
        ctx.restore();
    }
}
