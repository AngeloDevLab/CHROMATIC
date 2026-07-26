// push()/pop() let a state (Pause/GameOver/Buff) stack on top of whatever is
// currently running instead of replacing it -
// the state underneath never gets exit()/enter()'d, so it stays exactly as
// it was (mid-level position, timers, entities) and keeps rendering its last
// frame behind the overlay. change() is still the right call for an actual
// replacement (Menu/Worldmap/GameState/BossState) - it now also unwinds the
// whole stack first, not just `current`, so nothing pushed earlier leaks
// (e.g. Game Over's "Retry"/"Main Menu" must tear the dead GameState down
// too, not just the Game Over panel on top of it).
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
     * Stacks the named state on top of the current one without exiting it -
     * the current state stays alive underneath (see the class comment above).
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
     * Exits the current (overlay) state and resumes whichever state was
     * beneath it, without re-entering it - it never left.
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
     * Exits `current` and every state still beneath it on the stack, then
     * clears the stack - see change()'s own comment for why this has to
     * unwind the whole thing instead of just the top.
     */
    _exitStack() {
        if (this.current) this.current.exit();
        for (const state of this._stack) state.exit();
        this._stack = [];
    }

    /**
     * Delegates the per-frame update to the current (topmost) state only -
     * anything beneath it on the stack stays frozen, same as today's
     * per-state `paused` early-return but generalized.
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.current?.update(dt);
    }

    /**
     * Renders the whole stack bottom-to-top, then `current` last - so a
     * pushed overlay (Pause/GameOver/Buff) draws on top of the frozen state
     * it was pushed over, instead of that state disappearing behind it.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        for (const state of this._stack) state.render(ctx);
        this.current?.render(ctx);
    }
}
