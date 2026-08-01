import { StateMachine } from './StateMachine.js';

// Gameplay updates run in fixed 1/60s steps regardless of the display's
// actual refresh rate/frame timing (TODO.md "Jump apex ~5px short on
// another machine/browser") - semi-implicit Euler integration
// (vy += gravity*dt; y += vy*dt, see Player.js) is step-size sensitive, so
// a variable per-frame dt produced a slightly different arc on every
// machine. A fixed step makes every velocity-driven motion identical
// everywhere; only rendering still happens once per requestAnimationFrame
// call, so visuals stay as smooth as the display allows. _loop()'s
// frameTime clamp (FRAME_TIME_CAP_SECONDS) bounds how many catch-up steps a
// single frame can inject into the accumulator, so a stutter/GC pause/tab
// switch produces a few extra fixed steps in a row instead of one oversized
// one. _handleResize() snaps to the nearest whole-number scale instead of an
// exact fractional fit - image-rendering:pixelated nearest-neighbor
// upscaling at a non-integer factor was a real, reported Firefox
// performance/shimmer issue (every source pixel maps to a *whole* number of
// destination pixels only at an integer scale). Trade-off: visible
// letterbox bars whenever the window isn't an exact multiple of 640x360 -
// previously avoided on purpose, reinstated because the performance cost
// turned out to matter more. _initSharedState()'s completedLevels (level
// numbers completed, read by WorldmapState to unlock the next node) and
// buffs (permanent character buffs earned from Secret Rooms, see
// docs/GDD/02_game-structure.md 2.5) both live on Game rather than on any
// State, since States are fully torn down/rebuilt on every enter()/exit()
// (see StateMachine) - persisted across reloads via SaveSystem
// (loadProgress()/saveProgress() below), and buffs gets re-applied to every
// fresh Player instance GameState.enter() constructs (see Player.applyBuff()).
const FIXED_DT = 1 / 60;
const FRAME_TIME_CAP_SECONDS = 0.05;

// resizeBuffer()'s viewport CSS transition (see that method) - how long the
// on-screen game box takes to grow/shrink into its new size, e.g. switching
// into BossState's own arena-sized buffer. First-guess, same reasoning as
// every other timing constant in this codebase - needs a real look once
// there's an actual boss arena buffer swap to watch it against.
const BUFFER_RESIZE_TRANSITION_SECONDS = 0.3;

export class Game {
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
        // Base resolution as shipped in index.html's <canvas> attributes -
        // resizeBuffer()/resetBuffer() below read this rather than
        // hardcoding 640x360 a second time.
        this._baseWidth = this.width;
        this._baseHeight = this.height;

        this.stateMachine = new StateMachine(this);
        this._initSharedState();
        this._initLoopState();

