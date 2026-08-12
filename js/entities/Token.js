import { Entity } from './Entity.js';

const SIZE = 48;
const GRAVITY = 700;
const BOB_AMPLITUDE_PX = 4;
const BOB_SPEED = 3;

// Dropped at a boss's death position once it's defeated (see
// Interactables.js's onBossDefeated()) - falls under gravity onto the floor
// below it, then bobs gently in place until collected. A plain proximity
// pickup, no [E] prompt - collected the instant the player's hitbox
// overlaps it (Interactables.js's _updateToken()).
export class Token extends Entity {
    /**
     * @param {number} centerX - Boss's centerX at time of death.
     * @param {number} centerY - Boss's centerY at time of death.
     * @param {HTMLImageElement} sprite - Static token sprite.
     */
    constructor(centerX, centerY, sprite) {
        super(centerX - SIZE / 2, centerY - SIZE / 2, SIZE, SIZE);
        this.sprite = sprite;
        this._landed = false;
        this._bobTimer = 0;
        this._restY = 0;
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     * @param {Collision} collision - For falling onto the level's floor.
     */
    update(dt, collision) {
        if (!this._landed) {
            this._fall(dt, collision);
            return;
        }
        this._bobTimer += dt;
        this.y = this._restY + Math.sin(this._bobTimer * BOB_SPEED) * BOB_AMPLITUDE_PX;
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     * @param {Collision} collision - For falling onto the level's floor.
     */
    _fall(dt, collision) {
        this.vy += GRAVITY * dt;
        this._landed = collision.resolve(this, dt);
        if (this._landed) this._restY = this.y;
    }

    /**
     * Draws below its native 64x64 (SIZE), with imageSmoothingEnabled off so the downscale stays crisp.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
