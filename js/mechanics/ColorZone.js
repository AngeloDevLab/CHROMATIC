// 03_mechanics.md 4.1: "Boss defeated -> the entire level turns colorful -
// color explosion". Duration of the expanding-circle sweep triggered by
// triggerFullReveal().
const FULL_REVEAL_DURATION_SECONDS = 1.5;

export class ColorZone {
    // fadeDurationSeconds: how long a reveal stays visible before fading back to
    // grey. Infinity (default) matches the real game mechanic (03_mechanics.md 4.1 -
    // color stays permanently). A finite value (e.g. 5) is for decorative uses (the
    // menu living background) where the trail should linger and then dissolve back
    // to grey instead of staying forever.
    // greyTint: optional { sepia, hueRotate, saturate } cast applied on top of the
    // neutral grayscale (e.g. a cold blue tone for a more ominous look) - grayscale
    // alone removes all color, so hue-rotate needs the sepia pass to reintroduce
    // some chroma to rotate in the first place.
    constructor(width, height, revealRadius = 24, {
        fadeDurationSeconds = Infinity,
        stampIntervalSeconds = 0.1,
        greyBrightness = 1,
        greyTint = null,
    } = {}) {
        this.width = width;
        this.height = height;
        this.revealRadius = revealRadius;
        this.fadeDurationSeconds = fadeDurationSeconds;
        this.stampIntervalSeconds = stampIntervalSeconds;
        this.greyBrightness = greyBrightness;
        this.greyTint = greyTint;

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

        // Permanent mode only: last punched position, see update() below.
        this._lastPermanentPunch = null;

        // Scratch canvas for darken()'s soft-edged grey patch - kept around
        // instead of allocated per call.
        this._scratchCanvas = document.createElement('canvas');
        this._scratchCanvas.width = width;
        this._scratchCanvas.height = height;
        this._scratchCtx = this._scratchCanvas.getContext('2d');

        // triggerFullReveal() state - see update() and that method below.
        this._fullReveal = null;
    }

    paintGreyFrom(colorSourceCanvas) {
        const templateCtx = this.greyTemplateCanvas.getContext('2d');
        templateCtx.clearRect(0, 0, this.width, this.height);
        templateCtx.save();

        const filters = ['grayscale(1)'];
        if (this.greyTint) {
            const { sepia, hueRotate, saturate } = this.greyTint;
            filters.push(`sepia(${sepia})`, `hue-rotate(${hueRotate}deg)`, `saturate(${saturate})`);
        }
        filters.push(`brightness(${this.greyBrightness})`);
        templateCtx.filter = filters.join(' ');

        templateCtx.drawImage(colorSourceCanvas, 0, 0);
        templateCtx.restore();

        this.overlayCtx.clearRect(0, 0, this.width, this.height);
        this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
    }

    // Call once per frame with the current reveal point. Permanent mode punches
    // directly into the persistent overlay (unchanged real-game behavior); fade mode
    // tracks aging stamps and rebuilds the overlay from scratch each frame.
    update(dt, x, y) {
        if (this._fullReveal) {
            this._updateFullReveal(dt);
            return;
        }

        if (this.fadeDurationSeconds === Infinity) {
            // Skip re-stamping an unchanged position (e.g. player standing still):
            // this punches directly into the persistent overlay rather than
            // rebuilding from the grey template like fade mode does, so punching
            // the same soft-edged gradient there every single frame compounds
            // destination-out alpha in the outer fade ring toward fully erased -
            // the intended soft falloff collapses into a hard cutoff after enough
            // repeated frames at the same spot. Staying colorful right around the
            // player regardless of what else touches the overlay (e.g. an enemy's
            // darken()) is render()'s liveGlow instead - see below - so this can
            // stay a simple skip with no exceptions.
            const last = this._lastPermanentPunch;
            if (!last || last.x !== x || last.y !== y) {
                this._punch(this.overlayCtx, x, y, 1);
                this._lastPermanentPunch = { x, y };
            }
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

    // 03_mechanics.md 4.1: "Enemy crosses a colored area -> the area turns back
    // to dark". The inverse of _punch: instead of erasing the overlay
    // (revealing color), this repaints the grey template back onto the overlay
    // in a soft-edged patch, restoring grey there regardless of how it got
    // revealed in the first place.
    darken(x, y, radius = this.revealRadius) {
        const gradient = this._scratchCtx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(0.55, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this._scratchCtx.clearRect(0, 0, this.width, this.height);
        this._scratchCtx.drawImage(this.greyTemplateCanvas, 0, 0);
        this._scratchCtx.globalCompositeOperation = 'destination-in';
        this._scratchCtx.fillStyle = gradient;
        this._scratchCtx.beginPath();
        this._scratchCtx.arc(x, y, radius, 0, Math.PI * 2);
        this._scratchCtx.fill();
        this._scratchCtx.globalCompositeOperation = 'source-over';

        this.overlayCtx.drawImage(this._scratchCanvas, 0, 0);
    }

    // 03_mechanics.md 4.1: "Boss defeated -> the entire level turns colorful -
    // color explosion". Standing in for that here since Lv_1 has no boss yet -
    // GameState triggers this once all of the level's enemies are dead. Expands
    // a full-strength reveal circle from (originX, originY) out past the whole
    // canvas over FULL_REVEAL_DURATION_SECONDS, then clears the overlay outright
    // to guarantee full coverage (a growing circle never quite reaches the
    // canvas's corners).
    triggerFullReveal(originX, originY) {
        this._fullReveal = {
            originX,
            originY,
            elapsed: 0,
            maxRadius: Math.hypot(this.width, this.height),
        };
    }

    _updateFullReveal(dt) {
        this._fullReveal.elapsed += dt;
        const progress = Math.min(1, this._fullReveal.elapsed / FULL_REVEAL_DURATION_SECONDS);

        if (progress >= 1) {
            this.overlayCtx.clearRect(0, 0, this.width, this.height);
            this._fullReveal = null;
            return;
        }

        this._punch(this.overlayCtx, this._fullReveal.originX, this._fullReveal.originY, 1, this._fullReveal.maxRadius * progress);
    }

    _punch(ctx, x, y, strength, radius = this.revealRadius) {
        // Radial gradient instead of a flat fill: fully erases (reveals color) up to
        // 55% of the radius, then fades back to no effect at the edge - a soft
        // color/grey transition instead of a hard circle outline. `strength` additionally
        // scales the whole effect down as a fade-mode stamp ages.
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(0.55, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // liveGlow: optional { x, y, radius } - punches an extra hole for this
    // frame's render only, on a scratch copy, never written back into
    // overlayCanvas. This is how the player's immediate area always reads as
    // revealed (03_mechanics.md 4.1 flavor: their own presence pushes back the
    // Darkness) regardless of what an enemy's darken() did to the persistent
    // overlay right there - recomputed identically from scratch every frame,
    // so unlike punching the real overlay repeatedly, it can never erode.
    render(ctx, liveGlow = null) {
        if (!liveGlow) {
            ctx.drawImage(this.overlayCanvas, 0, 0);
            return;
        }

        this._scratchCtx.clearRect(0, 0, this.width, this.height);
        this._scratchCtx.drawImage(this.overlayCanvas, 0, 0);
        this._punch(this._scratchCtx, liveGlow.x, liveGlow.y, 1, liveGlow.radius ?? this.revealRadius);
        ctx.drawImage(this._scratchCanvas, 0, 0);
    }
}
