import { Entity } from './entity.js';

const size = 48;
const gravity = 700;
const bob_amplitude_px = 4;
const bob_speed = 3;

/** A boss-drop pickup that falls onto the floor and bobs until the player touches it. */
export class Token extends Entity {
    /**
     * Creates a token centered on the boss's death position.
     * @param {number} centerX - Boss's centerX at time of death.
     * @param {number} centerY - Boss's centerY at time of death.
     * @param {HTMLImageElement} sprite - Static token sprite.
     */
    constructor(centerX, centerY, sprite) {
        super(centerX - size / 2, centerY - size / 2, size, size);
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
        this.y = this._restY + Math.sin(this._bobTimer * bob_speed) * bob_amplitude_px;
    }

    /**
     * Applies gravity and checks for landing.
     * @param {number} dt - Elapsed time in seconds.
     * @param {Collision} collision - For falling onto the level's floor.
     */
    _fall(dt, collision) {
        this.vy += gravity * dt;
        this._landed = collision.resolve(this, dt);
        if (this._landed) this._restY = this.y;
    }

    /**
     * Draws scaled down to size (48px) from the sprite's native 64x64, with imageSmoothingEnabled off to keep the downscale crisp.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
