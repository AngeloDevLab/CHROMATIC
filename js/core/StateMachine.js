export class StateMachine {
    /**
     * @param {Game} game - The owning Game instance, passed through to states.
     */
    constructor(game) {
        this.game = game;
        this.states = new Map();
        this.current = null;
    }

    /**
     * Registers a state instance under a name so change() can switch to it later.
     * @param {string} name - Identifier used by change() to select this state.
     * @param {State} state - The state instance to register.
     */
    register(name, state) {
        this.states.set(name, state);
    }

    /**
     * Exits the current state (if any) and enters the named one.
     * @param {string} name - Name a state was registered under.
     * @param {...*} args - Forwarded to the target state's enter().
     */
    change(name, ...args) {
        if (this.current) this.current.exit();

        const next = this.states.get(name);
        if (!next) throw new Error(`Unknown state: ${name}`);

        this.current = next;
        this.current.enter(...args);
    }

    /**
     * Delegates the per-frame update to the current state, if any.
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.current?.update(dt);
    }

    /**
     * Delegates rendering to the current state, if any.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this.current?.render(ctx);
    }
}
