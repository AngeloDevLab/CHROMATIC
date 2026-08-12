/**
 * Generic modal panel (backdrop + title + body) used for Pause, Game Over,
 * Buff choices, Settings, etc. onClose fires exactly once per close, however
 * it happens (explicit close(), x, backdrop click, or Escape). dismissible=
 * false omits x/backdrop/Escape (e.g. Game Over). closeOnEscape can be
 * forced off independently of dismissible, for callers that handle Escape
 * themselves. close({silent: true}) skips onClose, for teardown paths that
 * shouldn't trigger a sub-panel's own "go back" behavior.
 */
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
     * Opens the panel, replacing any panel currently open.
     * @param {string} title
     * @param {string} bodyHTML
     * @param {object} [options]
     * @param {(root: HTMLElement) => void} [options.onMount] - Wires up interactive content inside bodyHTML.
     * @param {() => void} [options.onClose] - Called when the panel closes.
     * @param {boolean} [options.dismissible=true] - Show the × button and allow backdrop/Escape close.
     * @param {boolean} [options.closeOnEscape=dismissible] - Whether Escape closes the panel.
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
     * Closes the panel, if open, and fires its onClose callback unless silent.
     * @param {object} [options]
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
     * @param {KeyboardEvent} event
     */
    _onKeyDown(event) {
        if (event.key === 'Escape') this.close();
    }

    /**
     * Convenience wrapper around open() for the common "title + a list of
     * buttons" shape (Pause/Game Over/Buff choice) - builds the buttons'
     * markup and wires each one's onClick.
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
