import { Entity } from './entity.js';

const SIZE = 64;

// Only constructed once the level's boss is dead and its Token collected.
// This class just draws the static sprite; appearance-timing lives in interactables.js.
export class Merchant extends Entity {
    /**
     * Creates a merchant sprite at a fixed position.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Static merchant sprite.
     */
    constructor(x, y, sprite) {
        super(x, y, SIZE, SIZE);
        this.sprite = sprite;
    }

    /**
     * Draws the merchant sprite.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    }
}
