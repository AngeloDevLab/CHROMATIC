const MENU_ITEMS = [
    { id: 'continue', label: 'Continue' },
    { id: 'new-game', label: 'New Game' },
    { id: 'settings', label: 'Settings' },
    { id: 'info', label: 'Info' },
];

export class MenuButtons {
    /**
     * @param {HTMLElement} overlayRoot - Element to mount the button list into.
     * @param {object} [options]
     * @param {boolean} [options.hasSave=false] - Whether Continue stays
     *   enabled (08_menu-flow.md 9.3) - true once a difficulty has ever been
     *   chosen (Game.difficulty, persisted via SaveSystem), see MenuState.js.
     * @param {(id: string) => void} [options.onSelect] - Called with a menu item's id on click.
     */
    constructor(overlayRoot, { hasSave = false, onSelect } = {}) {
        this.overlayRoot = overlayRoot;
        this.hasSave = hasSave;
        this.onSelect = onSelect;
        this.element = null;
    }

    /**
     * Builds and attaches the button list.
     */
    mount() {
        this.element = document.createElement('div');
        this.element.className = 'menu-buttons';

        for (const item of MENU_ITEMS) {
            this.element.appendChild(this._createButton(item));
        }

        this.overlayRoot.appendChild(this.element);
    }

    /**
     * @param {{id: string, label: string}} item - Menu item to build a button for.
     * @returns {HTMLButtonElement}
     */
    _createButton(item) {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.textContent = item.label;

        if (item.id === 'continue' && !this.hasSave) {
            button.disabled = true;
        } else {
            button.addEventListener('click', () => this.onSelect?.(item.id));
        }
        return button;
    }

    /**
     * Detaches the button list.
     */
    unmount() {
        this.element?.remove();
        this.element = null;
    }
}
