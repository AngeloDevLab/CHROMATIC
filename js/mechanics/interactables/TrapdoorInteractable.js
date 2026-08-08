import { Trapdoor } from '../../entities/Trapdoor.js';

/**
 * Lvl 4 Gimmick (docs/GDD/02_game-structure.md 2.6) - how close the
 * player's feet need to be to the Trapdoor's top edge before it starts
 * opening. Small on purpose - it should read as "the ground gives way
 * right as you step on it", not visibly ahead of time.
 */
const TRAPDOOR_TRIGGER_MARGIN_PX = 16;

// Lvl 4 Gimmick - sized to the Tiled object itself (not a fixed sprite size
// like Portal), so it covers exactly the terrain gap it's placed over. No
// [E] prompt, no interact press needed - purely proximity-driven: this is
// the only interactable type with no prompt element at all.
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
     * Horizontally over the trapdoor and close enough above it that it reads
     * as "the ground gives way as you step on it" rather than opening early
     * or late. Trapdoor.trigger() itself no-ops once already opening/open,
     * so calling this every frame while standing over it is harmless.
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
