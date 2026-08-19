// The portal sits at one fixed position, so a one-way revealed flag tracks its color reveal
// instead of a real per-pixel mechanism.

import { Entity } from './entity.js';
import { SpriteAnimation } from '../utils/sprite-animation.js';

/**
 * portal-closed.png/portal-open.png/portal-opens.png are all 128x128
 * (opens is a 10-frame strip, 1280x128).
 */
const size = 128;
const opens_frame_count = 10;
const opens_fps = 12;

/** The level-end portal: tracks/renders its closed/opening/open state. */
export class Portal extends Entity {
    /**
     * Creates a closed portal at a fixed position.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {{closed: HTMLImageElement, open: HTMLImageElement, opens: HTMLImageElement}} sprites - Closed/open/opening sprite sheets.
     * @param {string} greyFilterCSS - CSS filter matching the terrain's unrevealed grey treatment.
     */
    constructor(x, y, sprites, greyFilterCSS) {
        super(x, y, size, size);
        this.closedSprite = sprites.closed;
        this.openSprite = sprites.open;
        this.opensAnimation = new SpriteAnimation(sprites.opens, size, size, opens_frame_count, opens_fps, { loop: false });
        this.active = false;
        this.state = 'closed';
        this.greyFilterCSS = greyFilterCSS;
        this.revealed = false;
    }

    /**
     * True once the opening animation has fully played.
     * @returns {boolean}
     */
    get isOpen() {
        return this.state === 'open';
    }

    /**
     * Advances the portal's state machine and opening animation.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this.active && this.state === 'closed') {
            this.state = 'opening';
            this.opensAnimation.reset();
        }

        if (this.state === 'opening') {
            this.opensAnimation.update(dt);
            if (this.opensAnimation.finished) this.state = 'open';
        }
    }

    /**
     * Draws the portal for its current state, greyed out until revealed.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.save();
        if (!this.revealed) ctx.filter = this.greyFilterCSS;

        if (this.state === 'opening') {
            this.opensAnimation.draw(ctx, this.x, this.y, this.width, this.height);
        } else {
            const sprite = this.state === 'open' ? this.openSprite : this.closedSprite;
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}
