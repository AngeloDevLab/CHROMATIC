import { SpriteAnimation } from '../utils/SpriteAnimation.js';

export const GHOST_FRAME_SIZE = 64;
const GHOST_RISE_SPEED = 25;
const GHOST_FADE_DURATION_SECONDS = 2.5;

// Player death (04_health-save-system.md) - float-and-fade ghost, driven by
// GameState once Player.deathAnimationFinished (the fall animation played
// out). Mirrors triggerFullReveal's victory beat in ColorZone.js: instead of
// the level bursting into color, it darkens fully while this rises from the
// death spot and fades out, then GameState opens the Game Over panel once
// update() reports finished.
export class DeathSequence {
    constructor(ghostImage) {
        this.ghostAnimation = new SpriteAnimation(ghostImage, GHOST_FRAME_SIZE, GHOST_FRAME_SIZE, 13, 10);
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.elapsed = 0;
        this._reportedFinished = false;
    }

    start(x, y) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.elapsed = 0;
        this._reportedFinished = false;
        this.ghostAnimation.reset();
    }

    // Returns true exactly once, the frame the fade-out completes - GameState
    // opens the Game Over panel on that edge instead of every frame after.
    update(dt) {
        this.elapsed += dt;
        this.y -= GHOST_RISE_SPEED * dt;
        this.ghostAnimation.update(dt);

        if (!this._reportedFinished && this.elapsed >= GHOST_FADE_DURATION_SECONDS) {
            this._reportedFinished = true;
            return true;
        }
        return false;
    }

    render(ctx) {
        const alpha = Math.max(0, 1 - this.elapsed / GHOST_FADE_DURATION_SECONDS);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        this.ghostAnimation.draw(
            ctx,
            this.x - GHOST_FRAME_SIZE / 2,
            this.y - GHOST_FRAME_SIZE / 2,
            GHOST_FRAME_SIZE,
            GHOST_FRAME_SIZE
        );
        ctx.restore();
    }
}
