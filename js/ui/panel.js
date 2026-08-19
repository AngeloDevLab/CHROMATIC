/**
 * Generic modal panel (backdrop + title + body) used for Pause, Game Over,
 * Buff choices, Settings, etc. onClose fires exactly once per close, however
 * it happens (explicit close(), x, backdrop click, or Escape).
 */
export class Panel {
    /**
     * Stores the mount target; call open() to actually show a panel.
     * @param {HTMLElement} overlayRoot - Element to mount the panel into.
     */
    constructor(overlayRoot) {
        this.overlayRoot = overlayRoot;
        this.element = null;
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    /**
     * Opens the panel, replacing any panel currently open.
     * @param {string} title - Panel title text.
     * @param {string} bodyHTML - Panel body HTML content.
     * @param {object} [options] - Optional settings.
     * @param {(root: HTMLElement) => void} [options.onMount] - Wires up interactive content inside bodyHTML.
     * @param {() => void} [options.onClose] - Called when the panel closes.
     * @param {boolean} [options.dismissible=true] - Show the × button and allow backdrop/Escape close.
     * @param {boolean} [options.closeOnEscape=dismissible] - Whether Escape
     *   closes the panel; settable independently of dismissible for callers that handle Escape themselves.
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
     * Builds the panel's backdrop/box/title/body markup.
     * @param {string} title - Panel title text.
     * @param {string} bodyHTML - Panel body HTML content.
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
     * Wires backdrop-click/×/Escape dismissal, per the given flags.
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
     * Closes the panel, if open, and fires its onClose callback unless silent.
     * @param {object} [options] - Optional settings.
     * @param {boolean} [options.silent=false] - Skip the onClose callback.
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
     * Closes the panel on Escape.
     * @param {KeyboardEvent} event - The browser keydown event.
     */
    _onKeyDown(event) {
        if (event.key === 'Escape') this.close();
    }

    /**
     * Convenience wrapper around open() for the common "title + a list of
     * buttons" shape (Pause/Game Over/Buff choice) - builds the buttons'
     * markup and wires each one's onClick.
     * @param {string} title - Panel title text.
     * @param {{id: string, label: string, onClick: () => void}[]} choices - Buttons to render, each with its own click handler.
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
