import { State } from './State.js';
import { Panel } from '../ui/Panel.js';
import { isBossLevel } from './LevelSession.js';

// Pushed on top of the dead GameState/BossState once its death sequence
// finishes (see LevelSession.update()'s deathSequence check) - same overlay
// shape as PauseState.js, but with no way back into the session underneath:
// there's no Resume, Retry/Main Menu both call change() instead of pop(),
// which unwinds this state and the dead session beneath it together (see
// StateMachine.js's change()/_exitStack()). Non-dismissible, no update()
// override - unlike Pause, Escape does nothing here (there's no gameplay
// left to freeze/unfreeze), the player has to pick one of the two buttons.
export class GameOverState extends State {
    /**
     * Retry's boss-vs-normal routing is re-checked rather than assumed -
     * this death may itself have happened inside BossState, which routes
     * here identically to GameState (see LevelSession.update()), so there's
     * no other signal left to tell the two apart by the time this shows.
     * @param {{chapterId: string, level: number}} params - Level to retry, forwarded from the dead session.
     */
    enter({ chapterId, level } = {}) {
        this.panel = new Panel(this.game.overlay);
        this.panel.openChoices('Game Over', [
            {
                id: 'retry',
                label: 'Retry',
                onClick: () => {
                    const target = isBossLevel(this.game.assets, level) ? 'boss' : 'game';
                    this.game.stateMachine.change(target, { chapterId, level });
                },
            },
            { id: 'menu', label: 'Main Menu', onClick: () => this.game.stateMachine.change('menu') },
        ], { dismissible: false });
    }

    /**
     * Closes the Game Over panel.
     */
    exit() {
        this.panel.close();
    }
}
