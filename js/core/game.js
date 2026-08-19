import { StateMachine } from './state-machine.js';
import { isTouchCapable } from '../ui/touch-controls.js';

/**
 * Fixed gameplay timestep, independent of the display's frame rate.
 */
const fixed_dt = 1 / 60;

/**
 * Caps how many catch-up steps a single frame's accumulator can inject.
 */
const frame_time_cap_seconds = 0.05;

/**
 * How long resizeBuffer()'s viewport CSS transition takes to grow/shrink into its new size.
 */
const buffer_resize_transition_seconds = 0.3;

/**
 * Owns the canvas/overlay/viewport DOM refs and the fixed-timestep render
 * loop, every cross-state singleton system (assets/input/save/sound/music),
 * and the player's persisted progress (difficulty/completedLevels/tokens/etc.).
 */
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
     * Sets up the canvas/overlay DOM refs and state machine, then starts listening for resize.
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
     * SaveSystem (`this.save`).
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
     * Snapshots completedLevels/buffs/tokens/abilities/difficulty into SaveSystem (`this.save`).
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
        const scale = this._scaleFor(rawScale);

        this.viewport.style.width = `${this.width * scale}px`;
        this.viewport.style.height = `${this.height * scale}px`;
        this.overlay.style.width = `${this.width}px`;
        this.overlay.style.height = `${this.height}px`;
        this.overlay.style.transform = `scale(${scale})`;
    }

    /**
     * Rounds down to a whole-number scale to avoid a Firefox upscaling shimmer, except on touch devices where filling the viewport exactly matters more.
     * @param {number} rawScale - Exact fit-to-window scale factor.
     * @returns {number} Whole-number scale on non-touch devices, exact fractional scale on touch.
     */
    _scaleFor(rawScale) {
        if (isTouchCapable()) return rawScale;
        return rawScale >= 1 ? Math.floor(rawScale) : rawScale;
    }

    /**
     * Ratio of the current render buffer to the base 640x360 resolution.
     * @returns {number}
     */
    get hudScale() {
        return this.width / this._baseWidth;
    }

    /**
     * Switches the internal render buffer to a new resolution (e.g. BossState's arena-sized buffer), animated by default. Safe to swap mid-game since every frame redraws from scratch.
     * @param {number} width - New render buffer width, in pixels.
     * @param {number} height - New render buffer height, in pixels.
     * @param {object} [options] - Optional settings.
     * @param {boolean} [options.animate=true] - Whether to animate the viewport transition.
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
        this.viewport.style.transition = `width ${buffer_resize_transition_seconds}s ease, height ${buffer_resize_transition_seconds}s ease`;
    }

    /**
     * Clears the transition once it's played out.
     */
    _clearResizeTransitionAfterDelay() {
        setTimeout(() => { this.viewport.style.transition = ''; }, buffer_resize_transition_seconds * 1000);
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
        const frameTime = Math.min(this._lastTime ? (timestamp - this._lastTime) / 1000 : 0, frame_time_cap_seconds);
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
        while (this._accumulator >= fixed_dt) {
            this.stateMachine.update(fixed_dt);
            this._accumulator -= fixed_dt;
        }
    }
}
