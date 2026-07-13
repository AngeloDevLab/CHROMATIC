import { StateMachine } from './StateMachine.js';

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

        this._lastTime = 0;
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
        const dt = this._lastTime ? (timestamp - this._lastTime) / 1000 : 0;
        this._lastTime = timestamp;

        this.stateMachine.update(dt);

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.stateMachine.render(this.ctx);

        requestAnimationFrame(this._loop);
    }
}
