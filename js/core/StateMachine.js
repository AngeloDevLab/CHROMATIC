export class StateMachine {
    constructor(game) {
        this.game = game;
        this.states = new Map();
        this.current = null;
    }

    register(name, state) {
        this.states.set(name, state);
    }

    change(name, ...args) {
        if (this.current) this.current.exit();

        const next = this.states.get(name);
        if (!next) throw new Error(`Unknown state: ${name}`);

        this.current = next;
        this.current.enter(...args);
    }

    update(dt) {
        this.current?.update(dt);
    }

    render(ctx) {
        this.current?.render(ctx);
    }
}
