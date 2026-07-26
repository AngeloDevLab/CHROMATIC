import { State } from './State.js';
import { Panel } from '../ui/Panel.js';

// Pushed on top of whatever's currently running (GameState/BossState, see
// StateMachine.js's push()/pop()) rather than replacing it - the state
// underneath keeps its own entities/timers exactly as they were and keeps
// rendering its last frame behind this panel, only this state's update()
// runs while it's current. Non-dismissible (no backdrop/×/Panel-Escape) -
// Escape here means "unpause", handled explicitly below via pop() instead of
// Panel's own window-level Escape listener, same reasoning GameState's old
// buff-choice panel used (closeOnEscape: false) to avoid two things reacting
// to the same keypress.
export class PauseState extends State {
    enter() {
        this.panel = new Panel(this.game.overlay);
        this.panel.openChoices('Paused', [
            { id: 'resume', label: 'Resume', onClick: () => this.game.stateMachine.pop() },
            { id: 'menu', label: 'Main Menu', onClick: () => this.game.stateMachine.change('menu') },
        ], { dismissible: false });
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
