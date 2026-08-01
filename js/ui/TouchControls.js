const ICON_BASE = 'assets/icons/';

// Held while pressed - InputHandler.pressAction()/releaseAction() apply the
// exact same start-of-hold edge-press guard as a real keydown/keyup, so a
// touch Jump/Drop tap behaves identically to the matching key.
const HOLD_BUTTONS = [
    { action: 'left', icon: 'btn-icon-left', className: 'touch-left' },
    { action: 'right', icon: 'btn-icon-right', className: 'touch-right' },
    { action: 'jump', icon: 'btn-icon-up', className: 'touch-jump' },
    { action: 'drop', icon: 'btn-icon-down', className: 'touch-drop' },
];

// One-shot on tap (InputHandler.triggerPress()), no held state to release.
// Pause is built separately below (always, regardless of touch capability -
// see the constructor) - Interact is deliberately not here either, it's
// context-sensitive (Portal/Merchant/SecretDoor/BuffTerminal), shown/
// positioned by Interactables.js's existing [E] prompt elements instead of
// a fixed corner button.
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
 * Builds one button's background plate + icon as separate layered children
 * (not a single flat image) so the plate's see-through opacity (style.css)
 * doesn't also fade the icon on top of it. Caller owns appending/removing
 * it - Interactables.js's contextual Interact prompt reuses this too.
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

// Virtual on-screen D-Pad/action buttons - plain HTML overlay elements
// (like every other in-game UI) that just feed InputHandler's existing
// pressAction()/releaseAction()/triggerPress(), so Player.js/
// CombatCoordinator.js etc. never need to know input came from a touch
// button instead of a key. The Pause button always builds, on any device -
// the rest only on an actually touch-capable one (a mouse-driven "alternative
// controls" toggle was tried and dropped again - clicking small buttons one
// at a time doesn't play well against a keyboard's simultaneous-key holds).
// Owned by LevelSession like Interactables/PlayerFx - only relevant while
// actually playing a level.
export class TouchControls {
    /**
     * @param {Game} game - For input/overlay.
     */
    constructor(game) {
        this.game = game;
        this.elements = [];

        this._wireTapButton(this._createButton('btn-icon-pause', 'touch-pause'), 'pause');
        if (!isTouchCapable()) return;

        for (const { action, icon, className } of HOLD_BUTTONS) {
            this._wireHoldButton(this._createButton(icon, className), action);
        }
        for (const { name, icon, className } of TAP_BUTTONS) {
            this._wireTapButton(this._createButton(icon, className), name);
        }
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
        this.game.overlay.appendChild(el);
        this.elements.push(el);
        return el;
    }

    /**
     * Removes every button this instance added.
     */
    destroy() {
        for (const el of this.elements) el.remove();
        this.elements = [];
    }
}
