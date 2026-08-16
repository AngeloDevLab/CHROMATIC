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

// Intro cutscene, built entirely from the beach background + the existing
// idle sprite. Sequence: beach in color, darkening from the edges inward
// (iris effect) until fully dark, a white flash, then fading back from
// white with the Guardian now present.
//
// The iris is drawn as several dark blobs onto a separate mask canvas
// first, then composited onto the scene once with a single capped alpha -
// drawing each blob straight onto the scene would let overlapping blobs
// stack past the cap and wash out to solid black early.
export class CutsceneState extends State {
    /**
     * Sets up the darken -> flash -> reveal phase sequence and its overlay elements.
     */
    enter() {
        this._onKeyDown = this._onKeyDown.bind(this);
        this.phase = 'darken';
        this.phaseTime = 0;
        this.idleAnimation = new SpriteAnimation(
            this.game.assets.getImage('guardian-idle'),
            CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8
        );
        this._irisBlobs = this._generateIrisBlobs();

        this._buildTextOverlay();
        this._buildSkipButton();
        window.addEventListener('keydown', this._onKeyDown);
    }

    /**
     * Builds the typewriter text element and starts the darkening line.
     */
    _buildTextOverlay() {
        this.textEl = document.createElement('div');
        this.textEl.className = 'cutscene-text';
        this.game.overlay.appendChild(this.textEl);
        this._setText(DARKENING_TEXT);
    }

    /**
     * Builds the skip button.
     */
    _buildSkipButton() {
        this.skipButton = document.createElement('button');
        this.skipButton.className = 'cutscene-skip-button';
        this.skipButton.textContent = 'Skip ▸';
        this.skipButton.addEventListener('click', () => this._finish());
        this.game.overlay.appendChild(this.skipButton);
    }

    /**
     * Skips the cutscene on Escape/Enter/Space.
     * @param {KeyboardEvent} event - The browser keydown event.
     */
    _onKeyDown(event) {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') this._finish();
    }

    /**
     * Ends the cutscene and advances to the Worldmap.
     */
    _finish() {
        this.game.stateMachine.change('worldmap');
    }

    /**
     * Tears down the cutscene's listeners/overlay elements.
     */
    exit() {
        window.removeEventListener('keydown', this._onKeyDown);
        this.textEl?.remove();
        this.skipButton?.remove();
    }

    /**
     * Reveals the text letter by letter instead of all at once, keeping <br> as one atomic token.
     * @param {string} text - Text to type out.
     */
    _setText(text) {
        this._textTokens = text
            .split(/(<br>)/)
            .flatMap((part) => (part === '<br>' ? [part] : part.split('')));
        this._textRevealedCount = 0;
        this._textRevealTimer = 0;
        this.textEl.innerHTML = '';
    }

    /**
     * Advances the typewriter reveal by one tick.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateText(dt) {
        if (!this._textTokens || this._textRevealedCount >= this._textTokens.length) return;

        this._textRevealTimer += dt;
        const tokensToShow = Math.floor(this._textRevealTimer * TEXT_CHARS_PER_SECOND);
        if (tokensToShow > this._textRevealedCount) {
            this._textRevealedCount = Math.min(tokensToShow, this._textTokens.length);
            this.textEl.innerHTML = this._textTokens.slice(0, this._textRevealedCount).join('');
        }
    }

    /**
     * Advances the animation, text, and phase timer.
     * @param {number} dt - Elapsed time in seconds.
     */
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

