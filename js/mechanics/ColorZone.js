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

        // Scratch canvas for darken()'s soft-edged grey patch and render()'s
        // liveGlow, resized per call to just the local patch each one
        // actually needs (see _patchBounds()) rather than the full width x
        // height above - overlayCanvas/greyTemplateCanvas are sized to the
        // whole level, not the viewport, and darken() in particular runs once
        // per living enemy per frame, so operating on the full canvas there
        // was many times more pixels than the visible radius ever needed
        // (a real, measurable performance cost, worse in Firefox than Chrome
        // for this kind of repeated full-surface clear+copy).
        this._scratchCanvas = document.createElement('canvas');
        this._scratchCtx = this._scratchCanvas.getContext('2d');

        // triggerFullReveal() state - see update() and that method below.
        this._fullReveal = null;

        // triggerFullDarken() state - see update() and that method below.
        this._fullDarken = null;
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

        if (this._fullDarken) {
            this._updateFullDarken(dt);
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

    // Bounding box of a radius around (x, y), clamped to the canvas - shared by
    // darken()/render() so both only ever clear/copy/composite that small
    // patch instead of the whole (level-sized) canvas. Naturally falls back to
    // the full canvas once radius grows past it (triggerFullReveal/Darken's
    // sweep), no special-casing needed for that.
    _patchBounds(x, y, radius) {
        const left = Math.max(0, Math.floor(x - radius));
        const top = Math.max(0, Math.floor(y - radius));
        const right = Math.min(this.width, Math.ceil(x + radius));
        const bottom = Math.min(this.height, Math.ceil(y + radius));
        return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    }

    // 03_mechanics.md 4.1: "Enemy crosses a colored area -> the area turns back
    // to dark". The inverse of _punch: instead of erasing the overlay
    // (revealing color), this repaints the grey template back onto the overlay
    // in a soft-edged patch, restoring grey there regardless of how it got
    // revealed in the first place.
    darken(x, y, radius = this.revealRadius) {
        const patch = this._patchBounds(x, y, radius);
        this._scratchCanvas.width = patch.width;
        this._scratchCanvas.height = patch.height;

        const localX = x - patch.x;
        const localY = y - patch.y;
        const gradient = this._scratchCtx.createRadialGradient(localX, localY, 0, localX, localY, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(0.55, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this._scratchCtx.drawImage(this.greyTemplateCanvas, patch.x, patch.y, patch.width, patch.height, 0, 0, patch.width, patch.height);
        this._scratchCtx.globalCompositeOperation = 'destination-in';
        this._scratchCtx.fillStyle = gradient;
        this._scratchCtx.beginPath();
        this._scratchCtx.arc(localX, localY, radius, 0, Math.PI * 2);
        this._scratchCtx.fill();
        this._scratchCtx.globalCompositeOperation = 'source-over';

        this.overlayCtx.drawImage(this._scratchCanvas, patch.x, patch.y);
    }

    // One-time reveal punch at a location (e.g. an enemy's death spot) - unlike
    // update()'s continuous per-frame reveal at the live player position, this
    // fires once and leaves the erased hole exactly as it is afterward.
    reveal(x, y, radius = this.revealRadius) {
        this._punch(this.overlayCtx, x, y, 1, radius);
    }

    // Whether a triggerFullReveal()/triggerFullDarken() sweep is still playing
    // out. Callers that stop caring about per-frame position tracking once
    // their own one-off transition finishes (e.g. GameState after a player
    // death) can gate their update() calls on this, instead of update() falling
    // through to its normal per-frame reveal-at-(x,y) behavior the instant the
    // transition ends.
    get isTransitioning() {
        return !!this._fullReveal || !!this._fullDarken;
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

    // Player death - the inverse of triggerFullReveal(): instead of erasing the
    // overlay to show color, repaints it with the grey template, expanding out
    // from (originX, originY) until the whole level is grey again.
    triggerFullDarken(originX, originY) {
        this._fullDarken = {
            originX,
            originY,
            elapsed: 0,
            maxRadius: Math.hypot(this.width, this.height),
        };
    }

    _updateFullDarken(dt) {
        this._fullDarken.elapsed += dt;
        const progress = Math.min(1, this._fullDarken.elapsed / FULL_REVEAL_DURATION_SECONDS);

        if (progress >= 1) {
            this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
            this._fullDarken = null;
            return;
        }

        this.darken(this._fullDarken.originX, this._fullDarken.originY, this._fullDarken.maxRadius * progress);
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

        // The patch (overlay sub-rect with a hole actually punched into it)
        // has to be the ONLY thing drawn over the patch region - drawing the
        // full overlay there too (even first, even "underneath") would leave
        // opaque overlay pixels behind the hole, since compositing a
        // transparent pixel over an opaque one is a no-op. So the base
        // overlay draw below excludes exactly that rect (evenodd clip), and
        // only the small patch fills it in.
        const radius = liveGlow.radius ?? this.revealRadius;
        const patch = this._patchBounds(liveGlow.x, liveGlow.y, radius);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.width, this.height);
        ctx.rect(patch.x, patch.y, patch.width, patch.height);
        ctx.clip('evenodd');
        ctx.drawImage(this.overlayCanvas, 0, 0);
        ctx.restore();

        this._scratchCanvas.width = patch.width;
        this._scratchCanvas.height = patch.height;
        this._scratchCtx.drawImage(this.overlayCanvas, patch.x, patch.y, patch.width, patch.height, 0, 0, patch.width, patch.height);
        this._punch(this._scratchCtx, liveGlow.x - patch.x, liveGlow.y - patch.y, 1, radius);
        ctx.drawImage(this._scratchCanvas, patch.x, patch.y);
    }
}
