// Pause binds to KeyP, not Escape - the Fullscreen API reserves Escape as unoverridable.

const key_map = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
    ArrowDown: 'drop', KeyS: 'drop',
};

/** Reads keyboard/mouse input into held actions (left/right/jump/drop) and edge-triggered presses (attack/pause/interact). */
export class InputHandler {
    /**
     * Sets up input state and attaches every DOM listener.
     * @param {HTMLCanvasElement} canvas - Canvas to scope mouse handling to; its parent (#viewport) scopes context-menu handling.
     */
    constructor(canvas) {
        this._initState();
        this._bindHandlers();
        this._registerListeners(canvas);
    }

    /**
     * Sets up held-action and edge-triggered press state.
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
     * Attaches every DOM listener InputHandler needs.
     * @param {HTMLCanvasElement} canvas - Canvas to scope mouse handling to; its parent (#viewport) scopes context-menu handling.
     */
    _registerListeners(canvas) {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        canvas.addEventListener('mousedown', this._onMouseDown);
        canvas.parentElement.addEventListener('contextmenu', this._onContextMenu);
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
     * Routes a keydown to the matching held or edge-triggered action.
     * @param {KeyboardEvent} event - The browser keydown event.
     */
    _onKeyDown(event) {
        this._active = true;
        if (this._handleOneShotKey(event)) return;

        const action = key_map[event.code];
        if (!action) return;
        if (action === 'jump' && !this.actions.jump) this._presses.jump = true;
        if (action === 'drop' && !this.actions.drop) this._presses.drop = true;
        this.actions[action] = true;
    }

    /**
     * Handles the one-shot keys not covered by key_map.
     * @param {KeyboardEvent} event - The browser keydown event.
     * @returns {boolean} Whether this key was a one-shot press (Pause/Interact/Attack).
     */
    _handleOneShotKey(event) {
        if (event.code === 'KeyP') {
            this._presses.pause = true;
            return true;
        }
        if (event.code === 'KeyE') {
            this._presses.interact = true;
            return true;
        }
        if (event.code === 'KeyF') {
            if (!event.repeat) this._presses.attack = true;
            return true;
        }
        return false;
    }

    /**
     * Releases a held action on keyup.
     * @param {KeyboardEvent} event - The browser keyup event.
     */
    _onKeyUp(event) {
        const action = key_map[event.code];
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
     * Suppresses the right-click context menu over the game viewport.
     * @param {MouseEvent} event - The browser contextmenu event.
     */
    _onContextMenu(event) {
        event.preventDefault();
    }

    /**
     * Checks whether a held movement action is currently down.
     * @param {'left'|'right'|'jump'|'drop'} action - Held movement action to check.
     * @returns {boolean} Whether the action is currently held.
     */
    isDown(action) {
        return !!this.actions[action];
    }

    /**
     * Consumes a pending edge-triggered press, if any.
     * @param {string} name - Key into _presses.
     * @returns {boolean} Whether a press was pending (and is now consumed).
     */
    _consumePress(name) {
        if (!this._presses[name]) return false;
        this._presses[name] = false;
        return true;
    }

    /**
     * Discards a pending press without consuming it.
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
     * touch-controls.js's entry point for a held movement button (left/right/jump/drop).
     * @param {'left'|'right'|'jump'|'drop'} action - Held movement action to press.
     */
    pressAction(action) {
        this._active = true;
        if ((action === 'jump' || action === 'drop') && !this.actions[action]) this._presses[action] = true;
        this.actions[action] = true;
    }

    /**
     * touch-controls.js's entry point for releasing a held movement button.
     * @param {'left'|'right'|'jump'|'drop'} action - Held movement action to release.
     */
    releaseAction(action) {
        this.actions[action] = false;
    }

    /**
     * touch-controls.js's entry point for a one-shot button (attack/pause/interact).
     * @param {'attack'|'pause'|'interact'} name - One-shot action to trigger.
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
