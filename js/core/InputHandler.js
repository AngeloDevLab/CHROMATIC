const KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
    ArrowDown: 'duck', KeyS: 'duck',
};

export class InputHandler {
    constructor() {
        this.actions = { left: false, right: false, jump: false, duck: false };
        // Attack is a discrete click, not a held state like the movement keys -
        // tracked separately as an edge-triggered flag consumed (and cleared) by
        // consumeAttackPress(), so a click fires the swing exactly once instead of
        // every frame the mouse button happens to still be down.
        this._attackPressed = false;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousedown', this._onMouseDown);
    }

    _onKeyDown(e) {
        const action = KEY_MAP[e.code];
        if (action) this.actions[action] = true;
    }

    _onKeyUp(e) {
        const action = KEY_MAP[e.code];
        if (action) this.actions[action] = false;
    }

    _onMouseDown() {
        this._attackPressed = true;
    }

    isDown(action) {
        return !!this.actions[action];
    }

    // Returns true at most once per click - call this every frame regardless of
    // whether the caller is currently able to act on it, so a click during an
    // ongoing attack doesn't queue up and fire late once the swing ends.
    consumeAttackPress() {
        if (!this._attackPressed) return false;
        this._attackPressed = false;
        return true;
    }
}
