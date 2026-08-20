// Mounted to document.body, outside #ui-overlay, since #ui-overlay is transform-scaled to the
// internal resolution and would otherwise track the letterboxed canvas instead of the physical
// screen corners.

const icon_base = 'assets/icons/';

/**
 * Held while pressed - InputHandler.pressAction()/releaseAction() apply the
 * same edge-press guard as a real keydown/keyup.
 */
const hold_buttons = [
    { action: 'left', icon: 'btn-icon-left', className: 'touch-left' },
    { action: 'right', icon: 'btn-icon-right', className: 'touch-right' },
    { action: 'jump', icon: 'btn-icon-up', className: 'touch-jump' },
    { action: 'drop', icon: 'btn-icon-down', className: 'touch-drop' },
];

/** One-shot on tap (InputHandler.triggerPress()), no held state to release. */
const tap_buttons = [
    { name: 'attack', icon: 'btn-icon-attack', className: 'touch-attack' },
];

/** Whether touch is the primary pointing method. @returns {boolean} */
export function isTouchCapable() {
    return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Builds one button's background plate + icon as separate layered children.
 * @param {string} icon - Icon filename (without extension) under assets/icons/.
 * @param {string} className - CSS class for the button element.
 * @returns {HTMLButtonElement}
 */
export function buildTouchButtonElement(icon, className) {
    const el = document.createElement('button');
    el.className = `touch-button ${className}`;
    el.innerHTML = '<span class="touch-button-bg"></span><span class="touch-button-icon"></span>';
    el.querySelector('.touch-button-icon').style.setProperty('--touch-icon', `url('${icon_base}${icon}.png')`);
    return el;
}

/** Virtual on-screen D-Pad/action buttons that feed InputHandler, shown only on touch devices. */
export class TouchControls {
    /**
     * Builds the root and Pause button (always present), then starts watching for touch capability.
     * @param {Game} game - For input/overlay.
     */
    constructor(game) {
        this.game = game;
        this.elements = [];
        this._touchOnlyElements = [];
        this._isTouch = false;
        this.root = document.createElement('div');
        this.root.className = 'touch-controls-root';
        document.body.appendChild(this.root);

        this._wireTapButton(this._createButton('btn-icon-pause', 'touch-pause'), 'pause');
        this._onResize = this._onResize.bind(this);
        window.addEventListener('resize', this._onResize);
        window.addEventListener('orientationchange', this._onResize);
        this._onResize();
    }

    /**
     * Adds/removes the touch-only buttons when touch capability changes,
     * re-checked every time so a DevTools device-mode toggle mid-level is picked up too.
     */
    _onResize() {
        const touch = isTouchCapable();
        if (touch === this._isTouch) return;
        this._isTouch = touch;
        if (touch) this._buildTouchOnlyButtons();
        else this._removeTouchOnlyButtons();
    }

    /**
     * Builds the D-Pad/action buttons, touch devices only.
     */
    _buildTouchOnlyButtons() {
        for (const { action, icon, className } of hold_buttons) {
            const el = this._createButton(icon, className);
            this._touchOnlyElements.push(el);
            this._wireHoldButton(el, action);
        }
        for (const { name, icon, className } of tap_buttons) {
            const el = this._createButton(icon, className);
            this._touchOnlyElements.push(el);
            this._wireTapButton(el, name);
        }
    }

    /**
     * Removes the D-Pad/action buttons built by _buildTouchOnlyButtons().
     */
    _removeTouchOnlyButtons() {
        for (const el of this._touchOnlyElements) el.remove();
        this.elements = this.elements.filter((el) => !this._touchOnlyElements.includes(el));
        this._touchOnlyElements = [];
    }

    /**
     * Presses the action on pointerdown, releases it on pointerup/cancel/leave.
     * @param {HTMLButtonElement} el - Button element to wire.
     * @param {'left'|'right'|'jump'|'drop'} action - Held movement action to press/release.
     */
    _wireHoldButton(el, action) {
        el.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            el.classList.add('pressed');
            this.game.input.pressAction(action);
        });
        const release = () => {
            el.classList.remove('pressed');
            this.game.input.releaseAction(action);
        };
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
        el.addEventListener('pointerleave', release);
    }

    /**
     * Triggers the one-shot action on pointerdown.
     * @param {HTMLButtonElement} el - Button element to wire.
     * @param {'attack'|'pause'} name - One-shot action to trigger.
     */
    _wireTapButton(el, name) {
        el.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            el.classList.add('pressed');
            this.game.input.triggerPress(name);
        });
        const release = () => el.classList.remove('pressed');
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
        el.addEventListener('pointerleave', release);
    }

    /**
     * Builds a button and tracks it for later removal.
     * @param {string} icon - Icon filename (without extension) under assets/icons/.
     * @param {string} className - CSS class for the button element.
     * @returns {HTMLButtonElement}
     */
    _createButton(icon, className) {
        const el = buildTouchButtonElement(icon, className);
        this.root.appendChild(el);
        this.elements.push(el);
        return el;
    }

    /**
     * Removes the root element and every button it held.
     */
    destroy() {
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('orientationchange', this._onResize);
        this.root.remove();
        this.elements = [];
    }
}
