import { Entity } from './Entity.js';

// Lightweight one-shot visual effect (player action smoke: jump/landing/
// dash, see Player.js's pendingVfx mailbox and LevelSession.js's
// _drainPlayerVfx()) - same shape as Projectile.js (own `dead` flag, no
// physics/collision), driven entirely by its own SpriteAnimation. Anchors
// to the animation's own auto-detected ground line (SpriteAnimation's
// groundLineRatio) rather than assuming the artwork sits centered in its frame.
export class VfxEffect extends Entity {
    /**
     * @param {number} groundX - World X to center the effect on.
     * @param {number} groundY - World Y of the ground contact point to anchor the effect's own ground line to.
     * @param {SpriteAnimation} animation - One-shot (loop: false) clip to play.
     * @param {number} [renderSize=64] - Square draw size, in pixels.
     */
    constructor(groundX, groundY, animation, renderSize = 64) {
        const drawY = groundY - animation.groundLineRatio * renderSize;
        super(groundX - renderSize / 2, drawY, renderSize, renderSize);
        this.animation = animation;
        this.dead = false;
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        this.animation.update(dt);
        if (this.animation.finished) this.dead = true;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (this.dead) return;
        this.animation.draw(ctx, this.x, this.y, this.width, this.height);
    }
}
