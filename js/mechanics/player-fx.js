import { VfxEffect } from '../entities/vfx-effect.js';
import { buildVfxAnimation } from '../entities/character-animations.js';

/**
 * How often a footstep plays while running - first-guess, needs a real ear
 * against the running animation's own cadence.
 */
const FOOTSTEP_INTERVAL_SECONDS = 0.40;

// Player's ground-contact smoke (jump/landing/dash) and action SFX (attack
// swoosh, footsteps) - extracted out of level-session.js. Only ever touches
// the player, its own VfxEffect pool, and the sound bus.
export class PlayerFx {
    /**
     * Sets up an empty VFX pool and action-SFX tracking state.
     * @param {Game} game - For assets/sound.
     * @param {Player} player - Read for pendingVfx/attacking/grounded/vx/dead.
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
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        this._drainPendingVfx();
        for (const vfx of this.vfx) vfx.update(dt);
        this.vfx = this.vfx.filter((vfx) => !vfx.dead);
        this._updateActionSfx(dt);
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
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateActionSfx(dt) {
        if (this.player.attacking && !this._wasAttacking) this.game.sound.playSfx('swoosh');
        this._wasAttacking = this.player.attacking;
        this._updateFootstepSfx(dt);
    }

    /**
     * Repeats every FOOTSTEP_INTERVAL_SECONDS while actually running under
     * control. Resets so the next step fires immediately once running starts again.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateFootstepSfx(dt) {
        const running = this.player.grounded && !this.player.dead && !this.player.attacking && this.player.vx !== 0;
        if (!running) {
            this._footstepTimer = 0;
            return;
        }
        this._footstepTimer -= dt;
        if (this._footstepTimer > 0) return;
        this.game.sound.playSfx('footsteps');
        this._footstepTimer = FOOTSTEP_INTERVAL_SECONDS;
    }

    /**
     * Draws every active VFX.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        for (const vfx of this.vfx) vfx.render(ctx);
    }
}
