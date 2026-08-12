import { StateMachine } from './StateMachine.js';

// _handleResize() snaps to the nearest whole-number scale rather than an
// exact fractional fit: pixelated nearest-neighbor upscaling at a
// non-integer factor causes a Firefox performance/shimmer issue.
//
// resizeBuffer() swaps the canvas's width/height mid-game, which resets
// the 2D context state; safe since every frame redraws from scratch.

/**
 * Fixed gameplay timestep, independent of the display's frame rate.
 */
const FIXED_DT = 1 / 60;

/**
 * Caps how many catch-up steps a single frame's accumulator can inject.
 */
const FRAME_TIME_CAP_SECONDS = 0.05;

/**
 * How long resizeBuffer()'s viewport CSS transition takes to grow/shrink into its new size.
 */
const BUFFER_RESIZE_TRANSITION_SECONDS = 0.3;

export class Game {
    /**
     * Base 640x360 resolution, as shipped in index.html's <canvas> attributes.
     */
    _baseWidth;
    _baseHeight;

    /**
     * Cross-state data that outlives any single State's enter()/exit() cycle.
     */
    assets = null;
    input = null;

    /**
     * Player progress, populated from SaveSystem via loadProgress().
     */
    difficulty = null;
    completedLevels = new Set();
    buffs = new Set();
    tokens = 0;
    abilities = new Set();

    /**
     * Levels whose boss Token reward has already been granted once.
     */
    claimedBossTokens = new Set();

    /**
     * Levels whose Secret Room buff has already been claimed.
     */
    claimedSecretRoomBuffs = new Set();

    /**
     * @param {string} canvasId - DOM id of the game <canvas>.
     * @param {string} overlayId - DOM id of the HTML UI overlay.
     */
    constructor(canvasId, overlayId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById(overlayId);
        this.viewport = document.getElementById('viewport');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this._baseWidth = this.width;
        this._baseHeight = this.height;
        this.stateMachine = new StateMachine(this);
        this._initLoopState();
        window.addEventListener('resize', this._handleResize);
        this._handleResize();
    }

    /**
     * Restores completedLevels/buffs/tokens/abilities/difficulty from
     * SaveSystem, converting the stored arrays back into Sets.
     */
    loadProgress() {
        this.completedLevels = new Set(this.save.get('completedLevels', []));
        this.buffs = new Set(this.save.get('buffs', []));
        this.tokens = this.save.get('tokens', 0);
        this.abilities = new Set(this.save.get('abilities', []));
        this.difficulty = this.save.get('difficulty', null);
        this.claimedBossTokens = new Set(this.save.get('claimedBossTokens', []));
        this.claimedSecretRoomBuffs = new Set(this.save.get('claimedSecretRoomBuffs', []));
    }

    /**
     * Snapshots completedLevels/buffs/tokens/abilities/difficulty into SaveSystem.
     */
    saveProgress() {
        this.save.set('completedLevels', [...this.completedLevels]);
        this.save.set('buffs', [...this.buffs]);
        this.save.set('tokens', this.tokens);
        this.save.set('abilities', [...this.abilities]);
        this.save.set('difficulty', this.difficulty);
        this.save.set('claimedBossTokens', [...this.claimedBossTokens]);
        this.save.set('claimedSecretRoomBuffs', [...this.claimedSecretRoomBuffs]);
    }

    /**
     * Wipes progress back to a fresh start, without touching difficulty.
     */
    resetProgress() {
        this.completedLevels = new Set();
        this.buffs = new Set();
        this.tokens = 0;
        this.abilities = new Set();
        this.claimedBossTokens = new Set();
        this.claimedSecretRoomBuffs = new Set();
    }

    /**
     * Fixed-timestep bookkeeping for the render loop.
     */
    _initLoopState() {
        this._lastTime = 0;
        this._accumulator = 0;
        this._loop = this._loop.bind(this);
        this._handleResize = this._handleResize.bind(this);
    }

    /**
     * Rescales the canvas/overlay to fill the window.
     */
    _handleResize() {
        const rawScale = Math.min(window.innerWidth / this.width, window.innerHeight / this.height);
        const scale = rawScale >= 1 ? Math.floor(rawScale) : rawScale;

        this.viewport.style.width = `${this.width * scale}px`;
        this.viewport.style.height = `${this.height * scale}px`;
        this.overlay.style.width = `${this.width}px`;
        this.overlay.style.height = `${this.height}px`;
        this.overlay.style.transform = `scale(${scale})`;
    }

    /**
     * Ratio of the current render buffer to the base 640x360 resolution.
     * @returns {number}
     */
    get hudScale() {
        return this.width / this._baseWidth;
    }

    /**
     * Switches the internal render buffer to a new resolution (e.g.
     * BossState's arena-sized buffer), animated by default.
     * @param {number} width
     * @param {number} height
     * @param {object} [options]
     * @param {boolean} [options.animate=true]
     */
    resizeBuffer(width, height, { animate = true } = {}) {
        if (animate) {
            this._startResizeTransition();
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this._handleResize();
        this.overlay.style.setProperty('--hud-scale', this.hudScale);

        if (animate) {
            this._clearResizeTransitionAfterDelay();
        }
    }

    /**
     * Starts the viewport's grow/shrink CSS transition before a buffer resize.
     */
    _startResizeTransition() {
        this.viewport.style.transition = `width ${BUFFER_RESIZE_TRANSITION_SECONDS}s ease, height ${BUFFER_RESIZE_TRANSITION_SECONDS}s ease`;
    }

    /**
     * Clears the transition once it's played out.
     */
    _clearResizeTransitionAfterDelay() {
        setTimeout(() => { this.viewport.style.transition = ''; }, BUFFER_RESIZE_TRANSITION_SECONDS * 1000);
    }

    /**
     * Restores the base 640x360 buffer, instantly (animate: false).
     */
    resetBuffer() {
        this.resizeBuffer(this._baseWidth, this._baseHeight, { animate: false });
    }

    /**
     * Kicks off the requestAnimationFrame render loop.
     */
    start() {
        requestAnimationFrame(this._loop);
    }

    /**
     * One requestAnimationFrame tick: advances the state machine in fixed
     * 1/60s steps to catch up with real elapsed time, then renders once.
     * @param {number} timestamp - High-resolution timestamp from rAF.
     */
    _loop(timestamp) {
        const frameTime = Math.min(this._lastTime ? (timestamp - this._lastTime) / 1000 : 0, FRAME_TIME_CAP_SECONDS);
        this._lastTime = timestamp;

        this._advanceFixedSteps(frameTime);

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.stateMachine.render(this.ctx);

        requestAnimationFrame(this._loop);
    }

    /**
     * Advances the state machine in fixed steps to catch up with frameTime.
     * Drops the accumulator entirely while landscapeGate is blocking.
     * @param {number} frameTime - Elapsed real time since the last frame, in seconds.
     */
    _advanceFixedSteps(frameTime) {
        if (this.landscapeGate?.isBlocking) {
            this._accumulator = 0;
            return;
        }

        this._accumulator += frameTime;
        while (this._accumulator >= FIXED_DT) {
            this.stateMachine.update(FIXED_DT);
            this._accumulator -= FIXED_DT;
        }
    }
}
