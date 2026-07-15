import { State } from './State.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

const CHARACTER_FRAME_SIZE = 96;
const DARKEN_DURATION = 10;
const FLASH_DURATION = 0.6;
const REVEAL_DURATION = 2;
const IRIS_BLOB_COUNT = 8;
const DARKEN_COLOR = '6, 10, 18';
const DARKEN_MAX_ALPHA = 0.88;
const TEXT_CHARS_PER_SECOND = 10;

const DARKENING_TEXT = 'The Darkness reaches this world too.<br> It spreads, devouring land and color.';
const ARRIVAL_TEXT = 'Just before the world sinks completely into Darkness,<br> a burst of color splits the dark.';

// Intro cutscene, built entirely from the beach background + the existing idle
// sprite - no dedicated "materializing" animation needed. Sequence: beach in
// color, darkening from the edges inward (iris effect) until fully dark, a
// white flash (the moment of arrival), then fading back from white with the
// Guardian now present.
export class CutsceneState extends State {
    enter() {
        this._onKeyDown = this._onKeyDown.bind(this);

        this.phase = 'darken';
        this.phaseTime = 0;

        this.idleAnimation = new SpriteAnimation(
            this.game.assets.getImage('guardian-idle'),
            CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8
        );

        this._irisBlobs = this._generateIrisBlobs();

        this.textEl = document.createElement('div');
        this.textEl.className = 'cutscene-text';
        this.game.overlay.appendChild(this.textEl);
        this._setText(DARKENING_TEXT);

        this.skipButton = document.createElement('button');
        this.skipButton.className = 'cutscene-skip-button';
        this.skipButton.textContent = 'Skip ▸';
        this.skipButton.addEventListener('click', () => this._finish());
        this.game.overlay.appendChild(this.skipButton);

        window.addEventListener('keydown', this._onKeyDown);
    }

    _onKeyDown(event) {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') this._finish();
    }

    _finish() {
        this.game.stateMachine.change('worldmap');
    }

    exit() {
        window.removeEventListener('keydown', this._onKeyDown);
        this.textEl?.remove();
        this.skipButton?.remove();
    }

    // Reveals the text letter by letter instead of all at once - runs at a
    // fixed pace independent of phase timing, so it keeps typing even after a
    // phase transition (e.g. into "hold") until the full sentence is shown.
    // <br> is kept as one atomic token so the reveal can't cut it mid-tag.
    _setText(text) {
        this._textTokens = text
            .split(/(<br>)/)
            .flatMap((part) => (part === '<br>' ? [part] : part.split('')));
        this._textRevealedCount = 0;
        this._textRevealTimer = 0;
        this.textEl.innerHTML = '';
    }

    _updateText(dt) {
        if (!this._textTokens || this._textRevealedCount >= this._textTokens.length) return;

        this._textRevealTimer += dt;
        const tokensToShow = Math.floor(this._textRevealTimer * TEXT_CHARS_PER_SECOND);
        if (tokensToShow > this._textRevealedCount) {
            this._textRevealedCount = Math.min(tokensToShow, this._textTokens.length);
            this.textEl.innerHTML = this._textTokens.slice(0, this._textRevealedCount).join('');
        }
    }

    update(dt) {
        this.phaseTime += dt;
        this.idleAnimation.update(dt);
        this._updateText(dt);

        if (this.phase === 'darken' && this.phaseTime >= DARKEN_DURATION) {
            this.phase = 'flash';
            this.phaseTime = 0;
            this._setText(ARRIVAL_TEXT);
        } else if (this.phase === 'flash' && this.phaseTime >= FLASH_DURATION) {
            this.phase = 'reveal';
            this.phaseTime = 0;
        } else if (this.phase === 'reveal' && this.phaseTime >= REVEAL_DURATION) {
            this.phase = 'hold';
        }
    }

