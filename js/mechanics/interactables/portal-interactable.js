import { Portal } from '../../entities/portal.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './interact-prompt.js';

// Level-end portal - locked until every enemy is dead, then interactable via
// [E] in range. Not every level places one in Tiled, hence the null-tolerant
// this._portal checks throughout.
export class PortalInteractable {
    /**
     * Builds the portal (if the level has one) and its prompt element.
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its ExitPortal marker.
     * @param {Player} player - For proximity/range checks.
     * @param {object} options - Construction settings.
     * @param {string} options.greyFilterCSS - CSS filter matching the terrain's unrevealed grey treatment.
     * @param {number} options.revealRadius - LevelSession's PLAYER_REVEAL_RADIUS.
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
     * Builds the Portal entity from the level's ExitPortal marker, if any.
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its ExitPortal marker.
     * @param {string} greyFilterCSS - CSS filter matching the terrain's unrevealed grey treatment.
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
     * Advances the portal's animation, if it has one.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        this._portal?.update(dt);
    }

    /**
     * Locked until levelFullyRevealed (all enemies dead).
     * @param {Camera} camera - Camera to position the prompt against.
     * @param {boolean} interactPressed - Whether Interact was pressed this frame.
     * @param {boolean} levelFullyRevealed - Whether every enemy in the level is dead.
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
     * Checks whether the player can currently interact with the open portal.
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
     * Draws the portal, if it has one.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
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
