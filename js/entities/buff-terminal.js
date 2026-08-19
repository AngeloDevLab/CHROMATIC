import { Entity } from './entity.js';

// The buff pickup inside a Secret Room, past the secret-door.js entrance.
// game-state.js drives the buff-choice panel and gates interaction on the
// door already being open; this class only tracks whether it's been used.
export class BuffTerminal extends Entity {
    /**
     * Creates a buff terminal at a fixed position.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} width - Width from the Tiled object.
     * @param {number} height - Height from the Tiled object.
     * @param {HTMLImageElement} sprite - Static terminal sprite.
     */
    constructor(x, y, width, height, sprite) {
        super(x, y, width, height);
        this.sprite = sprite;
        this.used = false;
    }

    /**
     * Draws the terminal sprite, dimmed once used.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.used ? 0.35 : 1;
        ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
