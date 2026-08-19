import { Entity } from './entity.js';
import { SpriteAnimation } from '../utils/sprite-animation.js';

export const SECRET_DOOR_PRISMA_COST = 50;

// Secret Room entrance; same closed -> opening -> open lifecycle as
// portal.js, but gated on the player affording the Prisma cost instead of
// all enemies dead. GameState owns the actual spend/interact logic - this
// class only tracks/renders state.
export class SecretDoor extends Entity {
    /**
     * Creates a closed secret door at a fixed position.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} width - Width from the Tiled object.
     * @param {number} height - Height from the Tiled object.
     * @param {{closed: HTMLImageElement, open: HTMLImageElement, opens: HTMLImageElement, opensFrameCount: number, opensFps: number}} sprites - Closed/open/opening sprite sheets.
     * @param {string} greyFilterCSS - CSS filter matching the terrain's unrevealed grey treatment.
     */
    constructor(x, y, width, height, sprites, greyFilterCSS) {
        super(x, y, width, height);
        this.sprites = sprites;
        this.opensAnimation = new SpriteAnimation(sprites.opens, width, height, sprites.opensFrameCount, sprites.opensFps, { loop: false });
        this.state = 'closed';
        this.greyFilterCSS = greyFilterCSS;
        this.revealed = false;
    }

    /**
     * True once the door has fully opened.
     * @returns {boolean}
     */
    get isOpen() {
        return this.state === 'open';
    }

    /**
     * Starts the closed -> opening transition; no-op if already triggered.
     */
    trigger() {
        if (this.state !== 'closed') return;
        this.state = 'opening';
        this.opensAnimation.reset();
    }

    /**
     * Advances the opening animation.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this.state !== 'opening') return;

        this.opensAnimation.update(dt);
        if (this.opensAnimation.finished) this.state = 'open';
    }

    /**
     * Draws the door for its current state, greyed out until revealed.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.save();
        if (!this.revealed) ctx.filter = this.greyFilterCSS;

        if (this.state === 'opening') {
            this.opensAnimation.draw(ctx, this.x, this.y, this.width, this.height);
        } else {
            const sprite = this.state === 'open' ? this.sprites.open : this.sprites.closed;
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}
