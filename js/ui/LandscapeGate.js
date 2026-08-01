import { isTouchCapable } from './TouchControls.js';

// Blocks the whole screen with a "rotate your device" prompt whenever a
// touch device is held in portrait - the game's internal resolution (640x360)
// is landscape-only, and a portrait phone would otherwise just see a tiny
// letterboxed sliver. Fixed to the document, deliberately outside
// #ui-overlay (same reasoning as DevPanel.js) - this has to cover the whole
// physical screen, not just the scaled game viewport. No-op on a non-touch
// device, since a desktop window resized narrow/tall should just letterbox
// normally, not get told to "rotate".
export class LandscapeGate {
    /**
     * @param {Game} game - Unused directly, kept for constructor-shape
     *   consistency with every other main.js-owned system.
     */
    constructor(game) {
        this.game = game;
        this.element = null;
        this._isPortrait = false;
        if (!isTouchCapable()) return;

        this._buildElement();
        this._onOrientationChange = this._onOrientationChange.bind(this);
        // Both, redundantly - a real device's innerWidth/innerHeight can lag
        // a frame behind the actual rotation on 'resize' alone on some
        // mobile browsers, 'orientationchange' fires more reliably there.
        window.addEventListener('resize', this._onOrientationChange);
        window.addEventListener('orientationchange', this._onOrientationChange);
        this._onOrientationChange();
    }

    /**
     * Builds the (initially hidden) full-screen prompt.
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
     * Shows/hides the prompt based on the current viewport aspect ratio.
     */
    _onOrientationChange() {
        this._isPortrait = window.innerHeight > window.innerWidth;
        this.element.classList.toggle('visible', this._isPortrait);
    }

    /**
     * @returns {boolean} Whether the prompt is currently covering the
     *   screen - Game._loop() reads this to skip gameplay updates entirely
     *   while it's up, not just visually hide them behind an opaque overlay.
     */
    get isBlocking() {
        return this._isPortrait;
    }
}
