import { Entity } from './Entity.js';

const SIZE = 64;

// Only ever constructed once the level's boss is dead and its dropped Token
// collected (see Interactables.js's onBossDefeated()/_updateToken()) - this
// class itself just draws the static sprite, all appearance-timing lives in
// Interactables.
export class Merchant extends Entity {
    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Static merchant sprite.
     */
    constructor(x, y, sprite) {
        super(x, y, SIZE, SIZE);
        this.sprite = sprite;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    }
}
