import { Entity } from './entity.js';

const SIZE = 48;
const GRAVITY = 700;
const BOB_AMPLITUDE_PX = 4;
const BOB_SPEED = 3;

// Dropped at a boss's death position; falls under gravity onto the floor,
// then bobs gently until collected. A plain proximity pickup, no [E] prompt -
// collected the instant the player's hitbox overlaps it.
export class Token extends Entity {
    /**
     * Creates a token centered on the boss's death position.
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
     * Falls until landed, then bobs in place.
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
     * Applies gravity and checks for landing.
     * @param {number} dt - Elapsed time in seconds.
     * @param {Collision} collision - For falling onto the level's floor.
     */
    _fall(dt, collision) {
        this.vy += GRAVITY * dt;
        this._landed = collision.resolve(this, dt);
        if (this._landed) this._restY = this.y;
    }

    /**
     * Draws scaled down to SIZE (48px) from the sprite's native 64x64, with imageSmoothingEnabled off to keep the downscale crisp.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
