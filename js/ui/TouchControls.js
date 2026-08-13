const ICON_BASE = 'assets/icons/';

/**
 * Held while pressed - InputHandler.pressAction()/releaseAction() apply the
 * same edge-press guard as a real keydown/keyup.
 */
const HOLD_BUTTONS = [
    { action: 'left', icon: 'btn-icon-left', className: 'touch-left' },
    { action: 'right', icon: 'btn-icon-right', className: 'touch-right' },
    { action: 'jump', icon: 'btn-icon-up', className: 'touch-jump' },
    { action: 'drop', icon: 'btn-icon-down', className: 'touch-drop' },
];

/**
 * One-shot on tap (InputHandler.triggerPress()), no held state to release.
 * Pause is built separately below, for any device. Interact isn't here
 * either - it's context-sensitive, positioned by Interactables.js's own
 * [E] prompt elements instead of a fixed corner button.
 */
const TAP_BUTTONS = [
    { name: 'attack', icon: 'btn-icon-attack', className: 'touch-attack' },
];

/**
 * @returns {boolean} Whether this device reports any touch capability.
 */
export function isTouchCapable() {
    return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

/**
 * Builds one button's background plate + icon as separate layered children,
 * so the plate's see-through opacity doesn't also fade the icon. Caller owns
 * appending/removing it - Interactables.js's Interact prompt reuses this too.
 * @param {string} icon - Icon filename (without extension) under assets/icons/.
 * @param {string} className
 * @returns {HTMLButtonElement}
 */
export function buildTouchButtonElement(icon, className) {
    const el = document.createElement('button');
    el.className = `touch-button ${className}`;
    el.innerHTML = '<span class="touch-button-bg"></span><span class="touch-button-icon"></span>';
    el.querySelector('.touch-button-icon').style.setProperty('--touch-icon', `url('${ICON_BASE}${icon}.png')`);
    return el;
}

// Virtual on-screen D-Pad/action buttons - plain HTML elements that feed
// InputHandler's existing pressAction()/releaseAction()/triggerPress(), so
// Player.js/CombatCoordinator.js never need to know input came from touch vs
// a key. The Pause button always builds; the rest only on a touch-capable
// device. Owned by LevelSession like Interactables/PlayerFx.
//
// Mounted to document.body, outside #ui-overlay, like LandscapeGate.js/
// DevPanel.js - #ui-overlay is transform-scaled to the internal game
// resolution, so anything inside it (even position: fixed) tracks the
// scaled/letterboxed canvas rather than the physical screen corners.
//
// isTouchCapable() is re-checked on every resize/orientationchange, not just
// at construction, so a DevTools device-mode toggle mid-level is picked up
// too (same reasoning as LandscapeGate.js).
export class TouchControls {
    /**
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
     * Adds/removes the touch-only buttons when touch capability changes.
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
        for (const { action, icon, className } of HOLD_BUTTONS) {
            const el = this._createButton(icon, className);
            this._touchOnlyElements.push(el);
            this._wireHoldButton(el, action);
        }
        for (const { name, icon, className } of TAP_BUTTONS) {
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
     * @param {HTMLButtonElement} el
     * @param {'left'|'right'|'jump'|'drop'} action
     */
    _wireHoldButton(el, action) {
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
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
     * @param {HTMLButtonElement} el
     * @param {'attack'|'pause'} name
     */
    _wireTapButton(el, name) {
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            el.classList.add('pressed');
            this.game.input.triggerPress(name);
        });
        const release = () => el.classList.remove('pressed');
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
        el.addEventListener('pointerleave', release);
    }

    /**
     * @param {string} icon - Icon filename (without extension) under assets/icons/.
     * @param {string} className
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
