import { isTouchCapable, buildTouchButtonElement } from '../../ui/touch-controls.js';

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
 * @param {Game} game - Owning Game instance, for its overlay/input.
 * @param {string} text - Prompt label text (desktop "[E] ..." form).
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
 * Fills the prompt with a touch button (if applicable) and its label.
 * @param {HTMLElement} el - Prompt element to fill.
 * @param {Game} game - Owning Game instance, for its overlay/input.
 * @param {string} text - Prompt label text (desktop "[E] ..." form).
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
 * @param {Game} game - Owning Game instance, for its input.
 * @returns {HTMLElement}
 */
function _buildTouchButton(game) {
    const button = buildTouchButtonElement('btn-icon-interact', 'interact-prompt-icon');
    button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        game.input.triggerPress('interact');
    });
    return button;
}

/**
 * Positions a prompt element at a world point, converting through the same
 * camera zoom/offset transform LevelSession uses to render the world.
 * @param {HTMLElement} el - Prompt element to position.
 * @param {Camera} camera - Camera to convert the world point through.
 * @param {number} worldX - World X to position the prompt at.
 * @param {number} worldY - World Y to position the prompt at.
 */
export function positionInteractPrompt(el, camera, worldX, worldY) {
    el.style.left = `${(worldX - camera.x) * camera.zoom}px`;
    el.style.top = `${(worldY - camera.y) * camera.zoom}px`;
}
