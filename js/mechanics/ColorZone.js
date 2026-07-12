export class ColorZone {
    // fadeDurationSeconds: how long a reveal stays visible before fading back to
    // grey. Infinity (default) matches the real game mechanic (03_mechanics.md 4.1 -
    // color stays permanently). A finite value (e.g. 5) is for decorative uses (the
    // menu living background) where the trail should linger and then dissolve back
    // to grey instead of staying forever.
    constructor(width, height, revealRadius = 24, { fadeDurationSeconds = Infinity, stampIntervalSeconds = 0.1, greyBrightness = 1 } = {}) {
        this.width = width;
        this.height = height;
        this.revealRadius = revealRadius;
        this.fadeDurationSeconds = fadeDurationSeconds;
        this.stampIntervalSeconds = stampIntervalSeconds;
        this.greyBrightness = greyBrightness;

        this.greyTemplateCanvas = document.createElement('canvas');
        this.greyTemplateCanvas.width = width;
        this.greyTemplateCanvas.height = height;

        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        // Fade mode only: recent reveal positions with their own age, redrawn fresh
        // from the untouched grey template every frame instead of repeatedly blending
        // the overlay with itself (which drifts/rounds away from the original grey
        // over many frames).
        this._stamps = [];
        this._timeSinceLastStamp = Infinity;
    }

    paintGreyFrom(colorSourceCanvas) {
        const templateCtx = this.greyTemplateCanvas.getContext('2d');
        templateCtx.clearRect(0, 0, this.width, this.height);
        templateCtx.save();
        templateCtx.filter = `grayscale(1) brightness(${this.greyBrightness})`;
        templateCtx.drawImage(colorSourceCanvas, 0, 0);
        templateCtx.restore();

        this.overlayCtx.clearRect(0, 0, this.width, this.height);
        this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
    }

    // Call once per frame with the current reveal point. Permanent mode punches
    // directly into the persistent overlay (unchanged real-game behavior); fade mode
    // tracks aging stamps and rebuilds the overlay from scratch each frame.
    update(dt, x, y) {
        if (this.fadeDurationSeconds === Infinity) {
            this._punch(this.overlayCtx, x, y, 1);
            return;
        }

        this._timeSinceLastStamp += dt;
        if (this._timeSinceLastStamp >= this.stampIntervalSeconds) {
            this._stamps.push({ x, y, age: 0 });
            this._timeSinceLastStamp = 0;
        }

        for (const stamp of this._stamps) stamp.age += dt;
        this._stamps = this._stamps.filter((stamp) => stamp.age < this.fadeDurationSeconds);

        this.overlayCtx.clearRect(0, 0, this.width, this.height);
        this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
        for (const stamp of this._stamps) {
            const strength = 1 - stamp.age / this.fadeDurationSeconds;
            this._punch(this.overlayCtx, stamp.x, stamp.y, strength);
        }

        // The throttled stamps above are what fades out behind the character - but
        // the leading edge has to track the exact current position every single
        // frame, not just once per stampIntervalSeconds, or it visibly steps between
        // stamps. One extra full-strength punch at the live position on top of them.
        this._punch(this.overlayCtx, x, y, 1);
    }

    _punch(ctx, x, y, strength) {
        // Radial gradient instead of a flat fill: fully erases (reveals color) up to
        // 55% of the radius, then fades back to no effect at the edge - a soft
        // color/grey transition instead of a hard circle outline. `strength` additionally
        // scales the whole effect down as a fade-mode stamp ages.
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, this.revealRadius);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(0.55, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, this.revealRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    render(ctx) {
        ctx.drawImage(this.overlayCanvas, 0, 0);
    }
}
