import { BuffTerminal } from '../../entities/BuffTerminal.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './InteractPrompt.js';

// Buff Terminal (Lvl 5 Gimmick) - only interactable once the SecretDoor is
// open (or there simply isn't one placed) and hasn't already been used;
// pushes BuffState (see StateMachine.js's push()) rather than granting
// anything directly. Gated on secretDoor.isOpen, not its own separate
// reveal/color state - it sits inside the room the door already guards.
export class BuffTerminalInteractable {
    /**
     * @param {Game} game
     * @param {Level} level
     * @param {Player} player
     * @param {object} options
     * @param {number} options.levelNumber
     * @param {() => boolean} options.isDoorOpen - SecretDoorInteractable's isOpen getter, so this class doesn't need a direct reference to that instance.
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
        // Already claimed on an earlier visit (Game.claimedSecretRoomBuffs,
        // BuffState.js's _choose()) - start pre-used so replaying this level
        // can't offer (and stack) a second buff choice from the same
        // terminal. `used` alone (BuffTerminal.js's own instance field)
        // doesn't survive a replay's fresh LevelSession on its own.
        if (this._buffTerminal && game.claimedSecretRoomBuffs.has(levelNumber)) {
            this._buffTerminal.used = true;
        }
        this._promptEl = createInteractPrompt(game, '[E] Choose Buff');
    }

    /**
     * @param {Camera} camera
     * @param {boolean} interactPressed
     */
    updatePrompt(camera, interactPressed) {
        if (!this._buffTerminal) return;

        const inRange = this._isDoorOpen() && !this._buffTerminal.used && !this.player.dead
            && Math.hypot(this.player.centerX - this._buffTerminal.centerX, this.player.centerY - this._buffTerminal.centerY) <= INTERACT_RANGE_PX;

        this._promptEl.hidden = !inRange;
        if (inRange) positionInteractPrompt(this._promptEl, camera, this._buffTerminal.centerX, this._buffTerminal.y);

        // Hidden explicitly here, not left to the next frame's inRange check
        // above - pushing BuffState stops this session from getting any more
        // update() calls at all while it's on top, so nothing would
        // otherwise ever hide this again.
        if (inRange && interactPressed) {
            this._promptEl.hidden = true;
            this.game.stateMachine.push('buff', { player: this.player, buffTerminal: this._buffTerminal, levelNumber: this._levelNumber });
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
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
