export class Panel {
    /**
     * @param {HTMLElement} overlayRoot - Element to mount the panel into.
     */
    constructor(overlayRoot) {
        this.overlayRoot = overlayRoot;
        this.element = null;
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    /**
     * @param {string} title
     * @param {string} bodyHTML
     * @param {object} [options]
     * @param {(root: HTMLElement) => void} [options.onMount] - Called with the
     *   panel's root element, for callers that need to wire up interactive
     *   content inside bodyHTML (e.g. buttons) instead of just static text.
     * @param {() => void} [options.onClose] - Called whenever this panel
     *   actually closes, by whichever path (an explicit choice calling
     *   close() itself, or a dismissible panel's own ×/backdrop/Escape) -
     *   lets a caller with its own "is this open" state (e.g. BuffState.js
     *   popping itself off the StateMachine stack) react in exactly one
     *   place regardless of how the panel went away, instead of needing
     *   every close path to remember to do it.
     * @param {boolean} [options.dismissible=true] - When false, omits the ×
     *   button and the backdrop-click/Escape close handlers - for panels
     *   with no "cancel" path (e.g. Game Over), where the player must pick
     *   one of the panel's own options instead.
     * @param {boolean} [options.closeOnEscape=dismissible] - Defaults to
     *   `dismissible`, but can be forced off while still allowing
     *   backdrop/× - for a caller (e.g. GameState's buff-choice panel) that
     *   needs to handle Escape itself instead of Panel's own window-level
     *   listener, so the two don't both react to the same keypress (Panel
     *   closing the panel *and* the caller separately treating that same
     *   Escape as "open Pause" a frame later).
     */
    open(title, bodyHTML, { onMount, onClose, dismissible = true, closeOnEscape = dismissible } = {}) {
        this.close();
        this._onClose = onClose ?? null;
        this.element = this._buildElement(title, bodyHTML, dismissible);
        this._wireDismissal(dismissible, closeOnEscape);
        this.overlayRoot.appendChild(this.element);
        onMount?.(this.element);
    }

    /**
     * @param {string} title
     * @param {string} bodyHTML
     * @param {boolean} dismissible - Whether to include the × close button.
     * @returns {HTMLElement} The unattached panel-backdrop element.
     */
    _buildElement(title, bodyHTML, dismissible) {
        const element = document.createElement('div');
        element.className = 'panel-backdrop';
        element.innerHTML = `
            <div class="panel">
                ${dismissible ? '<button class="panel-close" aria-label="Close">×</button>' : ''}
                <h2 class="panel-title">${title}</h2>
                <div class="panel-body">${bodyHTML}</div>
            </div>
        `;
        return element;
    }

    /**
     * @param {boolean} dismissible - Whether backdrop-click/× should close the panel.
     * @param {boolean} closeOnEscape - Whether Escape should close the panel.
     */
    _wireDismissal(dismissible, closeOnEscape) {
        if (dismissible) {
            this.element.addEventListener('click', (event) => {
                if (event.target === this.element) this.close();
            });
            this.element.querySelector('.panel-close').addEventListener('click', () => this.close());
        }
        if (closeOnEscape) {
            window.addEventListener('keydown', this._onKeyDown);
        }
    }

    /**
     * Closes the panel, if open, and fires its onClose callback - unless
     * `silent`, for a caller that's tearing itself down regardless of
     * which content is currently showing (e.g. PauseState.exit() while its
     * Settings sub-view happens to be open). Without this, that teardown
     * would trigger Settings' own onClose (built to go "back" to the Paused
     * choices on a normal ×/backdrop dismiss) and reopen a stray panel
     * right as the whole state is being torn down.
     * @param {object} [options]
     * @param {boolean} [options.silent=false]
     */
    close({ silent = false } = {}) {
        if (!this.element) return;
        this.element.remove();
        this.element = null;
        window.removeEventListener('keydown', this._onKeyDown);
        const onClose = this._onClose;
        this._onClose = null;
        if (!silent) onClose?.();
    }

    /**
     * @param {KeyboardEvent} event
     */
    _onKeyDown(event) {
        if (event.key === 'Escape') this.close();
    }

    /**
     * Convenience wrapper around open() for the common "title + a list of
     * buttons" shape (Pause/Game Over/Buff choice) - builds the buttons'
     * markup and wires each one's onClick, so callers only ever hand over
     * data instead of building HTML themselves.
     * @param {string} title
     * @param {{id: string, label: string, onClick: () => void}[]} choices
     * @param {object} [options] - Forwarded to open() (dismissible, closeOnEscape, onClose).
     */
    openChoices(title, choices, options = {}) {
        const buttonsHTML = choices
            .map((choice) => `<button class="difficulty-option" data-action="${choice.id}">${choice.label}</button>`)
            .join('');

        this.open(title, `<div class="difficulty-options">${buttonsHTML}</div>`, {
            ...options,
            onMount: (root) => {
                for (const choice of choices) {
                    root.querySelector(`[data-action="${choice.id}"]`).addEventListener('click', choice.onClick);
                }
            },
        });
    }
}
