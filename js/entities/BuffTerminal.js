import { Entity } from './Entity.js';

// The actual buff pickup inside a Secret Room, past the SecretDoor.js
// entrance - a terminal/console, not an altar (session naming correction).
// Deliberately dumb - GameState.js gates whether [E] does anything here at
// all on the door already being open, and drives the buff-choice panel
// itself; this class only tracks "has this already been used" so a player
// can't walk back in and pick a second buff from the same terminal. Size
// comes from the Tiled object itself, same reasoning as
// Trapdoor.js/SecretDoor.js. Single static sprite (buffterminal.png), no
// animation - `used` only dims it, doesn't switch frames.
export class BuffTerminal extends Entity {
    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} width - Width from the Tiled object.
     * @param {number} height - Height from the Tiled object.
     * @param {HTMLImageElement|null} [sprite=null] - Static terminal sprite; falls back to a filled rect if absent.
     */
    constructor(x, y, width, height, sprite = null) {
        super(x, y, width, height);
        this.sprite = sprite;
        this.used = false;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.used ? 0.35 : 1;

        if (this.sprite) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#e0c23f';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}
