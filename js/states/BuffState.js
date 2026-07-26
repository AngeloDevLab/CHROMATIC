import { State } from './State.js';
import { Panel } from '../ui/Panel.js';

// Secret Room reward (docs/GDD/02_game-structure.md 2.5) - pushed on top of
// GameState from BuffTerminal's interact handler (GameState._updateBuffTerminal()).
// Dismissible (session decision: a player who doesn't want to choose right
// now can back out with ×/backdrop/Escape) since the terminal itself has no
// cost of its own and stays unused, so they can just walk up and try again
// later - the Prisma cost was already paid to open the SecretDoor, not this
// choice. Unlike Pause/GameOver, no explicit Escape handling is needed here:
// GameState doesn't tick while this is current (same freeze as those two),
// so there's no competing handler left to race Panel's own dismiss/Escape
// listener - it can just close the panel directly. onClose (fired
// regardless of which of the three dismiss paths - a choice, ×/backdrop, or
// Escape - actually closed it) is the one place that pops the state, so none
// of them have to remember to do it themselves.
export class BuffState extends State {
    /**
     * @param {{player: import('../entities/Player.js').Player, buffTerminal: import('../entities/BuffTerminal.js').BuffTerminal}} params
     */
    enter({ player, buffTerminal }) {
        this._player = player;
        this._buffTerminal = buffTerminal;
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

    exit() {
        this.panel.close();
    }

    /**
     * @param {string} buffId - One of Player.applyBuff()'s recognized buff ids.
     */
    _choose(buffId) {
        this.game.buffs.add(buffId);
        this._player.applyBuff(buffId);
        this._buffTerminal.used = true;
        this.panel.close();
    }
}
