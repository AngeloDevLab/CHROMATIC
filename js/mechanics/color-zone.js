// Fade mode ages stamps and rebuilds the overlay from the grey template every frame, dissolving
// back to grey - permanent mode instead punches directly into the persistent overlay and never
// rebuilds.

import { ColorZoneTransitions } from './color-zone-transitions.js';

/**
 * CSS `filter` string for the grey/desaturated look.
 * @param {number} greyBrightness - CSS brightness() value for the desaturated look.
 * @param {{sepia:number, hueRotate:number, saturate:number}|null} greyTint - Optional sepia/hue-rotate/saturate tint, or null for plain grey.
 * @returns {string}
 */
export function buildGreyFilter(greyBrightness, greyTint) {
    const filters = ['grayscale(1)'];
    if (greyTint) {
        const { sepia, hueRotate, saturate } = greyTint;
        filters.push(`sepia(${sepia})`, `hue-rotate(${hueRotate}deg)`, `saturate(${saturate})`);
    }
    filters.push(`brightness(${greyBrightness})`);
    return filters.join(' ');
}

/** The color-reveal mechanic: punches holes into a grey overlay, permanently (the real trail) or fading (decorative uses). */
export class ColorZone {
    /**
     * Sets up the grey/overlay/scratch canvases and desaturation filter.
     * @param {number} width - Canvas width, in pixels.
     * @param {number} height - Canvas height, in pixels.
     * @param {number} [revealRadius=24] - Default reveal/darken radius, in pixels.
     * @param {object} [options] - Optional settings.
     * @param {number} [options.fadeDurationSeconds=Infinity] - How long a fade-mode stamp takes to dissolve; Infinity for permanent mode.
     * @param {number} [options.stampIntervalSeconds=0.1] - Fade mode only.
     * @param {number} [options.greyBrightness=1] - CSS brightness() value for the desaturated look.
     * @param {{sepia:number, hueRotate:number, saturate:number}|null} [options.greyTint=null] - Optional sepia/hue-rotate/saturate tint.
     */
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
        this.greyFilterCSS = buildGreyFilter(greyBrightness, greyTint);

