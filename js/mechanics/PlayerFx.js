import { VfxEffect } from '../entities/VfxEffect.js';
import { buildVfxAnimation } from '../entities/CharacterAnimations.js';

/**
 * How often a footstep plays while running - first-guess, needs a real ear
 * against the running animation's own cadence.
 */
const FOOTSTEP_INTERVAL_SECONDS = 0.40;

// Player's ground-contact smoke (jump/landing/dash) and action SFX (attack
// swoosh, footsteps) - extracted out of LevelSession.js since it's a fully
// self-contained subsystem, only ever touching the player, its own VfxEffect
// pool, and the sound bus.
export class PlayerFx {
    /**
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
     * @param {number} dt
     */
    update(dt) {
        this._drainPendingVfx();
        for (const vfx of this.vfx) vfx.update(dt);
        this.vfx = this.vfx.filter((vfx) => !vfx.dead);
        this._updateActionSfx(dt);
    }

    /**
     * Each pendingVfx key doubles as an SFX key of the same name
     * (SoundManager.playSfx() is fail-soft, so this is safe even for a key
     * with no sound file loaded yet).
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
     * Attack's swing sound and the running footstep loop - neither has a
     * matching VfxEffect, so they're kept separate from _drainPendingVfx().
     * @param {number} dt
     */
    _updateActionSfx(dt) {
        if (this.player.attacking && !this._wasAttacking) this.game.sound.playSfx('swoosh');
        this._wasAttacking = this.player.attacking;
        this._updateFootstepSfx(dt);
    }

    /**
     * Repeats every FOOTSTEP_INTERVAL_SECONDS while actually running under
     * control - resets so the very next step fires immediately once running
     * starts again, rather than waiting out a stale interval.
     * @param {number} dt
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
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        for (const vfx of this.vfx) vfx.render(ctx);
    }
}
