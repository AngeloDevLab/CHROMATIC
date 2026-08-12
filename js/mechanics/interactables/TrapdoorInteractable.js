import { Trapdoor } from '../../entities/Trapdoor.js';

/**
 * Lvl 4 Gimmick (docs/GDD/02_game-structure.md 2.6) - how close the
 * player's feet need to be to the Trapdoor's top edge before it opens.
 */
const TRAPDOOR_TRIGGER_MARGIN_PX = 16;

// Lvl 4 Gimmick - sized to the Tiled object itself, not a fixed sprite
// size. No [E] prompt - purely proximity-driven.
export class TrapdoorInteractable {
    /**
     * @param {Game} game
     * @param {Level} level
     * @param {Player} player
     * @param {object} options
     * @param {string} options.greyFilterCSS
     * @param {number} options.revealRadius
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
     * @param {number} dt
     */
    update(dt) {
        if (!this._trapdoor) return;
        this._trapdoor.update(dt);

        if (!this._trapdoor.revealed) {
            const dist = Math.hypot(this.player.centerX - this._trapdoor.centerX, this.player.visualCenterY - this._trapdoor.centerY);
            if (dist <= this._revealRadius) this._trapdoor.revealed = true;
        }

        const horizontallyOver = this.player.centerX >= this._trapdoor.x && this.player.centerX <= this._trapdoor.x + this._trapdoor.width;
        const feetNearTop = Math.abs((this.player.y + this.player.height) - this._trapdoor.y) <= TRAPDOOR_TRIGGER_MARGIN_PX;
        if (horizontallyOver && feetNearTop) this._trapdoor.trigger();
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        this._trapdoor?.render(ctx);
    }
}
