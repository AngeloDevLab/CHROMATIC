import { State } from './State.js';
import { LevelSession } from './LevelSession.js';

// A normal (non-boss) level - thin wrapper around LevelSession, which owns
// everything the level actually needs (Level/Collision/Camera/ColorZone/
// Player/enemies/HUD/interactables/combat resolution). BossState.js
// constructs the same LevelSession and adds its own extras (boss HP bar,
// arena-sized buffer) on top - this class has nothing level-type-specific
// left in it.
export class GameState extends State {
    /**
     * @param {{chapterId: string, level: number}} params - Forwarded to LevelSession.
     */
    enter(params) {
        this.session = new LevelSession(this.game, params);
    }

    exit() {
        this.session.destroy();
    }

    /**
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.session.update(dt);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this.session.render(ctx);
    }
}
