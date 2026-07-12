export class Panel {
    constructor(overlayRoot) {
        this.overlayRoot = overlayRoot;
        this.element = null;
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    open(title, bodyHTML) {
        this.close();

        this.element = document.createElement('div');
        this.element.className = 'panel-backdrop';
        this.element.innerHTML = `
            <div class="panel">
                <button class="panel-close" aria-label="Close">×</button>
                <h2 class="panel-title">${title}</h2>
                <div class="panel-body">${bodyHTML}</div>
            </div>
        `;

        this.element.addEventListener('click', (event) => {
            if (event.target === this.element) this.close();
        });
        this.element.querySelector('.panel-close').addEventListener('click', () => this.close());

        this.overlayRoot.appendChild(this.element);
        window.addEventListener('keydown', this._onKeyDown);
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
