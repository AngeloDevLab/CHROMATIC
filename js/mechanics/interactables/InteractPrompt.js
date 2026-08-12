import { isTouchCapable, buildTouchButtonElement } from '../../ui/TouchControls.js';

// The touch button's pointerdown calls triggerPress('interact') so a tap
// fires the same edge-triggered press a physical E key produces.

/**
 * How close the player needs to be (center to center) to an interactable
 * for its [E] prompt to show/register.
 */
export const INTERACT_RANGE_PX = 40;

/**
 * Builds one of the [E]-prompt elements (Portal/Merchant/SecretDoor/
 * BuffTerminal) - an icon button plus label on touch, plain text on desktop.
 * @param {Game} game
 * @param {string} text
 * @returns {HTMLElement}
 */
export function createInteractPrompt(game, text) {
    const el = document.createElement('div');
    el.className = 'interact-prompt';
    el.hidden = true;
    _fillPromptContent(el, game, text);
    game.overlay.appendChild(el);
    return el;
}

/**
 * @param {HTMLElement} el
 * @param {Game} game
 * @param {string} text
 */
function _fillPromptContent(el, game, text) {
    const touch = isTouchCapable();
    if (touch) {
        el.classList.add('tappable');
        el.appendChild(_buildTouchButton(game));
    }

    const label = document.createElement('div');
    label.textContent = touch ? text.replace('[E] ', '') : text;
    el.appendChild(label);
}

/**
 * The tappable icon button shown instead of the desktop "[E]" hint.
 * @param {Game} game
 * @returns {HTMLElement}
 */
function _buildTouchButton(game) {
    const button = buildTouchButtonElement('btn-icon-interact', 'interact-prompt-icon');
    button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        game.input.triggerPress('interact');
    });
    return button;
}

/**
 * Positions a prompt element at a world point, converting through the same
 * camera zoom/offset transform LevelSession uses to render the world.
 * @param {HTMLElement} el
 * @param {Camera} camera
 * @param {number} worldX
 * @param {number} worldY
 */
export function positionInteractPrompt(el, camera, worldX, worldY) {
    el.style.left = `${(worldX - camera.x) * camera.zoom}px`;
    el.style.top = `${(worldY - camera.y) * camera.zoom}px`;
}
