import { Trapdoor } from '../../entities/trapdoor.js';

/**
 * How close the player's feet need to be to the Trapdoor's top edge before it opens.
 */
const trapdoor_trigger_margin_px = 16;

/** Triggers the level's Trapdoor purely by proximity, no [E] prompt. */
export class TrapdoorInteractable {
    /**
     * Builds the trapdoor from the level's Trapdoor marker, if any.
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its Trapdoor marker.
     * @param {Player} player - For proximity/trigger checks.
     * @param {object} options - Construction settings.
     * @param {string} options.greyFilterCSS - CSS filter matching the terrain's unrevealed grey treatment.
     * @param {number} options.revealRadius - LevelSession's PLAYER_REVEAL_RADIUS.
     */
    constructor(game, level, player, { greyFilterCSS, revealRadius }) {
        this.player = player;
        this._revealRadius = revealRadius;

        const spawn = level.getObjectsByType('Trapdoor')[0];
        this._trapdoor = spawn
            ? new Trapdoor(spawn.x, spawn.y, spawn.width, spawn.height, {
                closed: game.assets.getImage('trapdoor-closed'),
                opens: game.assets.getImage('trapdoor-opens'),
                opensFrameCount: 10,
                opensFps: 12,
            }, greyFilterCSS)
            : null;
    }

    /**
     * Triggers the trapdoor when the player is horizontally over it and close enough above its top edge.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    update(deltaTime) {
        if (!this._trapdoor) return;
        this._trapdoor.update(deltaTime);

        if (!this._trapdoor.revealed) {
            const dist = Math.hypot(this.player.centerX - this._trapdoor.centerX, this.player.visualCenterY - this._trapdoor.centerY);
            if (dist <= this._revealRadius) this._trapdoor.revealed = true;
        }

        const horizontallyOver = this.player.centerX >= this._trapdoor.x && this.player.centerX <= this._trapdoor.x + this._trapdoor.width;
        const feetNearTop = Math.abs((this.player.y + this.player.height) - this._trapdoor.y) <= trapdoor_trigger_margin_px;
        if (horizontallyOver && feetNearTop) this._trapdoor.trigger();
    }

    /**
     * Draws the trapdoor, if it has one.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this._trapdoor?.render(ctx);
    }
}
