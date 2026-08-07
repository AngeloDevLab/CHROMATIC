import { Entity } from '../Entity.js';
import { SpriteAnimation } from '../../utils/SpriteAnimation.js';

// shooter-projectile.png is a 512x64 strip, 8 frames of 64x64 - a baked spin
// cycle (unlike the player's thrown_sword.png, a single static image spun via
// code in Projectile.js) - deliberately a separate, simpler class rather than
// bolting a second rendering mode onto Projectile.js, since the two don't
// share much beyond the swept-collision movement below.
const FRAME_SIZE = 64;
const FRAME_COUNT = 8;
const FPS = 16;

/**
 * Paired with Shooter.js's own shot-cooldown so individual shots read as
 * dodgeable rather than a fast, dense stream.
 */
const SPEED = 180;

/**
 * Despawns without a hit past this distance - a bit more than Shooter.js's
 * own SHOOTER_RANGE_PX (260) so it can still reach a player who was in
 * range at the moment of firing but has since drifted slightly farther.
 */
const MAX_TRAVEL_PX = 300;

/**
 * Same tunneling-prevention reasoning as Projectile.js - small enough that
 * a fast shot can't skip through a thin wall in one frame.
 */
const SWEEP_STEP_PX = 4;

export class ShooterProjectile extends Entity {
    /**
     * @param {number} spawnCenterX - Spawn center X.
     * @param {number} spawnCenterY - Spawn center Y.
     * @param {1|-1} direction - Travel direction.
     * @param {HTMLImageElement} sprite - Spin-cycle sprite strip; gets its own
     *   SpriteAnimation instance (not shared, same reasoning as
     *   EnemyFactory.js's "own instance per enemy").
     * @param {number} damage - Damage dealt on hit.
     */
    constructor(spawnCenterX, spawnCenterY, direction, sprite, damage) {
        super(spawnCenterX - FRAME_SIZE / 2, spawnCenterY - FRAME_SIZE / 2, FRAME_SIZE, FRAME_SIZE);
        this.direction = direction;
        this.vx = direction * SPEED;
        this.damage = damage;
        this.traveled = 0;
        this.dead = false;
        this.spin = new SpriteAnimation(sprite, FRAME_SIZE, FRAME_SIZE, FRAME_COUNT, FPS);
    }

    /**
     * Sweeps forward in small steps, checking for a solid tile at each one,
     * so a fast shot can't tunnel through a thin wall in a single frame.
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
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.dead) return;

        ctx.save();
        if (this.direction === -1) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            this.spin.draw(ctx, 0, 0, this.width, this.height);
        } else {
            this.spin.draw(ctx, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}
