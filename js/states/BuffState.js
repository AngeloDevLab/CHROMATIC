import { State } from './State.js';
import { Panel } from '../ui/Panel.js';

// Secret Room reward - pushed on top of GameState from BuffTerminalInteractable's [E] handler.
//
// Dismissible: the terminal stays unused until a buff is chosen, so the
// player can walk away and try again later. No explicit Escape handling is
// needed - GameState doesn't tick while this is current, so nothing
// competes with Panel's own dismiss/Escape listener.
export class BuffState extends State {
    /**
     * Opens the buff-choice panel for the terminal that triggered it.
     * @param {{player: import('../entities/Player.js').Player, buffTerminal: import('../entities/BuffTerminal.js').BuffTerminal, levelNumber: number}} params - Terminal/level state forwarded from BuffTerminalInteractable.
     */
    enter({ player, buffTerminal, levelNumber }) {
        this._player = player;
        this._buffTerminal = buffTerminal;
        this._levelNumber = levelNumber;
        this.panel = new Panel(this.game.overlay);
        this.panel.openChoices('Choose a Buff', [
            { id: 'maxHealth', label: '+20 Max Health', onClick: () => this._choose('maxHealth') },
            { id: 'shieldRegen', label: '+0.5 Shield Regen/s', onClick: () => this._choose('shieldRegen') },
            { id: 'maxShield', label: '+20 Max Shield', onClick: () => this._choose('maxShield') },
        ], {
            dismissible: true,
            onClose: () => this.game.stateMachine.pop(),
        });
    }

    /**
     * Closes the buff-choice panel.
     */
    exit() {
        this.panel.close();
    }

    /**
     * Guards against a buff being applied twice (applyBuff() is additive)
     * even though BuffTerminalInteractable already pre-marks used terminals.
     * @param {string} buffId - One of Player.applyBuff()'s recognized buff ids.
     */
    _choose(buffId) {
        if (this.game.claimedSecretRoomBuffs.has(this._levelNumber)) {
            this.panel.close();
            return;
        }
        this.game.claimedSecretRoomBuffs.add(this._levelNumber);
        this.game.buffs.add(buffId);
        this.game.saveProgress();
        this._player.applyBuff(buffId);
        this._buffTerminal.used = true;
        this.game.sound.playSfx('power-up');
        this.panel.close();
    }
}
