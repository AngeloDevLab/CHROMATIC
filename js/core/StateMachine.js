// push()/pop() let a state (Pause/GameOver/Buff) stack on top of whatever
// is currently running instead of replacing it - the state underneath
// stays alive and keeps rendering behind the overlay. change() replaces
// the current state entirely, unwinding the whole stack first.
export class StateMachine {
    /**
     * @param {Game} game - The owning Game instance, passed through to states.
     */
    constructor(game) {
        this.game = game;
        this.states = new Map();
        this.current = null;
        this._stack = [];
    }

    /**
     * Registers a state instance under a name so change()/push() can select it later.
     * @param {string} name - Identifier used to select this state.
     * @param {State} state - The state instance to register.
     */
    register(name, state) {
        this.states.set(name, state);
    }

    /**
     * Unwinds the current state and the whole stack beneath it, then enters
     * the named one fresh. Use for an actual replacement, not an overlay.
     * @param {string} name - Name a state was registered under.
     * @param {...*} args - Forwarded to the target state's enter().
     */
    change(name, ...args) {
        this._exitStack();

        const next = this._require(name);
        this.current = next;
        this.current.enter(...args);
    }

    /**
     * Stacks the named state on top of the current one without exiting it.
     * @param {string} name - Name a state was registered under.
     * @param {...*} args - Forwarded to the target state's enter().
     */
    push(name, ...args) {
        const next = this._require(name);
        if (this.current) this._stack.push(this.current);

        this.current = next;
        this.current.enter(...args);
    }

    /**
     * Exits the current (overlay) state and resumes whichever state was beneath it, without re-entering it.
     */
    pop() {
        if (this.current) this.current.exit();
        this.current = this._stack.pop() ?? null;
    }

    /**
     * @param {string} name - Name a state was registered under.
     * @returns {State} The registered state.
     */
    _require(name) {
        const state = this.states.get(name);
        if (!state) throw new Error(`Unknown state: ${name}`);
        return state;
    }

    /**
     * Exits `current` and every state still beneath it on the stack, then clears the stack.
     */
    _exitStack() {
        if (this.current) this.current.exit();
        for (const state of this._stack) state.exit();
        this._stack = [];
    }

    /**
     * Delegates the per-frame update to the current (topmost) state only;
     * anything beneath it on the stack stays frozen.
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.current?.update(dt);
    }

    /**
     * Renders the whole stack bottom-to-top, then `current` last.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        for (const state of this._stack) state.render(ctx);
        this.current?.render(ctx);
    }
}
