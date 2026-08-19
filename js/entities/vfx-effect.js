// Anchors to the animation's auto-detected ground line rather than assuming the artwork sits
// centered in its frame.

import { Entity } from './entity.js';

/** A lightweight one-shot visual effect (e.g. jump/landing/dash smoke), driven entirely by its SpriteAnimation. */
export class VfxEffect extends Entity {
    /**
     * Creates a VFX clip anchored to a ground contact point.
     * @param {number} groundX - World X to center the effect on.
     * @param {number} groundY - World Y of the ground contact point to anchor the effect's own ground line to.
     * @param {SpriteAnimation} animation - One-shot (loop: false) clip to play.
     * @param {number} [renderSize=64] - Square draw size, in pixels.
     */
    constructor(groundX, groundY, animation, renderSize = 64) {
        const drawY = groundY - animation.groundLineRatio * renderSize;
        super(groundX - renderSize / 2, drawY, renderSize, renderSize);
        this.animation = animation;
        this.dead = false;
    }

    /**
     * Advances the animation and marks itself dead once finished.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        this.animation.update(dt);
        if (this.animation.finished) this.dead = true;
    }

    /**
     * Draws the current animation frame.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.dead) return;
        this.animation.draw(ctx, this.x, this.y, this.width, this.height);
    }
}
