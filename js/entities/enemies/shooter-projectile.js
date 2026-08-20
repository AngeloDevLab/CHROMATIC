import { Entity } from '../entity.js';
import { SpriteAnimation } from '../../utils/sprite-animation.js';

// shooter-projectile.png is a baked spin-cycle strip, unlike the player's
// code-spun thrown-sword.png - kept as its own simpler class rather than folded into projectile.js.
const frame_size = 64;
const frame_count = 8;
const fps = 16;

/**
 * The sprite's actual dot only fills a fraction of its frame; render size
 * stays frame_size, only the hitbox shrinks.
 */
const hitbox_size = 28;

/**
 * Paired with shooter.js's own shot-cooldown.
 */
const speed = 180;

/**
 * A bit more than shooter.js's own SHOOTER_RANGE_PX (260).
 */
const max_travel_px = 300;

/**
 * Same tunneling-prevention approach as projectile.js - small enough that a
 * fast shot can't skip through a thin wall in one frame.
 */
const sweep_step_px = 4;

/** Shooter's fired projectile: sweeps forward for a wall hit, despawning past its max range. */
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
        super(spawnCenterX - hitbox_size / 2, spawnCenterY - hitbox_size / 2, hitbox_size, hitbox_size);
        this.direction = direction;
        this.velocityX = direction * speed;
        this.damage = damage;
        this.traveled = 0;
        this.dead = false;
        this.spin = new SpriteAnimation(sprite, frame_size, frame_size, frame_count, fps);
    }

    /**
     * Sweeps forward in small steps, checking for a solid tile at each one.
     * @param {number} deltaTime - Elapsed time in seconds.
     * @param {Collision} collision - Level collision to check against.
     */
    update(deltaTime, collision) {
        const totalDx = this.velocityX * deltaTime;
        const steps = Math.max(1, Math.ceil(Math.abs(totalDx) / sweep_step_px));
        const stepDx = totalDx / steps;

        for (let i = 0; i < steps; i++) {
            if (this._sweepStep(stepDx, collision)) return;
        }

        this.spin.update(deltaTime);
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
        if (this.traveled >= max_travel_px) {
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

        const renderX = this.centerX - frame_size / 2;
        const renderY = this.centerY - frame_size / 2;

        ctx.save();
        if (this.direction === -1) {
            ctx.translate(renderX + frame_size, renderY);
            ctx.scale(-1, 1);
            this.spin.draw(ctx, 0, 0, frame_size, frame_size);
        } else {
            this.spin.draw(ctx, renderX, renderY, frame_size, frame_size);
        }
        ctx.restore();
    }
}
