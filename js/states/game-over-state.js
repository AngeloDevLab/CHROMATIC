// Non-dismissible (no Resume) - Retry/Main Menu both call change() instead of pop(), unwinding
// this state and the dead session beneath it together.

import { State } from './state.js';
import { Panel } from '../ui/panel.js';
import { isBossLevel } from './level-session.js';

/** The Game Over screen, pushed once the dead GameState/BossState's death sequence finishes. */
export class GameOverState extends State {
    /**
     * Re-derives boss-vs-normal routing for Retry via isBossLevel(), since
     * there's no other signal to tell the two apart by the time this shows.
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
