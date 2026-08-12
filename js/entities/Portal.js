import { Entity } from './Entity.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

/**
 * portal-closed.png/portal-open.png/portal-opens.png are all 128x128
 * (opens is a 10-frame strip, 1280x128).
 */
const SIZE = 128;
const OPENS_FRAME_COUNT = 10;
const OPENS_FPS = 12;

// Marks a level's end (01_core-gameplay-loop.md). Three states: closed ->
// opening (plays portal-opens.png once) -> open, driven by GameState
// flipping `active` once every enemy is dead. Interact range/[E] handling
// lives in GameState; this class only tracks/renders the state.
// greyFilterCSS is GameState's own ColorZone.greyFilterCSS, matching the
// terrain's grey treatment. The portal sits at one fixed world position, so
// a simple one-way `revealed` flag tracks its reveal instead of a real
// per-pixel mechanism.
export class Portal extends Entity {
    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {{closed: HTMLImageElement, open: HTMLImageElement, opens: HTMLImageElement}} sprites
     * @param {string} greyFilterCSS - CSS filter matching the terrain's unrevealed grey treatment.
     */
    constructor(x, y, sprites, greyFilterCSS) {
        super(x, y, SIZE, SIZE);
        this.closedSprite = sprites.closed;
        this.openSprite = sprites.open;
        this.opensAnimation = new SpriteAnimation(sprites.opens, SIZE, SIZE, OPENS_FRAME_COUNT, OPENS_FPS, { loop: false });
        this.active = false;
        this.state = 'closed';
        this.greyFilterCSS = greyFilterCSS;
        this.revealed = false;
    }

    /**
     * Only true once the opening animation has fully played. GameState
     * gates the [E] interact prompt on this rather than on `active` directly.
     * @returns {boolean}
     */
    get isOpen() {
        return this.state === 'open';
    }

    /**
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
