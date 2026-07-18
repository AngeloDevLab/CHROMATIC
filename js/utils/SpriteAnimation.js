export class SpriteAnimation {
    constructor(image, frameWidth, frameHeight, frameCount, fps = 10, { loop = true } = {}) {
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.frameCount = frameCount;
        this.frameDuration = 1 / fps;
        this.loop = loop;

        this.elapsed = 0;
        this.currentFrame = 0;
        // Non-looping only: true once the last frame has been held for its full
        // duration, so callers (e.g. Player's attack state) know when to switch
        // back to normal locomotion instead of guessing from elapsed time.
        this.finished = false;

        // Sprite sheets typically carry transparent padding around each frame (room
        // for the animation to move within a fixed canvas). groundLineRatio/topRatio
        // locate where the actual artwork starts/ends (as a fraction of frame height,
        // from the top), so callers can align to the visible character - its feet, or
        // its true visual center - instead of the frame's raw edges.
        const bounds = this._detectOpaqueBounds();
        this.topRatio = bounds.top / this.frameHeight;
        this.groundLineRatio = (bounds.bottom + 1) / this.frameHeight;
    }

    _detectOpaqueBounds() {
        const canvas = document.createElement('canvas');
        canvas.width = this.frameWidth;
        canvas.height = this.frameHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.image, 0, 0, this.frameWidth, this.frameHeight, 0, 0, this.frameWidth, this.frameHeight);

        const { data } = ctx.getImageData(0, 0, this.frameWidth, this.frameHeight);

        let top = 0;
        topScan:
        for (let row = 0; row < this.frameHeight; row++) {
            for (let col = 0; col < this.frameWidth; col++) {
                if (data[(row * this.frameWidth + col) * 4 + 3] > 0) {
                    top = row;
                    break topScan;
                }
            }
        }

        let bottom = this.frameHeight - 1;
        bottomScan:
        for (let row = this.frameHeight - 1; row >= 0; row--) {
            for (let col = 0; col < this.frameWidth; col++) {
                if (data[(row * this.frameWidth + col) * 4 + 3] > 0) {
                    bottom = row;
                    break bottomScan;
                }
            }
        }

        return { top, bottom };
    }

    reset() {
        this.elapsed = 0;
        this.currentFrame = 0;
        this.finished = false;
    }

    update(dt) {
        if (this.finished) return;

        this.elapsed += dt;
        while (this.elapsed >= this.frameDuration) {
            this.elapsed -= this.frameDuration;

            if (this.currentFrame + 1 < this.frameCount) {
                this.currentFrame++;
            } else if (this.loop) {
                this.currentFrame = 0;
            } else {
                this.finished = true;
                this.elapsed = 0;
                break;
            }
        }
    }

    // flashAmount (0-1) tints the frame white for hit-feedback, without baking
    // it into the sprite sheet - drawn onto a scratch canvas first so the
    // white fill's source-atop compositing only affects this frame's own
    // opaque pixels, not whatever else is already on the destination canvas.
    draw(ctx, dx, dy, dw, dh, flashAmount = 0) {
        const sx = this.currentFrame * this.frameWidth;

        if (flashAmount <= 0) {
            ctx.drawImage(this.image, sx, 0, this.frameWidth, this.frameHeight, dx, dy, dw, dh);
            return;
        }

        if (!this._flashCtx) {
            const flashCanvas = document.createElement('canvas');
            flashCanvas.width = this.frameWidth;
            flashCanvas.height = this.frameHeight;
            this._flashCtx = flashCanvas.getContext('2d');
        }

        const fctx = this._flashCtx;
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
