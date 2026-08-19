import { Entity } from './entity.js';

const size = 64;

/** The post-boss Merchant: just draws its static sprite, spawned once its Tokens are collected. */
export class Merchant extends Entity {
    /**
     * Creates a merchant sprite at a fixed position.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Static merchant sprite.
     */
    constructor(x, y, sprite) {
        super(x, y, size, size);
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
