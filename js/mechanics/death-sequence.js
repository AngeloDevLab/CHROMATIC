// Mirrors triggerFullReveal's victory beat in color-zone.js, but darkens the level instead of
// bursting into color.

import { SpriteAnimation } from '../utils/sprite-animation.js';

export const GHOST_FRAME_SIZE = 64;
const ghost_rise_speed = 25;
const ghost_fade_duration_seconds = 2.5;

/** The float-and-fade ghost shown once the player's death animation finishes. */
export class DeathSequence {
    /**
     * Sets up the ghost animation and inactive default state.
     * @param {HTMLImageElement} ghostImage - Ghost sprite sheet.
     */
    constructor(ghostImage) {
        this.ghostAnimation = new SpriteAnimation(ghostImage, GHOST_FRAME_SIZE, GHOST_FRAME_SIZE, 13, 10);
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.elapsed = 0;
        this._reportedFinished = false;
    }

    /**
     * Activates the ghost at the death spot, resetting its animation.
     * @param {number} x - World X of the death spot.
     * @param {number} y - World Y of the death spot.
     */
    start(x, y) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.elapsed = 0;
        this._reportedFinished = false;
        this.ghostAnimation.reset();
    }

    /**
     * Rises and ages the ghost.
     * @param {number} dt - Elapsed time in seconds.
     * @returns {boolean} True exactly once, the frame the fade-out completes.
     */
    update(dt) {
        this.elapsed += dt;
        this.y -= ghost_rise_speed * dt;
        this.ghostAnimation.update(dt);

        if (!this._reportedFinished && this.elapsed >= ghost_fade_duration_seconds) {
            this._reportedFinished = true;
            return true;
        }
        return false;
    }

    /**
     * Draws the ghost, fading out as it ages.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        const alpha = Math.max(0, 1 - this.elapsed / ghost_fade_duration_seconds);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        this.ghostAnimation.draw(
            ctx,
            this.x - GHOST_FRAME_SIZE / 2,
            this.y - GHOST_FRAME_SIZE / 2,
            GHOST_FRAME_SIZE,
            GHOST_FRAME_SIZE
        );
        ctx.restore();
    }
}
