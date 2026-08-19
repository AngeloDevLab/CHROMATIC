import { State } from './state.js';
import { LevelSession } from './level-session.js';

/** A normal (non-boss) level - a thin wrapper around LevelSession. */
export class GameState extends State {
    /**
     * Builds the level session for the requested level.
     * @param {{chapterId: string, level: number}} params - Forwarded to LevelSession.
     */
    enter(params) {
        this.session = new LevelSession(this.game, params);
    }

    /**
     * Tears down the level session.
     */
    exit() {
        this.session.destroy();
    }

    /**
     * Delegates to the level session's own update.
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.session.update(dt);
    }

    /**
     * Delegates to the level session's own render.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this.session.render(ctx);
    }
}