    /**
     * Draws the cover background, then the current phase.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        const { width: w, height: h } = this.game;
        const bg = this.game.assets.getImage('cutscene-beach-bg');
        this._drawCover(ctx, bg, w, h);
        this._drawPhase(ctx, w, h);
    }

    /**
     * Draws whichever phase is currently active.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     */
    _drawPhase(ctx, w, h) {
        if (this.phase === 'darken') {
            this._drawIris(ctx, w, h, this.phaseTime / DARKEN_DURATION);
        } else if (this.phase === 'flash') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        } else if (this.phase === 'reveal') {
            this._drawRevealFade(ctx, w, h);
        } else {
            this._drawGuardian(ctx, w, h);
        }
    }

    /**
     * Guardian fades in from white as the flash clears.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     */
    _drawRevealFade(ctx, w, h) {
        this._drawGuardian(ctx, w, h);
        const t = 1 - this.phaseTime / REVEAL_DURATION;
        ctx.fillStyle = `rgba(255, 255, 255, ${t})`;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * Scales the image to cover the full canvas (like CSS background-size:
     * cover), cropping the overflow instead of leaving empty space or distorting.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {HTMLImageElement} image - Image to draw.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     */
    _drawCover(ctx, image, w, h) {
        const scale = Math.max(w / image.width, h / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (w - drawWidth) / 2;
        const y = (h - drawHeight) / 2;
        ctx.drawImage(image, x, y, drawWidth, drawHeight);
    }

    /**
     * Several dark blobs anchored around the edge, each growing toward the
     * center at a slightly different angle/rate, fixed once per cutscene.
     * @returns {{angle:number,growthRate:number,delay:number}[]}
     */
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

    /**
     * Draws the iris darkening effect at the given progress.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     * @param {number} t - Darken progress, 0 to 1.
     */
    _drawIris(ctx, w, h, t) {
        const maskCtx = this._getIrisMaskContext(w, h);
        this._paintIrisMask(maskCtx, w, h, t);

        ctx.save();
        ctx.globalAlpha = DARKEN_MAX_ALPHA;
        ctx.drawImage(this._irisMaskCanvas, 0, 0);
        ctx.restore();
    }

    /**
     * Lazily creates the scratch canvas used for the iris mask.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     * @returns {CanvasRenderingContext2D} A scratch canvas sized to the scene, created lazily.
     */
    _getIrisMaskContext(w, h) {
        if (!this._irisMaskCanvas) {
            this._irisMaskCanvas = document.createElement('canvas');
            this._irisMaskCanvas.width = w;
            this._irisMaskCanvas.height = h;
        }
        return this._irisMaskCanvas.getContext('2d');
    }

    /**
     * Paints every blob onto the mask, snapping to solid black near full darken.
     * @param {CanvasRenderingContext2D} maskCtx - Mask canvas context.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     * @param {number} t - Darken progress, 0 to 1.
     */
    _paintIrisMask(maskCtx, w, h, t) {
        maskCtx.clearRect(0, 0, w, h);
        const geometry = { cx: w / 2, cy: h / 2, originDistance: Math.max(w, h) * 0.6, diagonal: Math.hypot(w, h) };
        for (const blob of this._irisBlobs) {
            this._paintIrisBlob(maskCtx, w, h, t, blob, geometry);
        }
        if (t >= 0.95) {
            maskCtx.fillStyle = `rgba(${DARKEN_COLOR}, 1)`;
            maskCtx.fillRect(0, 0, w, h);
        }
    }

    /**
     * Paints one blob as a radial gradient growing from its fixed origin.
     * @param {CanvasRenderingContext2D} maskCtx - Mask canvas context.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     * @param {number} t - Darken progress, 0 to 1.
     * @param {{angle:number,growthRate:number,delay:number}} blob - This blob's fixed parameters.
     * @param {{cx:number,cy:number,originDistance:number,diagonal:number}} geometry - Shared scene geometry.
     */
    _paintIrisBlob(maskCtx, w, h, t, blob, geometry) {
        const { cx, cy, originDistance, diagonal } = geometry;
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

    /**
     * Draws the idle Guardian centered near the bottom of the frame.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {number} w - Canvas width.
     * @param {number} h - Canvas height.
     */
    _drawGuardian(ctx, w, h) {
        const size = CHARACTER_FRAME_SIZE * 0.75;
        const feetY = h * 0.85;
        this.idleAnimation.draw(ctx, w / 2 - size / 2, feetY - size, size, size);
    }
}
