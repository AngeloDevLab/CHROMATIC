// The fall itself needs no code - the Tiled object sits directly over a genuine gap in the terrain
// layer, so gravity does the work.

import { Entity } from './entity.js';
import { SpriteAnimation } from '../utils/sprite-animation.js';

/** Purely the visual cue for a floor gap: closed -> opening -> gone. */
export class Trapdoor extends Entity {
    /**
     * Creates a closed trapdoor at a fixed position.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} width - Width from the Tiled object.
     * @param {number} height - Height from the Tiled object.
     * @param {{closed: HTMLImageElement, opens: HTMLImageElement, opensFrameCount: number, opensFps: number}} sprites - Closed/opening sprite sheets.
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
        if (this.opensAnimation.finished) this.state = 'gone';
    }

    /**
     * Draws the trapdoor for its current state; renders nothing once gone.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.state === 'gone') return;

        ctx.save();
        if (!this.revealed) ctx.filter = this.greyFilterCSS;

        if (this.state === 'opening') {
            this.opensAnimation.draw(ctx, this.x, this.y, this.width, this.height);
        } else {
            ctx.drawImage(this.sprites.closed, this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}
