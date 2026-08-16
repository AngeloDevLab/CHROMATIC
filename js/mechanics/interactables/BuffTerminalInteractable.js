import { BuffTerminal } from '../../entities/BuffTerminal.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './InteractPrompt.js';

// Buff Terminal (Lvl 5 Gimmick) - interactable once the SecretDoor is open
// (or none is placed) and unused; pushes BuffState rather than granting
// anything directly.
//
// The constructor pre-marks a terminal used if Game.claimedSecretRoomBuffs
// already has this level, since `used` alone doesn't survive a replay's
// fresh LevelSession - without this a replay could offer a second buff
// choice from the same terminal.
//
// updatePrompt() hides its prompt immediately when [E] pushes BuffState,
// since no further update() calls happen afterward to hide it later.
export class BuffTerminalInteractable {
    /**
     * Builds the terminal from the level's BuffTerminal marker, if any.
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its BuffTerminal marker.
     * @param {Player} player - For proximity/range checks.
     * @param {object} options - Construction settings.
     * @param {number} options.levelNumber - This level's number, to key `Game.claimedSecretRoomBuffs`.
     * @param {() => boolean} options.isDoorOpen - SecretDoorInteractable's isOpen getter.
     */
    constructor(game, level, player, { levelNumber, isDoorOpen }) {
        this.game = game;
        this.player = player;
        this._levelNumber = levelNumber;
        this._isDoorOpen = isDoorOpen;

        const spawn = level.getObjectsByType('BuffTerminal')[0];
        this._buffTerminal = spawn
            ? new BuffTerminal(spawn.x, spawn.y, spawn.width, spawn.height, game.assets.getImage('buffterminal'))
            : null;
        if (this._buffTerminal && game.claimedSecretRoomBuffs.has(levelNumber)) {
            this._buffTerminal.used = true;
        }
        this._promptEl = createInteractPrompt(game, '[E] Choose Buff');
    }

    /**
     * Shows the prompt in range and pushes BuffState on interact.
     * @param {Camera} camera - Camera to position the prompt against.
     * @param {boolean} interactPressed - Whether Interact was pressed this frame.
     */
    updatePrompt(camera, interactPressed) {
        if (!this._buffTerminal) return;

        const inRange = this._isDoorOpen() && !this._buffTerminal.used && !this.player.dead
            && Math.hypot(this.player.centerX - this._buffTerminal.centerX, this.player.centerY - this._buffTerminal.centerY) <= INTERACT_RANGE_PX;

        this._promptEl.hidden = !inRange;
        if (inRange) positionInteractPrompt(this._promptEl, camera, this._buffTerminal.centerX, this._buffTerminal.y);

        if (inRange && interactPressed) {
            this._promptEl.hidden = true;
            this.game.stateMachine.push('buff', { player: this.player, buffTerminal: this._buffTerminal, levelNumber: this._levelNumber });
        }
    }

    /**
     * Draws the terminal, if it has one.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this._buffTerminal?.render(ctx);
    }

    /**
     * Tears down the prompt element this class added to the DOM.
     */
    destroy() {
        this._promptEl?.remove();
    }
}
