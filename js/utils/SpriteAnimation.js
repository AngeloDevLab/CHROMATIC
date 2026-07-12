export class SpriteAnimation {
    constructor(image, frameWidth, frameHeight, frameCount, fps = 10) {
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.frameCount = frameCount;
        this.frameDuration = 1 / fps;

        this.elapsed = 0;
        this.currentFrame = 0;

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
    }

    update(dt) {
        this.elapsed += dt;
        while (this.elapsed >= this.frameDuration) {
            this.elapsed -= this.frameDuration;
            this.currentFrame = (this.currentFrame + 1) % this.frameCount;
        }
    }

    draw(ctx, dx, dy, dw, dh) {
        const sx = this.currentFrame * this.frameWidth;
        ctx.drawImage(this.image, sx, 0, this.frameWidth, this.frameHeight, dx, dy, dw, dh);
    }
}
