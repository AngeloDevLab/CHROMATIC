import { Entity } from './entity.js';

/**
 * thrown-sword.png is 32x64 (narrow, portrait) - hitbox/render size
 * matches the sprite's native resolution instead of squashing it into a square.
 */
const projectile_width = 32;
const projectile_height = 64;
const projectile_speed = 400;

/**
 * Despawns after traveling this far without hitting anything.
 */
const max_travel_px = 300;

/**
 * How far each swept sub-step advances before re-checking for a solid tile;
 * the X-axis collision check is disabled for one-way levels, so this sweeps manually.
 */
const sweep_step_px = 4;

/**
 * Continuous spin for a "thrown blade" look - thrown-sword.png is a single
 * static image (no sprite sheet), so this is the only motion cue on it.
 */
const rotation_per_px = 0.15;

/**
 * Ghost-trail echoes rendered behind the blade using thrown-sword-trail.png
 * (192x24, 8 frames of 24x24). Echo spacing/frame are derived from distance
 * traveled rather than a timer.
 */
const trail_source_frame_size = 24;
const trail_render_size = 64;
const trail_frame_count = 8;
const trail_echo_spacing_px = 14;
const trail_echo_count = 3;

/** The player's thrown-sword projectile: a straight, level throw with a spinning blade and ghost trail. */
export class Projectile extends Entity {
    /**
     * Spawns a thrown-sword projectile traveling in one direction.
     * @param {number} spawnCenterX - Spawn center X, not top-left.
     * @param {number} spawnCenterY - Spawn center Y.
     * @param {1|-1} direction - Travel direction.
     * @param {HTMLImageElement} sprite - Blade sprite.
     * @param {number} damage - Damage dealt on hit.
     * @param {HTMLImageElement} trailSprite - Motion-blur trail sprite sheet.
     */
    constructor(spawnCenterX, spawnCenterY, direction, sprite, damage, trailSprite) {
        super(spawnCenterX - projectile_width / 2, spawnCenterY - projectile_height / 2, projectile_width, projectile_height);
        this.direction = direction;
        this.vx = direction * projectile_speed;
        this.sprite = sprite;
        this.trailSprite = trailSprite;
        this.damage = damage;
        this.traveled = 0;
        this.dead = false;
    }

    /**
     * Sweeps forward in small steps, checking for a solid tile at each one.
     * @param {number} dt - Elapsed time in seconds.
     * @param {Collision} collision - Level collision to check against.
     */
    update(dt, collision) {
        const totalDx = this.vx * dt;
        const steps = Math.max(1, Math.ceil(Math.abs(totalDx) / sweep_step_px));
        const stepDx = totalDx / steps;

        for (let i = 0; i < steps; i++) {
            if (this._sweepStep(stepDx, collision)) return;
        }
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
     * Draws the spinning blade and its trail echoes.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.dead) return;

        this._renderTrail(ctx);

        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.rotate(this.traveled * rotation_per_px * this.direction);
        if (this.direction === -1) ctx.scale(-1, 1);
        ctx.drawImage(this.sprite, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    /**
     * Draws the ghost-trail echoes, farthest first so the nearest (most
     * opaque) one paints on top.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderTrail(ctx) {
        if (!this.trailSprite) return;

        for (let i = trail_echo_count; i >= 1; i--) {
            this._renderEcho(ctx, i);
        }
    }

    /**
     * Draws one trail echo at position `i` behind the blade, skipping it if
     * that position is behind the blade's start.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {number} i - Echo index, 1 (nearest) to trail_echo_count (farthest).
     */
    _renderEcho(ctx, i) {
        const behindPx = i * trail_echo_spacing_px;
        const traveledAtEcho = this.traveled - behindPx;
        if (traveledAtEcho < 0) return;

        const frame = Math.floor(traveledAtEcho / trail_echo_spacing_px) % trail_frame_count;
        const echoX = this.centerX - this.direction * behindPx;
        this._drawEchoFrame(ctx, i, frame, echoX, traveledAtEcho);
    }

    /**
     * Draws one echo frame at its world position and rotation.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {number} i - Echo index, 1 (nearest) to trail_echo_count (farthest).
     * @param {number} frame - Trail sprite frame to draw.
     * @param {number} echoX - World X to center this echo at.
     * @param {number} traveledAtEcho - Distance traveled at this echo's position, in pixels.
     */
    _drawEchoFrame(ctx, i, frame, echoX, traveledAtEcho) {
        ctx.save();
        ctx.globalAlpha = 1 - i / (trail_echo_count + 1);
        ctx.translate(echoX, this.centerY);
        ctx.rotate(traveledAtEcho * rotation_per_px * this.direction);
        ctx.drawImage(
            this.trailSprite,
            frame * trail_source_frame_size, 0, trail_source_frame_size, trail_source_frame_size,
            -trail_render_size / 2, -trail_render_size / 2, trail_render_size, trail_render_size
        );
        ctx.restore();
    }
}
