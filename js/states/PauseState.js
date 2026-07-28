import { State } from './State.js';
import { Panel } from '../ui/Panel.js';
import { buildSettingsBody, wireSettingsPanel } from '../ui/SettingsPanel.js';

// Pushed on top of whatever's currently running (GameState/BossState, see
// StateMachine.js's push()/pop()) rather than replacing it - the state
// underneath keeps its own entities/timers exactly as they were and keeps
// rendering its last frame behind this panel, only this state's update()
// runs while it's current. The top-level Paused choices stay
// non-dismissible (no backdrop/×/Panel-Escape) - Escape here always means
// "unpause", handled explicitly below via pop() instead of Panel's own
// window-level Escape listener, same reasoning GameState's old buff-choice
// panel used (closeOnEscape: false) to avoid two things reacting to the
// same keypress. Settings (_openSettings()) reuses the same Panel instance
// and the same content/wiring as MenuState's own Settings (SettingsPanel.js)
// - dismissible via ×/backdrop back to the Paused choices (onClose), but
// closeOnEscape: false too, so Escape still only ever means "fully unpause"
// via update() below, never "go back one level" - one Escape behavior for
// the whole state, no race between Panel's own listener and this state's.
export class PauseState extends State {
    enter() {
        this.panel = new Panel(this.game.overlay);
        this._showChoices();
    }

    /**
     * The Paused choices (Resume/Settings/Main Menu) - also where Settings'
     * own onClose (see _openSettings()) returns to.
     */
    _showChoices() {
        this.panel.openChoices('Paused', [
            { id: 'resume', label: 'Resume', onClick: () => this.game.stateMachine.pop() },
            { id: 'settings', label: 'Settings', onClick: () => this._openSettings() },
            { id: 'menu', label: 'Main Menu', onClick: () => this.game.stateMachine.change('menu') },
        ], { dismissible: false });
    }

    /**
     * Same Settings content/wiring as MenuState's own - dismissible back to
     * _showChoices() via ×/backdrop, not Escape (see top-of-file note).
     */
    _openSettings() {
        this.panel.open('Settings', buildSettingsBody(this.game), {
            dismissible: true,
            closeOnEscape: false,
            onClose: () => this._showChoices(),
            onMount: (root) => wireSettingsPanel(root, this.game),
        });
    }

    exit() {
        this.panel.close();
    }

    /**
     * @param {number} dt - Unused, kept for the State/StateMachine contract.
     */
    update(dt) {
        if (this.game.input.consumePausePress()) this.game.stateMachine.pop();
    }
}
