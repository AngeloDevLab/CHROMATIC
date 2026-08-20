import { VfxEffect } from '../entities/vfx-effect.js';
import { buildVfxAnimation } from '../entities/character-animations.js';

/**
 * How often a footstep plays while running - first-guess, needs a real ear
 * against the running animation's own cadence.
 */
const footstep_interval_seconds = 0.40;

/** Player's ground-contact smoke VFX and action SFX (attack swoosh, footsteps). */
export class PlayerFx {
    /**
     * Sets up an empty VFX pool and action-SFX tracking state.
     * @param {Game} game - For assets/sound.
     * @param {Player} player - Read for pendingVfx/attacking/grounded/velocityX/dead.
     */
    constructor(game, player) {
        this.game = game;
        this.player = player;
        this.vfx = [];
        this._wasAttacking = false;
        this._footstepTimer = 0;
    }

    /**
     * Spawns new VFX, advances/prunes the pool, and updates action SFX.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    update(deltaTime) {
        this._drainPendingVfx();
        for (const vfx of this.vfx) vfx.update(deltaTime);
        this.vfx = this.vfx.filter((vfx) => !vfx.dead);
        this._updateActionSfx(deltaTime);
    }

    /**
     * Each pendingVfx key doubles as an SFX key of the same name (SoundManager.playSfx() is fail-soft).
     */
    _drainPendingVfx() {
        const feetY = this.player.y + this.player.height;
        for (const key of this.player.pendingVfx) {
            this.vfx.push(new VfxEffect(this.player.centerX, feetY, buildVfxAnimation(this.game.assets, key)));
            this.game.sound.playSfx(key);
        }
        this.player.pendingVfx.length = 0;
    }

    /**
     * Attack's swing sound and the running footstep loop - neither has a matching VfxEffect.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _updateActionSfx(deltaTime) {
        if (this.player.attacking && !this._wasAttacking) this.game.sound.playSfx('swoosh');
        this._wasAttacking = this.player.attacking;
        this._updateFootstepSfx(deltaTime);
    }

    /**
     * Repeats every footstep_interval_seconds while actually running under
     * control. Resets so the next step fires immediately once running starts again.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _updateFootstepSfx(deltaTime) {
        const running = this.player.grounded && !this.player.dead && !this.player.attacking && this.player.velocityX !== 0;
        if (!running) {
            this._footstepTimer = 0;
            return;
        }
        this._footstepTimer -= deltaTime;
        if (this._footstepTimer > 0) return;
        this.game.sound.playSfx('footsteps');
        this._footstepTimer = footstep_interval_seconds;
    }

    /**
     * Draws every active VFX.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        for (const vfx of this.vfx) vfx.render(ctx);
    }
}
