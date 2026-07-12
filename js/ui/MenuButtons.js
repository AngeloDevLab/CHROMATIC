const MENU_ITEMS = [
    { id: 'new-game', label: 'New Game' },
    { id: 'continue', label: 'Continue' },
    { id: 'settings', label: 'Settings' },
    { id: 'credits', label: 'Credits' },
    { id: 'imprint-privacy', label: 'Imprint' },
];

export class MenuButtons {
    // hasSave: Continue stays visible but disabled/greyed out when no save exists
    // (08_menu-flow.md 9.3) - always false for now since SaveManager doesn't exist yet.
    constructor(overlayRoot, { hasSave = false, onSelect } = {}) {
        this.overlayRoot = overlayRoot;
        this.hasSave = hasSave;
        this.onSelect = onSelect;
        this.element = null;
    }

    mount() {
        this.element = document.createElement('div');
        this.element.className = 'menu-buttons';

        for (const item of MENU_ITEMS) {
            const button = document.createElement('button');
            button.className = 'menu-button';
            button.textContent = item.label;

            const disabled = item.id === 'continue' && !this.hasSave;
            if (disabled) {
                button.disabled = true;
            } else {
                button.addEventListener('click', () => this.onSelect?.(item.id));
            }

            this.element.appendChild(button);
        }

        this.overlayRoot.appendChild(this.element);
    }

    unmount() {
        this.element?.remove();
        this.element = null;
    }
}
