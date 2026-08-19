// topRatio/groundLineRatio locate the actual artwork within a frame's transparent padding, so
// callers can align to the visible character instead of the frame's raw edges.


/** A frame-based sprite animation, auto-detecting its artwork's opaque bounds within each frame's padding. */
export class SpriteAnimation {
    /**
     * Sets up playback state and auto-detects the artwork's opaque bounds within a frame.
     * @param {HTMLImageElement} image - Sprite sheet, frames laid out left to right.
     * @param {number} frameWidth - Width of one frame, in pixels.
     * @param {number} frameHeight - Height of one frame, in pixels.
     * @param {number} frameCount - Number of frames in the sheet.
     * @param {number} [fps=10] - Playback speed, frames per second.
     * @param {object} [options] - Optional settings.
     * @param {boolean} [options.loop=true] - Whether the animation repeats.
     */
    constructor(image, frameWidth, frameHeight, frameCount, fps = 10, { loop = true } = {}) {
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.frameCount = frameCount;
        this.frameDuration = 1 / fps;
        this.loop = loop;
        this.elapsed = 0;
        this.currentFrame = 0;
        this.finished = false;

        const bounds = this._detectOpaqueBounds();
        this.topRatio = bounds.top / this.frameHeight;
        this.groundLineRatio = (bounds.bottom + 1) / this.frameHeight;
    }

    /**
     * Finds the vertical bounds of the first frame's actual artwork.
     * @returns {{top: number, bottom: number}} First/last rows containing an opaque pixel.
     */
    _detectOpaqueBounds() {
        const data = this._getFrameImageData();
        return {
            top: this._findOpaqueRow(data, 0, 1),
            bottom: this._findOpaqueRow(data, this.frameHeight - 1, -1),
        };
    }

    /**
     * Renders the animation's first frame to a scratch canvas and reads back its pixels.
     * @returns {Uint8ClampedArray} RGBA pixel data for the frame.
     */
    _getFrameImageData() {
        const canvas = document.createElement('canvas');
        canvas.width = this.frameWidth;
        canvas.height = this.frameHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.image, 0, 0, this.frameWidth, this.frameHeight, 0, 0, this.frameWidth, this.frameHeight);
        return ctx.getImageData(0, 0, this.frameWidth, this.frameHeight).data;
    }

    /**
     * Scans rows from `start` in the given direction for the first opaque pixel.
     * @param {Uint8ClampedArray} data - RGBA pixel data for the frame.
     * @param {number} start - Row to start scanning from.
     * @param {1|-1} step - +1 to scan downward, -1 to scan upward.
     * @returns {number} The first opaque row found, or `start` if none.
     */
    _findOpaqueRow(data, start, step) {
        for (let row = start; row >= 0 && row < this.frameHeight; row += step) {
            for (let col = 0; col < this.frameWidth; col++) {
                if (data[(row * this.frameWidth + col) * 4 + 3] > 0) return row;
            }
        }
        return start;
    }

    /**
     * Restarts playback from the first frame.
     */
    reset() {
        this.elapsed = 0;
        this.currentFrame = 0;
        this.finished = false;
    }

    /**
     * Advances playback by one tick.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this.finished) return;

        this.elapsed += dt;
        while (this.elapsed >= this.frameDuration) {
            this.elapsed -= this.frameDuration;
            if (this._advanceFrame()) break;
        }
    }

    /**
     * Moves to the next frame, or loops/finishes if it was the last one.
     * @returns {boolean} Whether playback just finished (non-looping, last frame held).
     */
    _advanceFrame() {
        if (this.currentFrame + 1 < this.frameCount) {
            this.currentFrame++;
            return false;
        }
        if (this.loop) {
            this.currentFrame = 0;
            return false;
        }
        this.finished = true;
        this.elapsed = 0;
        return true;
    }

    /**
     * Draws the current frame, optionally tinted for hit-feedback.
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     * @param {number} dx - Destination X.
     * @param {number} dy - Destination Y.
     * @param {number} dw - Destination width.
     * @param {number} dh - Destination height.
     * @param {number} [flashAmount=0] - White-tint strength, 0 (none) to 1 (fully white).
     */
    draw(ctx, dx, dy, dw, dh, flashAmount = 0) {
        const sx = this.currentFrame * this.frameWidth;
        if (flashAmount <= 0) {
            ctx.drawImage(this.image, sx, 0, this.frameWidth, this.frameHeight, dx, dy, dw, dh);
            return;
        }
        this._drawFlashed(ctx, sx, dx, dy, dw, dh, flashAmount);
    }

    /**
     * Lazily creates the scratch canvas used to composite the flash tint.
     * @returns {CanvasRenderingContext2D} A scratch canvas sized to one frame, created lazily.
     */
    _getFlashContext() {
        if (!this._flashCtx) {
            const flashCanvas = document.createElement('canvas');
            flashCanvas.width = this.frameWidth;
            flashCanvas.height = this.frameHeight;
            this._flashCtx = flashCanvas.getContext('2d');
        }
        return this._flashCtx;
    }

    /**
     * Composites the current frame tinted white onto the scratch canvas
     * (source-atop keeps the tint confined to the frame's opaque pixels), then draws it.
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     * @param {number} sx - Source X (current frame's offset into the sheet).
     * @param {number} dx - Destination X.
     * @param {number} dy - Destination Y.
     * @param {number} dw - Destination width.
     * @param {number} dh - Destination height.
     * @param {number} flashAmount - White-tint strength, 0 to 1.
     */
    _drawFlashed(ctx, sx, dx, dy, dw, dh, flashAmount) {
        const fctx = this._getFlashContext();
        fctx.clearRect(0, 0, this.frameWidth, this.frameHeight);
        fctx.drawImage(this.image, sx, 0, this.frameWidth, this.frameHeight, 0, 0, this.frameWidth, this.frameHeight);
        fctx.globalCompositeOperation = 'source-atop';
        fctx.globalAlpha = flashAmount;
        fctx.fillStyle = '#fff';
        fctx.fillRect(0, 0, this.frameWidth, this.frameHeight);
        fctx.globalCompositeOperation = 'source-over';
        fctx.globalAlpha = 1;

        ctx.drawImage(fctx.canvas, 0, 0, this.frameWidth, this.frameHeight, dx, dy, dw, dh);
    }
}
