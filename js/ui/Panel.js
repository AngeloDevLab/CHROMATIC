export class Panel {
    constructor(overlayRoot) {
        this.overlayRoot = overlayRoot;
        this.element = null;
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    // onMount: optional callback receiving the panel's root element, for callers
    // that need to wire up interactive content inside bodyHTML (e.g. buttons)
    // instead of just static text.
    // dismissible: when false, omits the × button and the backdrop-click/Escape
    // close handlers - for panels with no "cancel" path (e.g. Game Over), where
    // the player must pick one of the panel's own options instead.
    open(title, bodyHTML, { onMount, dismissible = true } = {}) {
        this.close();

        this.element = document.createElement('div');
        this.element.className = 'panel-backdrop';
        this.element.innerHTML = `
            <div class="panel">
                ${dismissible ? '<button class="panel-close" aria-label="Close">×</button>' : ''}
                <h2 class="panel-title">${title}</h2>
                <div class="panel-body">${bodyHTML}</div>
            </div>
        `;

        if (dismissible) {
            this.element.addEventListener('click', (event) => {
                if (event.target === this.element) this.close();
            });
            this.element.querySelector('.panel-close').addEventListener('click', () => this.close());
            window.addEventListener('keydown', this._onKeyDown);
        }

        this.overlayRoot.appendChild(this.element);

        onMount?.(this.element);
    }

    close() {
        if (!this.element) return;
        this.element.remove();
        this.element = null;
        window.removeEventListener('keydown', this._onKeyDown);
    }

    _onKeyDown(event) {
        if (event.key === 'Escape') this.close();
    }
}
