import { StateMachine } from './StateMachine.js';

// Gameplay updates run in fixed 1/60s steps regardless of the display's
// actual refresh rate/frame timing (TODO.md "Jump apex ~5px short on another
// machine/browser") - semi-implicit Euler integration (vy += gravity*dt; y +=
// vy*dt, see Player.js) is step-size sensitive, so a variable per-frame dt
// produced a slightly different arc on every machine. A fixed step makes
// every velocity-driven motion identical everywhere; only rendering still
// happens once per requestAnimationFrame call, so visuals stay as smooth as
// the display allows.
const FIXED_DT = 1 / 60;

export class Game {
    constructor(canvasId, overlayId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById(overlayId);
        this.viewport = document.getElementById('viewport');

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.stateMachine = new StateMachine(this);

        this.assets = null;
        this.input = null;
        this.difficulty = null;
        // Level numbers completed this session (WorldmapState reads this to
        // unlock the next node) - lives here rather than on WorldmapState
        // itself since States are torn down/rebuilt on enter()/exit(), so a
        // Set living on WorldmapState would reset every time it's revisited.
        // No persistence across page reloads yet - see TODO.md's LocalStorage
        // save system entry, this becomes the natural save/load target later.
        this.completedLevels = new Set();

        this._lastTime = 0;
        this._accumulator = 0;
        this._loop = this._loop.bind(this);
        this._handleResize = this._handleResize.bind(this);

        window.addEventListener('resize', this._handleResize);
        this._handleResize();
    }

    _handleResize() {
        // Fractional scale, uniformly in every state - fills the window fully (no
        // large letterbox bars from snapping down a whole-number step) and, since
        // it's the exact same formula everywhere, the scale factor never changes
        // between states either (no visual jump opening Pause, entering the Menu,
        // etc.). Trade-off: nearest-neighbor sampling at a fractional scale can
        // shimmer once Camera.js scrolls - accepted for now, revisit only if that's
        // actually visible/bothersome once real scrolling gameplay exists.
        const scale = Math.min(
            window.innerWidth / this.width,
            window.innerHeight / this.height
        );

        this.viewport.style.width = `${this.width * scale}px`;
        this.viewport.style.height = `${this.height * scale}px`;
        this.overlay.style.transform = `scale(${scale})`;
    }

    start() {
        requestAnimationFrame(this._loop);
    }

    _loop(timestamp) {
        // Still clamped the same as before - now bounds how many catch-up
        // steps a single frame can inject into the accumulator below, instead
        // of bounding the size of one physics step directly (a stutter/GC
        // pause/tab-switch produces a few extra fixed steps in a row instead
        // of one oversized one).
        const frameTime = Math.min(this._lastTime ? (timestamp - this._lastTime) / 1000 : 0, 0.05);
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
