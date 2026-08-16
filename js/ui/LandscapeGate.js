import { isTouchCapable } from './TouchControls.js';

// Blocks the screen with a "rotate your device" prompt when a touch device
// is held in portrait - the internal 640x360 resolution is landscape-only.
export class LandscapeGate {
    /**
     * Builds the prompt and listens for both resize and orientationchange,
     * since some mobile browsers lag a frame behind rotation on resize alone.
     * @param {Game} game - Unused directly.
     */
    constructor(game) {
        this.game = game;
        this.element = null;
        this._isPortrait = false;
        this._buildElement();
        this._onOrientationChange = this._onOrientationChange.bind(this);
        window.addEventListener('resize', this._onOrientationChange);
        window.addEventListener('orientationchange', this._onOrientationChange);
        this._onOrientationChange();
    }

    /**
     * Builds the (initially hidden) full-screen prompt, fixed to the
     * document outside #ui-overlay so it covers the whole physical screen,
     * not just the scaled game viewport.
     */
    _buildElement() {
        this.element = document.createElement('div');
        this.element.className = 'landscape-gate';
        this.element.innerHTML = `
            <div class="landscape-gate-icon"></div>
            <div class="landscape-gate-text">Please rotate your device</div>
        `;
        document.body.appendChild(this.element);
    }

    /**
     * Shows/hides the prompt based on the current viewport aspect ratio,
     * re-checking isTouchCapable() every time so a DevTools device-mode toggle is picked up too.
     */
    _onOrientationChange() {
        this._isPortrait = isTouchCapable() && window.innerHeight > window.innerWidth;
        this.element.classList.toggle('visible', this._isPortrait);
    }

    /**
     * Game._advanceFixedSteps() reads this to drop the accumulator while blocking.
     * @returns {boolean} Whether the rotate prompt is currently covering the screen.
     */
    get isBlocking() {
        return this._isPortrait;
    }
}
