const KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
    ArrowDown: 'duck', KeyS: 'duck',
};

export class InputHandler {
    constructor(canvas) {
        this.actions = { left: false, right: false, jump: false, duck: false };
        // Attack is a discrete click, not a held state like the movement keys -
        // tracked separately as an edge-triggered flag consumed (and cleared) by
        // consumeAttackPress(), so a click fires the swing exactly once instead of
        // every frame the mouse button happens to still be down.
        this._attackPressed = false;

        // Same edge-triggered pattern as attack - Escape toggles pause once per
        // press instead of every frame it happens to still be held.
        this._pausePressed = false;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        // Scoped to the game canvas, not window - a click on a UI button
        // (worldmap "Start Level", menu panels, ...) would otherwise also queue
        // up an attack that fires the instant GameState's Player exists on the
        // very next frame, since nothing had consumed it yet.
        canvas.addEventListener('mousedown', this._onMouseDown);
    }

    _onKeyDown(e) {
        if (e.code === 'Escape') {
            this._pausePressed = true;
            return;
        }

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

    // Discards a stale click queued up from a previous screen (e.g. clicking
    // the Worldmap background, which also fires this same canvas-scoped
    // mousedown) so it doesn't fire an attack the instant a new Player exists.
    clearAttackPress() {
        this._attackPressed = false;
    }

    consumePausePress() {
        if (!this._pausePressed) return false;
        this._pausePressed = false;
        return true;
    }

    // Same reasoning as clearAttackPress() - an Escape press from a previous
    // screen shouldn't instantly pause the very next GameState.
    clearPausePress() {
        this._pausePressed = false;
    }
}
