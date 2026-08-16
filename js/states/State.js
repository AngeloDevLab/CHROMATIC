export class State {
    /**
     * Stores the owning Game instance.
     * @param {Game} game - The owning Game instance.
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * Called once when the StateMachine switches to this state. Subclasses
     * build/spawn everything they need here (no persistent state between visits).
     * @param {...*} args - Whatever change() was called with.
     */
    enter() {}

    /**
     * Called once when the StateMachine switches away from this state.
     * Subclasses tear down what enter() built (DOM nodes, listeners, etc.).
     */
    exit() {}

    /**
     * Per-frame logic update. No-op by default; subclasses override.
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {}

    /**
     * Per-frame render. No-op by default; subclasses override.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {}
}