    render(ctx) {
        const { width: w, height: h } = this.game;
        const bg = this.game.assets.getImage('cutscene-beach-bg');

        this._drawCover(ctx, bg, w, h);

        if (this.phase === 'darken') {
            const t = this.phaseTime / DARKEN_DURATION;
            this._drawIris(ctx, w, h, t);
        } else if (this.phase === 'flash') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        } else if (this.phase === 'reveal') {
            this._drawGuardian(ctx, w, h);
            const t = 1 - this.phaseTime / REVEAL_DURATION;
            ctx.fillStyle = `rgba(255, 255, 255, ${t})`;
            ctx.fillRect(0, 0, w, h);
        } else {
            this._drawGuardian(ctx, w, h);
        }
    }

    // Scales the image to cover the full canvas (like CSS background-size:
    // cover), cropping the overflow instead of leaving empty space or distorting.
    _drawCover(ctx, image, w, h) {
        const scale = Math.max(w / image.width, h / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (w - drawWidth) / 2;
        const y = (h - drawHeight) / 2;
        ctx.drawImage(image, x, y, drawWidth, drawHeight);
    }

    // Several dark blobs anchored around the edge, each growing toward the
    // center at a slightly different angle/rate (fixed once per cutscene, not
    // re-randomized per frame) - reads as an irregular, organic darkness
    // consuming the scene instead of one perfectly circular iris closing.
    _generateIrisBlobs() {
        const blobs = [];
        for (let i = 0; i < IRIS_BLOB_COUNT; i++) {
            const angle = (i / IRIS_BLOB_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const growthRate = 0.75 + Math.random() * 0.5;
            const delay = Math.random() * 0.15;
            blobs.push({ angle, growthRate, delay });
        }
        return blobs;
    }

    // Blobs are drawn fully opaque onto a separate mask canvas first (so their
    // overlaps just union the covered shape), then the whole mask is composited
    // onto the scene once with a single capped alpha - drawing each blob
    // straight onto the scene at DARKEN_MAX_ALPHA would let overlapping blobs
    // stack past that cap and wash out to solid black in the center anyway.
    _drawIris(ctx, w, h, t) {
        if (!this._irisMaskCanvas) {
            this._irisMaskCanvas = document.createElement('canvas');
            this._irisMaskCanvas.width = w;
            this._irisMaskCanvas.height = h;
        }
        const maskCtx = this._irisMaskCanvas.getContext('2d');
        maskCtx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const originDistance = Math.max(w, h) * 0.6;
        const diagonal = Math.hypot(w, h);

        for (const blob of this._irisBlobs) {
            const localT = Math.max(0, Math.min(1, (t - blob.delay) / (1 - blob.delay)));
            const radius = Math.max(diagonal * blob.growthRate * localT, 1);

            const originX = cx + Math.cos(blob.angle) * originDistance;
            const originY = cy + Math.sin(blob.angle) * originDistance;

            const gradient = maskCtx.createRadialGradient(originX, originY, 0, originX, originY, radius);
            gradient.addColorStop(0, `rgba(${DARKEN_COLOR}, 1)`);
            gradient.addColorStop(0.7, `rgba(${DARKEN_COLOR}, 1)`);
            gradient.addColorStop(1, `rgba(${DARKEN_COLOR}, 0)`);

            maskCtx.fillStyle = gradient;
            maskCtx.fillRect(0, 0, w, h);
        }

        if (t >= 0.95) {
            maskCtx.fillStyle = `rgba(${DARKEN_COLOR}, 1)`;
            maskCtx.fillRect(0, 0, w, h);
        }

        ctx.save();
        ctx.globalAlpha = DARKEN_MAX_ALPHA;
        ctx.drawImage(this._irisMaskCanvas, 0, 0);
        ctx.restore();
    }

    _drawGuardian(ctx, w, h) {
        const size = CHARACTER_FRAME_SIZE * 0.75;
        const feetY = h * 0.85;
        this.idleAnimation.draw(ctx, w / 2 - size / 2, feetY - size, size, size);
    }
}
