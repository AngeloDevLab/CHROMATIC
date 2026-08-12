/**
 * Key -> logical action name. Movement/jump/drop are held states read via
 * isDown(); attack/pause/interact are edge-triggered one-shot presses (see
 * _presses below).
 */
const KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
    ArrowDown: 'drop', KeyS: 'drop',
};

// Edge-triggered actions follow a consume-once contract: consumeXPress()
// returns true once then clears itself; clearXPress() discards a pending
// press without consuming it. Pause is bound to KeyP, not Escape, since the
// Fullscreen API reserves Escape as an unoverridable "exit fullscreen" key.
export class InputHandler {
    /**
     * @param {HTMLCanvasElement} canvas - Canvas to scope mouse/context-menu handling to.
     */
    constructor(canvas) {
        this._initState();
        this._bindHandlers();
        this._registerListeners(canvas);
    }

    /**
     * Sets up held-action state (`actions`) and edge-triggered press state
     * (`_presses`) - see the top-of-file note for the distinction.
     */
    _initState() {
        this.actions = { left: false, right: false, jump: false, drop: false };
        this._presses = { attack: false, jump: false, drop: false, pause: false, interact: false };
        this._active = false;
    }

    /**
     * Pre-binds every handler once so add/removeEventListener reference the
     * same function identity.
     */
    _bindHandlers() {
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        this._releaseAllActions = this._releaseAllActions.bind(this);
        this._onVisibilityChange = this._onVisibilityChange.bind(this);
    }

    /**
     * @param {HTMLCanvasElement} canvas - Canvas to scope mouse/context-menu handling to.
     */
    _registerListeners(canvas) {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        canvas.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('contextmenu', this._onContextMenu);
        window.addEventListener('blur', this._releaseAllActions);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    /**
     * Releases all held movement actions when the tab becomes hidden.
     */
    _onVisibilityChange() {
        if (document.hidden) this._releaseAllActions();
    }

    /**
     * Zeroes every held movement action (used on blur/tab-hidden).
     */
    _releaseAllActions() {
        this.actions.left = false;
        this.actions.right = false;
        this.actions.jump = false;
        this.actions.drop = false;
    }

    /**
     * Routes a keydown to the matching held/edge-triggered action (see the
     * top-of-file note on the key bindings).
     * @param {KeyboardEvent} e - The browser keydown event.
     */
    _onKeyDown(e) {
        this._active = true;
        if (this._handleOneShotKey(e)) return;

        const action = KEY_MAP[e.code];
        if (!action) return;
        if (action === 'jump' && !this.actions.jump) this._presses.jump = true;
        if (action === 'drop' && !this.actions.drop) this._presses.drop = true;
        this.actions[action] = true;
    }

    /**
     * @param {KeyboardEvent} e
     * @returns {boolean} Whether this key was a one-shot press (Pause/Interact/Attack).
     */
    _handleOneShotKey(e) {
        if (e.code === 'KeyP') {
            this._presses.pause = true;
            return true;
        }
        if (e.code === 'KeyE') {
            this._presses.interact = true;
            return true;
        }
        if (e.code === 'KeyF') {
            if (!e.repeat) this._presses.attack = true;
            return true;
        }
        return false;
    }

    /**
     * @param {KeyboardEvent} e - The browser keyup event.
     */
    _onKeyUp(e) {
        const action = KEY_MAP[e.code];
        if (action) this.actions[action] = false;
    }

    /**
     * Registers an edge-triggered attack press.
     */
    _onMouseDown() {
        this._active = true;
        this._presses.attack = true;
    }

    /**
     * @param {MouseEvent} e - The browser contextmenu event.
     */
    _onContextMenu(e) {
        e.preventDefault();
    }

    /**
     * @param {'left'|'right'|'jump'|'drop'} action - Held movement action to check.
     * @returns {boolean} Whether the action is currently held.
     */
    isDown(action) {
        return !!this.actions[action];
    }

    /**
     * @param {string} name - Key into _presses.
     * @returns {boolean} Whether a press was pending (and is now consumed).
     */
    _consumePress(name) {
        if (!this._presses[name]) return false;
        this._presses[name] = false;
        return true;
    }

    /**
     * @param {string} name - Key into _presses.
     */
    _clearPress(name) {
        this._presses[name] = false;
    }

    /** @returns {boolean} Whether an attack click was pending. */
    consumeAttackPress() { return this._consumePress('attack'); }

    clearAttackPress() { this._clearPress('attack'); }

    /** @returns {boolean} Whether a jump press was pending. */
    consumeJumpPress() { return this._consumePress('jump'); }

    clearJumpPress() { this._clearPress('jump'); }

    /** @returns {boolean} Whether a drop press was pending. */
    consumeDropPress() { return this._consumePress('drop'); }

    clearDropPress() { this._clearPress('drop'); }

    /** @returns {boolean} Whether a pause press was pending. */
    consumePausePress() { return this._consumePress('pause'); }

    clearPausePress() { this._clearPress('pause'); }

    /** @returns {boolean} Whether an interact press was pending. */
    consumeInteractPress() { return this._consumePress('interact'); }

    clearInteractPress() { this._clearPress('interact'); }

    /**
     * TouchControls.js's entry point for a held movement button (left/right/jump/drop).
     * @param {'left'|'right'|'jump'|'drop'} action
     */
    pressAction(action) {
        this._active = true;
        if ((action === 'jump' || action === 'drop') && !this.actions[action]) this._presses[action] = true;
        this.actions[action] = true;
    }

    /**
     * @param {'left'|'right'|'jump'|'drop'} action
     */
    releaseAction(action) {
        this.actions[action] = false;
    }

    /**
     * TouchControls.js's entry point for a one-shot button (attack/pause/interact).
     * @param {'attack'|'pause'|'interact'} name
     */
    triggerPress(name) {
        this._active = true;
        this._presses[name] = true;
    }

    /**
     * Peek-and-clear activity flag, set by any key/mouse/touch input since the last call.
     * @returns {boolean} Whether any input happened since the last check.
     */
    consumeActivity() {
        if (!this._active) return false;
        this._active = false;
        return true;
    }
}
