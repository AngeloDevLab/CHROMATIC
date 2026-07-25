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
// numbers completed this session, read by WorldmapState to unlock the next
// node) and buffs (permanent character buffs earned from Secret Rooms, see
// docs/GDD/02_game-structure.md 2.5) both live on Game rather than on any
// State, since States are fully torn down/rebuilt on every enter()/exit()
// (see StateMachine) - completedLevels has no persistence across reloads
// yet (SaveSystem is the natural home once it's migrated over), and buffs
// gets re-applied to every fresh Player instance GameState.enter()
// constructs (see Player.applyBuff()).
const FIXED_DT = 1 / 60;
const FRAME_TIME_CAP_SECONDS = 0.05;

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
        this.difficulty = null;
        this.completedLevels = new Set();
        this.buffs = new Set();
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
        this.overlay.style.transform = `scale(${scale})`;
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
        this._accumulator += frameTime;

        while (this._accumulator >= FIXED_DT) {
            this.stateMachine.update(FIXED_DT);
            this._accumulator -= FIXED_DT;
        }

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.stateMachine.render(this.ctx);

        requestAnimationFrame(this._loop);
    }
}
