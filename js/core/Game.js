import { StateMachine } from './StateMachine.js';

// _handleResize() snaps to the nearest whole-number scale instead of an
// exact fractional fit - image-rendering:pixelated nearest-neighbor
// upscaling at a non-integer factor was a real, reported Firefox
// performance/shimmer issue (every source pixel maps to a *whole* number of
// destination pixels only at an integer scale). Trade-off: visible
// letterbox bars whenever the window isn't an exact multiple of 640x360 -
// previously avoided on purpose, reinstated because the performance cost
// turned out to matter more.

/**
 * Fixed gameplay timestep, independent of the display's frame rate - keeps
 * velocity-driven motion (e.g. Player.js's gravity/jump arc) identical on
 * every machine regardless of refresh rate.
 */
const FIXED_DT = 1 / 60;

/**
 * Caps how many catch-up steps a single frame's accumulator can inject, so
 * a stutter/GC pause/tab switch produces a few extra fixed steps instead of
 * one oversized one.
 */
const FRAME_TIME_CAP_SECONDS = 0.05;

/**
 * How long resizeBuffer()'s viewport CSS transition takes to grow/shrink
 * into its new size (e.g. BossState's arena buffer) - first-guess, needs a
 * real look once there's an actual buffer swap to watch it against.
 */
const BUFFER_RESIZE_TRANSITION_SECONDS = 0.3;

export class Game {
    /**
     * Base 640x360 resolution as shipped in index.html's <canvas>
     * attributes - resizeBuffer()/resetBuffer() read these instead of
     * hardcoding 640x360 a second time.
     */
    _baseWidth;
    _baseHeight;

    /**
     * Cross-state data that outlives any single State's enter()/exit() cycle
     * (states are fully torn down/rebuilt on every switch, see StateMachine).
     */
    assets = null;
    input = null;

    /**
     * Placeholders - main.js calls loadProgress() right after constructing
     * SaveSystem (which doesn't exist yet at construction time) to fill
     * these in from a real save, if one exists (see loadProgress()/
     * saveProgress() below). completedLevels is read by WorldmapState to
     * unlock the next node; buffs (docs/GDD/02_game-structure.md 2.5) gets
     * re-applied to every fresh Player instance GameState.enter()
     * constructs (see Player.applyBuff()).
     */
    difficulty = null;
    completedLevels = new Set();
    buffs = new Set();
    tokens = 0;
    abilities = new Set();

    /**
     * Levels whose boss Token reward has already been granted once -
     * separate from completedLevels (which only ever gets set via the exit
     * portal) so replaying an already-fought boss level can't drop fresh
     * Tokens again just because the player never reached the portal on a
     * prior visit (Interactables.js's onBossDefeated()).
     */
    claimedBossTokens = new Set();

    /**
     * Same reasoning as claimedBossTokens above, but for a level's Secret
     * Room buff choice (BuffState.js's _choose()) - buffs alone can't guard
     * this, since it's a Set of buff *types* (cumulative once more Secret
     * Rooms exist in later chapters, see 03_mechanics.md 4.5), not
     * per-level, so it can't tell "already claimed this level's buff" apart
     * from "never claimed this buff type from any Secret Room yet".
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
     * SaveSystem - called once from main.js right after game.save is
     * assigned, since this.save doesn't exist yet at construction time.
     * Sets round-trip as plain arrays (SaveSystem stores JSON).
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
     * Snapshots completedLevels/buffs/tokens/abilities/difficulty into
     * SaveSystem - call after mutating any of them (LevelSession's level
     * completion, BuffState's buff choice, Interactables'/DevPanel's Token
     * and ability grants, MenuState's difficulty pick) so progress survives
     * a reload instead of only lasting the current tab session.
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
     * Wipes progress back to a fresh start - MenuState calls this once New
     * Game's difficulty pick is confirmed (then sets the new difficulty and
     * calls saveProgress() itself), since a persisted save would otherwise
     * make New Game silently resume the old one instead of actually
     * restarting. Doesn't touch difficulty itself; the caller is about to
     * overwrite it anyway.
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
     * Rescales the canvas/overlay to fill the window at the nearest
     * whole-number scale (see the top-of-file note on why not fractional).
     * Also explicitly resyncs the overlay's size/transform instead of
     * relying on its CSS defaults (640x360), so a resized buffer (e.g.
     * BossState's arena) doesn't leave UI elements positioned against a
     * stale box.
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
     * Ratio of the current render buffer to the base 640x360 (e.g.
     * BossState's larger arena buffer) - HUD.js/LevelSession.js/BossState.js
     * multiply their screen-fixed metrics by this so HUD elements stay a
     * constant on-screen size regardless of buffer size. CSS mirrors the
     * same ratio via the --hud-scale custom property (see resizeBuffer()).
     * @returns {number}
     */
    get hudScale() {
        return this.width / this._baseWidth;
    }

    /**
     * Switches the internal render resolution away from the base 640x360
     * (used by BossState for its own arena-sized buffer). Safe mid-game:
     * changing the canvas's width/height resets its 2D context state, but
     * every frame redraws from scratch anyway (see _loop()'s clearRect).
     * `animate` (default true) plays a CSS transition so the on-screen box
     * grows/shrinks smoothly instead of snapping - resetBuffer() below
     * passes false instead.
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
     * Starts the viewport's grow/shrink CSS transition before a buffer
     * resize, so the on-screen box animates into its new size instead of
     * snapping.
     */
    _startResizeTransition() {
        this.viewport.style.transition = `width ${BUFFER_RESIZE_TRANSITION_SECONDS}s ease, height ${BUFFER_RESIZE_TRANSITION_SECONDS}s ease`;
    }

    /**
     * Clears the transition once it's played out, so a later window-drag
     * resize tracks the cursor instantly instead of lagging behind it.
     */
    _clearResizeTransitionAfterDelay() {
        setTimeout(() => { this.viewport.style.transition = ''; }, BUFFER_RESIZE_TRANSITION_SECONDS * 1000);
    }

    /**
     * Restores the base 640x360 buffer - the inverse of resizeBuffer(),
     * called once a dedicated-resolution state (BossState) exits. Instant
     * (animate: false) - always happens mid state-change into an unrelated
     * screen, never a continuous scene worth animating.
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
     * LandscapeGate's portrait prompt fully blocks gameplay, not just
     * visually, so it drops the accumulator instead of merely skipping the
     * loop below - that also prevents a catch-up burst of queued steps
     * firing all at once the moment the device is rotated back.
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