        window.addEventListener('resize', this._handleResize);
        this._handleResize();
    }

    /**
     * Cross-state data that outlives any single State's enter()/exit() cycle
     * (states are fully torn down/rebuilt on every switch, see StateMachine).
     */
    _initSharedState() {
        this.assets = null;
        this.input = null;
        // Empty/default placeholders - main.js calls loadProgress() right
        // after constructing SaveSystem (which doesn't exist yet at this
        // point in the constructor) to fill these in from a real save, if
        // one exists. See loadProgress()/saveProgress() below.
        this.difficulty = null;
        this.completedLevels = new Set();
        this.buffs = new Set();
        this.tokens = 0;
        this.abilities = new Set();
    }

    /**
     * Restores completedLevels/buffs/tokens/abilities/difficulty from
     * SaveSystem - called once from main.js right after game.save is
     * assigned, since this.save doesn't exist yet during _initSharedState().
     * Sets round-trip as plain arrays (SaveSystem stores JSON).
     */
    loadProgress() {
        this.completedLevels = new Set(this.save.get('completedLevels', []));
        this.buffs = new Set(this.save.get('buffs', []));
        this.tokens = this.save.get('tokens', 0);
        this.abilities = new Set(this.save.get('abilities', []));
        this.difficulty = this.save.get('difficulty', null);
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
     */
    _handleResize() {
        const rawScale = Math.min(window.innerWidth / this.width, window.innerHeight / this.height);
        const scale = rawScale >= 1 ? Math.floor(rawScale) : rawScale;

        this.viewport.style.width = `${this.width * scale}px`;
        this.viewport.style.height = `${this.height * scale}px`;
        // #ui-overlay's own width/height default to 640x360 in style.css
        // (--game-width/--game-height) - only ever correct for the base
        // buffer. Session bugfix: BossState.js's arena-sized buffer left the
        // overlay at that stale 640x360 box, scaled but never resized, so
        // anything centered inside it (e.g. Pause's panel, inset:0 on
        // .panel-backdrop) centered on that smaller sub-region instead of
        // the actual (bigger) boss canvas - reading as pinned toward the
        // top-left. Setting these here, inline, overrides the CSS default
        // to always match the current buffer.
        this.overlay.style.width = `${this.width}px`;
        this.overlay.style.height = `${this.height}px`;
        this.overlay.style.transform = `scale(${scale})`;
    }

    /**
     * How much bigger the current render buffer is than the base 640x360 -
     * BossState's arena-sized buffer (e.g. Lv_3's is 960x512) makes
     * _handleResize()'s window-fit scale shrink for the same physical
     * window, so anything sized in fixed buffer-pixels would otherwise
     * render smaller on screen during a boss fight than in a normal level.
     * HUD.js/LevelSession.js/BossState.js multiply their own screen-fixed
     * (not world-anchored) HUD metrics by this so the on-screen size stays
     * constant regardless of buffer size - the CSS side reads the same ratio
     * via the --hud-scale custom property (see resizeBuffer()).
     * @returns {number}
     */
    get hudScale() {
        return this.width / this._baseWidth;
    }

    /**
     * Switches the internal render resolution away from the base 640x360 -
     * used by BossState for its own arena-sized buffer. Changing the canvas
     * element's own width/height clears its pixel buffer and resets 2D
     * context state, but
     * nothing here relies on that surviving a resize (every frame redraws
     * from scratch, see _loop()'s clearRect + this.imageSmoothingEnabled is
     * never set, only the CSS `image-rendering: pixelated` on the element,
     * which isn't affected). `animate` (on by default) plays the viewport's
     * CSS transition so the on-screen box grows/shrinks smoothly instead of
     * snapping - the right call while BossState.enter() is growing into the
     * same continuous scene. resetBuffer() below passes false: by the time
     * that runs, the state that resized us is already exit()ing into an
     * unrelated screen (Worldmap/Menu), so an animated shrink would just
     * read as a stray jump instead of a meaningful zoom, and the next
     * screen should already be at its final size before it's ever shown.
     * @param {number} width
     * @param {number} height
     * @param {object} [options]
     * @param {boolean} [options.animate=true]
     */
    resizeBuffer(width, height, { animate = true } = {}) {
        if (animate) {
            this.viewport.style.transition = `width ${BUFFER_RESIZE_TRANSITION_SECONDS}s ease, height ${BUFFER_RESIZE_TRANSITION_SECONDS}s ease`;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this._handleResize();
        this.overlay.style.setProperty('--hud-scale', this.hudScale);

        // Clears the transition once it's played out so a later window-drag
        // resize (via the resize listener calling _handleResize() directly,
        // never this method) tracks the cursor instantly again instead of
        // lagging behind a still-active transition.
        if (animate) {
            setTimeout(() => { this.viewport.style.transition = ''; }, BUFFER_RESIZE_TRANSITION_SECONDS * 1000);
        }
    }

    /**
     * Restores the base 640x360 buffer - the inverse of resizeBuffer(),
     * called once a dedicated-resolution state (BossState) exits. Instant
     * (animate: false, see resizeBuffer()'s own comment) - always happens
     * mid state-change into an unrelated screen, never a continuous scene
     * worth animating.
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

        // LandscapeGate's portrait prompt fully blocks gameplay, not just
        // visually - dropping the accumulator (rather than merely skipping
        // the while loop below) also prevents a catch-up burst of queued
        // steps firing all at once the moment the device is rotated back.
        if (this.landscapeGate?.isBlocking) {
            this._accumulator = 0;
        } else {
            this._accumulator += frameTime;
            while (this._accumulator >= FIXED_DT) {
                this.stateMachine.update(FIXED_DT);
                this._accumulator -= FIXED_DT;
            }
        }

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.stateMachine.render(this.ctx);

        requestAnimationFrame(this._loop);
    }
}