        this._initCanvases(width, height);
        this._initState();
        this._transitions = new ColorZoneTransitions(this);
    }

    /**
     * Creates the grey template canvas, the persistent overlay canvas, and a reusable scratch canvas sized per-patch for punch operations.
     * @param {number} width - Canvas width, in pixels.
     * @param {number} height - Canvas height, in pixels.
     */
    _initCanvases(width, height) {
        this.greyTemplateCanvas = document.createElement('canvas');
        this.greyTemplateCanvas.width = width;
        this.greyTemplateCanvas.height = height;
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this._scratchCanvas = document.createElement('canvas');
        this._scratchCtx = this._scratchCanvas.getContext('2d');
    }

    /** Fade-mode stamp aging and permanent-mode's last punch - transition state lives on color-zone-transitions.js instead. */
    _initState() {
        this._stamps = [];
        this._timeSinceLastStamp = Infinity;
        this._lastPermanentPunch = null;
    }

    /**
     * Rebuilds the grey template from a fresh render of the color source, then
     * resets the overlay to match it (fully grey, nothing revealed yet).
     * @param {HTMLCanvasElement} colorSourceCanvas - Fully-colored canvas to desaturate a render of.
     */
    paintGreyFrom(colorSourceCanvas) {
        const templateCtx = this.greyTemplateCanvas.getContext('2d');
        templateCtx.clearRect(0, 0, this.width, this.height);
        templateCtx.save();

        templateCtx.filter = this.greyFilterCSS;

        templateCtx.drawImage(colorSourceCanvas, 0, 0);
        templateCtx.restore();

        this.overlayCtx.clearRect(0, 0, this.width, this.height);
        this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
    }

    /**
     * Advances the overlay for the current frame at the live reveal point.
     * @param {number} dt - Elapsed time in seconds.
     * @param {number} x - Live reveal point's world X.
     * @param {number} y - Live reveal point's world Y.
     */
    update(dt, x, y) {
        if (this._transitions.isActive) {
            this._transitions.update(dt);
            return;
        }

        if (this.fadeDurationSeconds === Infinity) {
            this._updatePermanent(x, y);
            return;
        }

        this._updateFade(dt, x, y);
    }

    /**
     * Skips re-stamping an unchanged position - repeated punches at the same
     * spot compound destination-out alpha into a hard cutoff instead of a soft falloff.
     * @param {number} x - Live reveal point's world X.
     * @param {number} y - Live reveal point's world Y.
     */
    _updatePermanent(x, y) {
        const last = this._lastPermanentPunch;
        if (!last || last.x !== x || last.y !== y) {
            this._punch(this.overlayCtx, x, y, 1);
            this._lastPermanentPunch = { x, y };
        }
    }

    /**
     * Ages/expires stamps, then repaints the overlay from them.
     * @param {number} dt - Elapsed time in seconds.
     * @param {number} x - Live reveal point's world X.
     * @param {number} y - Live reveal point's world Y.
     */
    _updateFade(dt, x, y) {
        this._ageStamps(dt, x, y);
        this._repaintFade(x, y);
    }

    /**
     * Adds a new stamp every stampIntervalSeconds and drops ones that have
     * fully faded.
     * @param {number} dt - Elapsed time in seconds.
     * @param {number} x - Live reveal point's world X.
     * @param {number} y - Live reveal point's world Y.
     */
    _ageStamps(dt, x, y) {
        this._timeSinceLastStamp += dt;
        if (this._timeSinceLastStamp >= this.stampIntervalSeconds) {
            this._stamps.push({ x, y, age: 0 });
            this._timeSinceLastStamp = 0;
        }

        for (const stamp of this._stamps) stamp.age += dt;
        this._stamps = this._stamps.filter((stamp) => stamp.age < this.fadeDurationSeconds);
    }

    /**
     * Rebuilds the overlay from scratch (grey template plus every live
     * stamp), then punches the leading edge at (x, y).
     * @param {number} x - Live reveal point's world X.
     * @param {number} y - Live reveal point's world Y.
     */
    _repaintFade(x, y) {
        this.overlayCtx.clearRect(0, 0, this.width, this.height);
        this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
        for (const stamp of this._stamps) {
            const strength = 1 - stamp.age / this.fadeDurationSeconds;
            this._punch(this.overlayCtx, stamp.x, stamp.y, strength);
        }
        this._punch(this.overlayCtx, x, y, 1);
    }

    /**
     * Bounding box of a radius around (x, y), clamped to the canvas.
     * @param {number} x - Center world X.
     * @param {number} y - Center world Y.
     * @param {number} radius - Radius around the center point.
     * @returns {{x:number, y:number, width:number, height:number}}
     */
    _patchBounds(x, y, radius) {
        const left = Math.max(0, Math.floor(x - radius));
        const top = Math.max(0, Math.floor(y - radius));
        const right = Math.min(this.width, Math.ceil(x + radius));
        const bottom = Math.min(this.height, Math.ceil(y + radius));
        return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    }

    /**
     * Inverse of _punch(): repaints the grey template back onto the overlay in a soft-edged patch instead of erasing it.
     * @param {number} x - World X to darken around.
     * @param {number} y - World Y to darken around.
     * @param {number} [radius] - Darken radius, in pixels.
     */
    darken(x, y, radius = this.revealRadius) {
        const patch = this._patchBounds(x, y, radius);
        this._scratchCanvas.width = patch.width;
        this._scratchCanvas.height = patch.height;

        const localX = x - patch.x;
        const localY = y - patch.y;
        const gradient = this._buildPunchGradient(this._scratchCtx, localX, localY, radius, 1);
        this._maskScratchWithGradient(patch, localX, localY, radius, gradient);

        this.overlayCtx.drawImage(this._scratchCanvas, patch.x, patch.y);
    }

    /**
     * Masks a scratch copy of the grey template with a radial gradient, leaving a soft-edged hole.
     * @param {{x:number,y:number,width:number,height:number}} patch - Patch rect within the full canvas.
     * @param {number} localX - Punch center X, relative to the patch.
     * @param {number} localY - Punch center Y, relative to the patch.
     * @param {number} radius - Punch radius, in pixels.
     * @param {CanvasGradient} gradient - Radial gradient to mask with.
     */
    _maskScratchWithGradient(patch, localX, localY, radius, gradient) {
        this._scratchCtx.drawImage(this.greyTemplateCanvas, patch.x, patch.y, patch.width, patch.height, 0, 0, patch.width, patch.height);
        this._scratchCtx.globalCompositeOperation = 'destination-in';
        this._scratchCtx.fillStyle = gradient;
        this._scratchCtx.beginPath();
        this._scratchCtx.arc(localX, localY, radius, 0, Math.PI * 2);
        this._scratchCtx.fill();
        this._scratchCtx.globalCompositeOperation = 'source-over';
    }

    /**
     * One-time reveal punch (e.g. an enemy's death spot) that leaves the hole
     * exactly as it is afterward, unlike update()'s continuous per-frame reveal.
     * @param {number} x - World X to reveal around.
     * @param {number} y - World Y to reveal around.
     * @param {number} [radius] - Reveal radius, in pixels.
     */
    reveal(x, y, radius = this.revealRadius) {
        this._punch(this.overlayCtx, x, y, 1, radius);
    }

    /**
     * Whether a triggerFullReveal()/triggerFullDarken() sweep is still playing out.
     * @returns {boolean}
     */
    get isTransitioning() {
        return this._transitions.isActive;
    }

    /**
     * Delegates to ColorZoneTransitions.triggerFullReveal().
     * @param {number} originX - World X the reveal circle expands from.
     * @param {number} originY - World Y the reveal circle expands from.
     */
    triggerFullReveal(originX, originY) {
        this._transitions.triggerFullReveal(originX, originY);
    }

    /**
     * Delegates to ColorZoneTransitions.triggerFullDarken().
     * @param {number} originX - World X the darken circle expands from.
     * @param {number} originY - World Y the darken circle expands from.
     */
    triggerFullDarken(originX, originY) {
        this._transitions.triggerFullDarken(originX, originY);
    }

    /**
     * One-time full-height vertical-slice reveal, hard-edged rather than a
     * soft circular punch. Coordinates are pixel-rounded to avoid an
     * anti-aliased seam once scaled up.
     * @param {number} xStart - Left edge of the reveal slice.
     * @param {number} xEnd - Right edge of the reveal slice.
     */
    revealZone(xStart, xEnd) {
        const left = Math.round(xStart);
        const right = Math.round(xEnd);

        this.overlayCtx.save();
        this.overlayCtx.globalCompositeOperation = 'destination-out';
        this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        this.overlayCtx.fillRect(left, 0, right - left, this.height);
        this.overlayCtx.restore();
    }

    /**
     * Delegates to ColorZoneTransitions.triggerZoneWipe().
     * @param {number} xStart - Left edge of the reveal sweep.
     * @param {number} xEnd - Right edge of the reveal sweep.
     */
    triggerZoneWipe(xStart, xEnd) {
        this._transitions.triggerZoneWipe(xStart, xEnd);
    }

    /**
     * Radial gradient instead of a flat fill: fully erases up to 55% of the
     * radius, then fades to no effect at the edge, for a soft transition
     * instead of a hard circle. `strength` scales this down as a fade stamp ages.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to punch into.
     * @param {number} x - Punch center world X.
     * @param {number} y - Punch center world Y.
     * @param {number} strength - Punch opacity, 0 to 1.
     * @param {number} [radius] - Punch radius, in pixels.
     */
    _punch(ctx, x, y, strength, radius = this.revealRadius) {
        const gradient = this._buildPunchGradient(ctx, x, y, radius, strength);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Shared 3-stop black gradient: opaque through the middle, fading to transparent at the edge.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to build the gradient for.
     * @param {number} x - Gradient center X.
     * @param {number} y - Gradient center Y.
     * @param {number} radius - Gradient radius, in pixels.
     * @param {number} strength - Opacity at the gradient's core, 0 to 1.
     * @returns {CanvasGradient}
     */
    _buildPunchGradient(ctx, x, y, radius, strength) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(0.55, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        return gradient;
    }

    /**
     * wraith.js beam-fire beat: desaturates the whole room in one instant
     * snap except a safe pocket around the player.
     * @param {number} safeX - World X of the untouched safe pocket's center.
     * @param {number} safeY - World Y of the untouched safe pocket's center.
     * @param {number} safeRadius - Radius of the untouched safe pocket.
     */
    darkenAllExcept(safeX, safeY, safeRadius) {
        this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
        this._punch(this.overlayCtx, safeX, safeY, 1, safeRadius);
    }

    /**
     * Draws the overlay, or with `liveGlow` ({x, y, radius}) punches an extra hole into a scratch copy that's never written back into overlayCanvas.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {{x:number, y:number, radius?:number}|null} [liveGlow] - Extra this-frame-only reveal hole to punch, if any.
     */
    render(ctx, liveGlow = null) {
        if (!liveGlow) {
            ctx.drawImage(this.overlayCanvas, 0, 0);
            return;
        }

        const radius = liveGlow.radius ?? this.revealRadius;
        const patch = this._patchBounds(liveGlow.x, liveGlow.y, radius);
        this._renderWithLiveGlow(ctx, patch, liveGlow, radius);
    }

    /**
     * Clips the base overlay draw to exclude the patch rect - drawing the
     * full overlay underneath first would leave opaque pixels behind the
     * hole, since transparent-over-opaque is a no-op. Then blits in a
     * scratch copy of that patch with the live-glow hole punched into it.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {{x:number, y:number, width:number, height:number}} patch - Patch rect around the live glow.
     * @param {{x:number, y:number, radius?:number}} liveGlow - Extra this-frame-only reveal hole to punch.
     * @param {number} radius - Live glow punch radius, in pixels.
     */
    _renderWithLiveGlow(ctx, patch, liveGlow, radius) {
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
