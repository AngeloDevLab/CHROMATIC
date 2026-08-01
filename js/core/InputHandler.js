// Key -> logical action name. Movement/jump/drop are held states read via
// isDown(); attack/pause/interact are edge-triggered one-shot presses (see
// _presses below) since a mouse click or P/E tap should fire exactly
// once, not keep re-triggering every frame the input happens to still read
// as active.
const KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
    ArrowDown: 'drop', KeyS: 'drop',
};

// Every edge-triggered action (attack/jump/drop/pause/interact) follows the
// same consume-once contract: consumeXPress() returns true at most once per
// press and clears itself, so callers can poll every frame regardless of
// whether they're currently able to act on it right now (Player.js stashes
// a jump press into its own buffer window instead of losing one that
// arrived a few frames before landing; a click during an ongoing attack
// doesn't queue up and fire late once the swing ends). clearXPress()
// discards a pending press without consuming it as a real action - used
// when switching screens, so a leftover P/click/E from the previous
// screen doesn't instantly pause/attack/interact on the very next one.
// Jump and drop each *also* have a held state in `actions` (jump's for
// Player.js's variable jump height; drop's kept purely for symmetry with
// jump's repeat-guard, nothing else reads it) - both edge-triggered presses
// are guarded against the browser's own keydown auto-repeat in _onKeyDown,
// so holding the key doesn't re-trigger the press every repeat tick.
// mousedown/contextmenu are scoped to the canvas, not window: a click on UI
// (worldmap "Start Level", menu panels, ...) would otherwise queue up an
// attack that fires the instant GameState's Player exists next frame, and
// right-click is reserved for gameplay (planned), so the browser's own
// context menu is suppressed only over the canvas, not the HTML overlay.
// blur/visibilitychange both release all held actions: a held key's keyup
// never reaches the page if focus leaves the window/tab first (Alt+Tab,
// switching apps/tabs), and either event can fire without the other
// depending on how focus was lost.
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
        canvas.addEventListener('contextmenu', this._onContextMenu);
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
     * @param {KeyboardEvent} e - The browser keydown event.
     */
    _onKeyDown(e) {
        // KeyP, not Escape (not a KEY_MAP entry - same reasoning as KeyE
        // below) - the Fullscreen API reserves Escape as a browser-level
        // "always exits fullscreen" key that pages can't override, so
        // pausing via Escape while fullscreen also (unavoidably, and
        // unpredictably from the player's POV) drops out of it. Deliberately
        // not bound to pause for that reason, even though it's the genre
        // convention - Panel.js's own separate Escape-to-dismiss handling
        // (sub-panels like Settings/difficulty picker) is unaffected.
        if (e.code === 'KeyP') {
            this._presses.pause = true;
            return;
        }
        if (e.code === 'KeyE') {
            this._presses.interact = true;
            return;
        }

        const action = KEY_MAP[e.code];
        if (!action) return;
        if (action === 'jump' && !this.actions.jump) this._presses.jump = true;
        if (action === 'drop' && !this.actions.drop) this._presses.drop = true;
        this.actions[action] = true;
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
     * TouchControls.js's entry point for a held movement button
     * (left/right/jump/drop) - same start-of-hold edge-press guard
     * _onKeyDown() applies, so a touch Jump/Drop tap behaves identically to
     * the matching key.
     * @param {'left'|'right'|'jump'|'drop'} action
     */
    pressAction(action) {
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
        this._presses[name] = true;
    }
}
