// Escape always means "fully unpause", never "go back one level" - top-level choices and Settings
// both handle it explicitly via pop() instead of Panel's own listener, so the two never race.

import { State } from './state.js';
import { Panel } from '../ui/panel.js';
import { buildSettingsBody, wireSettingsPanel } from '../ui/settings-panel.js';
import { HowToPlayPanel } from '../ui/how-to-play-panel.js';

/** The Pause menu, pushed on top of whatever's currently running. */
export class PauseState extends State {
    /**
     * Opens the Panel with the initial Paused choices.
     */
    enter() {
        this.panel = new Panel(this.game.overlay);
        this.howToPlayPanel = new HowToPlayPanel(this.panel);
        this._showChoices();
    }

    /**
     * The Paused choices (Resume/Settings/How to Play/Main Menu) - also
     * where Settings'/How to Play's own onClose returns to.
     */
    _showChoices() {
        this.panel.openChoices('Paused', [
            { id: 'resume', label: 'Resume', onClick: () => this.game.stateMachine.pop() },
            { id: 'settings', label: 'Settings', onClick: () => this._openSettings() },
            { id: 'how-to-play', label: 'How to Play', onClick: () => this.howToPlayPanel.open({ closeOnEscape: false, onClose: () => this._showChoices() }) },
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

    /**
     * silent: true so exit doesn't trigger Settings' own onClose, which is
     * only meant for a normal dismiss back to the Paused choices, not a
     * full teardown.
     */
    exit() {
        this.panel.close({ silent: true });
    }

    /**
     * Unpauses on a Pause press.
     * @param {number} dt - Unused, kept for the State/StateMachine contract.
     */
    update(dt) {
        if (this.game.input.consumePausePress()) this.game.stateMachine.pop();
    }
}
