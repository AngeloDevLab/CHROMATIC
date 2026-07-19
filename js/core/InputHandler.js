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

        // Edge-triggered jump press, alongside the held state in `actions.jump`
        // (Player.js uses the held state for variable jump height, and this for
        // jump buffering) - guarded against the browser's own keydown auto-repeat
        // in _onKeyDown, or holding the key would re-trigger this every repeat tick.
        this._jumpPressed = false;

        // Same edge-triggered pattern as attack/pause - used for the level-end
        // portal (GameState.js), a discrete "use it" action rather than a held
        // state.
        this._interactPressed = false;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        this._releaseAllActions = this._releaseAllActions.bind(this);
        this._onVisibilityChange = this._onVisibilityChange.bind(this);

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        // Scoped to the game canvas, not window - a click on a UI button
        // (worldmap "Start Level", menu panels, ...) would otherwise also queue
        // up an attack that fires the instant GameState's Player exists on the
        // very next frame, since nothing had consumed it yet.
        canvas.addEventListener('mousedown', this._onMouseDown);
        // Right-click is reserved for gameplay (planned) - suppress the
        // browser's own copy/inspect context menu over the canvas so it
        // doesn't pop up mid-game. Scoped to the canvas like mousedown above,
        // so right-clicking HTML overlay UI still gets the normal menu.
        canvas.addEventListener('contextmenu', this._onContextMenu);

        // A held key's keyup never reaches the page if focus leaves the window/
        // tab first (Alt+Tab, clicking another app, switching tabs) - without
        // this, `actions` would keep reporting it held forever, walking the
        // player off on their own with nothing actually pressed. Both events
        // covered since either can fire without the other depending on how
        // focus was lost.
        window.addEventListener('blur', this._releaseAllActions);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    _onVisibilityChange() {
        if (document.hidden) this._releaseAllActions();
    }

    _releaseAllActions() {
        this.actions.left = false;
        this.actions.right = false;
        this.actions.jump = false;
        this.actions.duck = false;
    }

    _onKeyDown(e) {
        if (e.code === 'Escape') {
            this._pausePressed = true;
            return;
        }
        if (e.code === 'KeyE') {
            this._interactPressed = true;
            return;
        }

        const action = KEY_MAP[e.code];
        if (!action) return;
        if (action === 'jump' && !this.actions.jump) this._jumpPressed = true;
        this.actions[action] = true;
    }

    _onKeyUp(e) {
        const action = KEY_MAP[e.code];
        if (action) this.actions[action] = false;
    }

    _onMouseDown() {
        this._attackPressed = true;
    }

    _onContextMenu(e) {
        e.preventDefault();
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

    // Same "at most once per press" contract as consumeAttackPress() - callers
    // poll every frame regardless of whether a jump can currently be taken, so
    // Player.js can stash it into its own jump-buffer window instead of losing
    // a press that arrived a few frames before landing.
    consumeJumpPress() {
        if (!this._jumpPressed) return false;
        this._jumpPressed = false;
        return true;
    }

    clearJumpPress() {
        this._jumpPressed = false;
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

    // Same "at most once per press" contract as consumeAttackPress()/
    // consumeJumpPress() - GameState drains this every frame regardless of
    // whether the portal is actually in range/active right now, so a stray
    // press while out of range doesn't linger and fire late once in range.
    consumeInteractPress() {
        if (!this._interactPressed) return false;
        this._interactPressed = false;
        return true;
    }

    clearInteractPress() {
        this._interactPressed = false;
    }
}
