import { isTouchCapable, buildTouchButtonElement } from '../../ui/TouchControls.js';

/**
 * How close the player needs to be (center to center) to an interactable
 * for its [E] prompt to show/register - shared by Portal/Merchant/
 * SecretDoor/BuffTerminal, no reason for any of them to differ.
 */
export const INTERACT_RANGE_PX = 40;

/**
 * Builds one of the [E]-prompt elements (Portal/Merchant/SecretDoor/
 * BuffTerminal) - on a touch device this is a wrapper around a real
 * Interact icon button (TouchControls.js's buildTouchButtonElement(), same
 * plate+icon look as the fixed corner buttons) plus a text label below it,
 * instead of the plain "[E] ..." text desktop gets. The button taps through
 * to InputHandler.triggerPress('interact'), the same edge-triggered press a
 * physical E key already produces, so LevelSession's existing
 * consumeInteractPress() poll picks either up identically. Shown/hidden/
 * positioned per-frame by each owning class's own updatePrompt() - this only
 * builds it.
 * @param {Game} game
 * @param {string} text
 * @returns {HTMLElement}
 */
export function createInteractPrompt(game, text) {
    const el = document.createElement('div');
    el.className = 'interact-prompt';
    el.hidden = true;

    const touch = isTouchCapable();
    if (touch) {
        el.classList.add('tappable');
        const button = buildTouchButtonElement('btn-icon-interact', 'interact-prompt-icon');
        button.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            game.input.triggerPress('interact');
        });
        el.appendChild(button);
    }

    const label = document.createElement('div');
    // "[E] " reads as a stray artifact on a device with no E key.
    label.textContent = touch ? text.replace('[E] ', '') : text;
    el.appendChild(label);

    game.overlay.appendChild(el);
    return el;
}

/**
 * Positions a prompt element at a world point, matching LevelSession.
 * render()'s ctx.scale(zoom)+translate exactly, or the prompt would drift
 * from the entity it's pointing at whenever Camera.js's zoom isn't 1.
 * @param {HTMLElement} el
 * @param {Camera} camera
 * @param {number} worldX
 * @param {number} worldY
 */
export function positionInteractPrompt(el, camera, worldX, worldY) {
    el.style.left = `${(worldX - camera.x) * camera.zoom}px`;
    el.style.top = `${(worldY - camera.y) * camera.zoom}px`;
}
