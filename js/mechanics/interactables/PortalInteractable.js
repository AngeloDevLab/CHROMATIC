import { Portal } from '../../entities/Portal.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './InteractPrompt.js';

// Level-end portal (01_core-gameplay-loop.md) - locked until every enemy is
// dead, then interactable via [E] in range. Not every level places one in
// Tiled, hence the null-tolerant this._portal checks throughout.
export class PortalInteractable {
    /**
     * @param {Game} game
     * @param {Level} level
     * @param {Player} player
     * @param {object} options
     * @param {string} options.greyFilterCSS
     * @param {number} options.revealRadius
     * @param {() => void} options.onComplete - Called when the player exits through the completed level's portal.
     */
    constructor(game, level, player, { greyFilterCSS, revealRadius, onComplete }) {
        this.game = game;
        this.player = player;
        this._revealRadius = revealRadius;
        this._onComplete = onComplete;
        this._portal = this._buildPortal(game, level, greyFilterCSS);
        this._promptEl = createInteractPrompt(game, '[E] Exit Level');
    }

    /**
     * @param {Game} game
     * @param {Level} level
     * @param {string} greyFilterCSS
     * @returns {Portal|null}
     */
    _buildPortal(game, level, greyFilterCSS) {
        const spawn = level.getObjectsByType('ExitPortal')[0];
        if (!spawn) {
            console.warn('PortalInteractable: no ExitPortal object in this level - it can\'t be completed.');
            return null;
        }
        return new Portal(spawn.x, spawn.y, {
            closed: game.assets.getImage('portal-closed'),
            open: game.assets.getImage('portal-open'),
            opens: game.assets.getImage('portal-opens'),
        }, greyFilterCSS);
    }

    /**
     * Marks the portal revealed outright.
     */
    markRevealed() {
        if (this._portal) this._portal.revealed = true;
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        this._portal?.update(dt);
    }

    /**
     * Locked until levelFullyRevealed (all enemies dead).
     * @param {Camera} camera
     * @param {boolean} interactPressed
     * @param {boolean} levelFullyRevealed
     */
    updatePrompt(camera, interactPressed, levelFullyRevealed) {
        if (!this._portal) return;
        this._portal.active = levelFullyRevealed;
        this._updateRevealed();

        const inRange = this._isInRange();
        this._promptEl.hidden = !inRange;
        if (inRange) positionInteractPrompt(this._promptEl, camera, this._portal.centerX, this._portal.y);
        if (inRange && interactPressed) this._completeLevel();
    }

    /**
     * Marks the portal revealed once the player gets within reveal range.
     */
    _updateRevealed() {
        if (this._portal.revealed) return;
        const dist = Math.hypot(this.player.centerX - this._portal.centerX, this.player.visualCenterY - this._portal.centerY);
        if (dist <= this._revealRadius) this._portal.revealed = true;
    }

    /**
     * @returns {boolean}
     */
    _isInRange() {
        return this._portal.isOpen && !this.player.dead
            && Math.hypot(this.player.centerX - this._portal.centerX, this.player.centerY - this._portal.centerY) <= INTERACT_RANGE_PX;
    }

    /**
     * Plays the portal SFX and notifies the caller the level is complete.
     */
    _completeLevel() {
        this.game.sound.playSfx('portal');
        this._onComplete();
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        this._portal?.render(ctx);
    }

    /**
     * Tears down the prompt element this class added to the DOM.
     */
    destroy() {
        this._promptEl?.remove();
    }
}
