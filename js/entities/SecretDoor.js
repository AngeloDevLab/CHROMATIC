import { Entity } from './Entity.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

/**
 * docs/GDD/02_game-structure.md 2.5: "Costs 50 Shield/Prisma to open... the
 * player pays with their own color energy". Read directly here rather than
 * exported from Combat.js - this isn't a combat cost, just happens to
 * share the same currency.
 */
export const SECRET_DOOR_PRISMA_COST = 50;

// Secret Room entrance (Lvl 5) - same closed -> opening -> open lifecycle and
// color-mechanic participation (greyFilterCSS/revealed) as Portal.js, but
// gated on the player affording the Prisma cost above instead of "all
// enemies dead". GameState owns the actual Prisma-spend + interact-range
// logic (see _updateSecretDoor()), this class only tracks/renders state -
// same split of responsibility as Portal.js.
export class SecretDoor extends Entity {
    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} width - Width from the Tiled object.
     * @param {number} height - Height from the Tiled object.
     * @param {{closed: HTMLImageElement, open: HTMLImageElement, opens: HTMLImageElement, opensFrameCount: number, opensFps: number}} sprites
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
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this.state !== 'opening') return;

        this.opensAnimation.update(dt);
        if (this.opensAnimation.finished) this.state = 'open';
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
            const sprite = this.state === 'open' ? this.sprites.open : this.sprites.closed;
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}
