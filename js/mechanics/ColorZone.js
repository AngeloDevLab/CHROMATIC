import { ColorZoneTransitions } from './ColorZoneTransitions.js';

/**
 * CSS `filter` string for the grey/desaturated look.
 * @param {number} greyBrightness
 * @param {{sepia:number, hueRotate:number, saturate:number}|null} greyTint
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

// Permanent mode (default, fadeDurationSeconds = Infinity) punches directly
// into the persistent overlay and stays revealed forever - the real trail
// mechanic (03_mechanics.md 4.1). Fade mode (a finite fadeDurationSeconds) is
// for decorative uses only (e.g. the menu background): ages stamps and
// rebuilds the overlay from the grey template each frame, dissolving back to
// grey instead of staying revealed.
export class ColorZone {
    /**
     * @param {number} width
     * @param {number} height
     * @param {number} [revealRadius=24]
     * @param {object} [options]
     * @param {number} [options.fadeDurationSeconds=Infinity]
     * @param {number} [options.stampIntervalSeconds=0.1] - Fade mode only.
     * @param {number} [options.greyBrightness=1]
     * @param {{sepia:number, hueRotate:number, saturate:number}|null} [options.greyTint=null]
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
     * greyTemplateCanvas is the untouched desaturated render; overlayCanvas is
     * the persistent punched result drawn every frame; _scratchCanvas is a
     * reusable patch-sized buffer for darken()/render()'s liveGlow, sized to
     * just the local patch (see _patchBounds()).
     * @param {number} width
     * @param {number} height
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

    /** Fade-mode stamp aging and permanent-mode's last punch - transition state lives on ColorZoneTransitions.js instead. */
    _initState() {
        this._stamps = [];
        this._timeSinceLastStamp = Infinity;
        this._lastPermanentPunch = null;
    }

    /**
     * Rebuilds the grey template from a fresh render of the color source, then
     * resets the overlay to match it (fully grey, nothing revealed yet).
     * @param {HTMLCanvasElement} colorSourceCanvas
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
     * @param {number} dt
     * @param {number} x
     * @param {number} y
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
     * @param {number} x
     * @param {number} y
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
     * @param {number} dt
     * @param {number} x
     * @param {number} y
     */
    _updateFade(dt, x, y) {
        this._ageStamps(dt, x, y);
        this._repaintFade(x, y);
    }

    /**
     * Adds a new stamp every stampIntervalSeconds and drops ones that have
     * fully faded.
     * @param {number} dt
     * @param {number} x
     * @param {number} y
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
     * @param {number} x
     * @param {number} y
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
     * Bounding box of a radius around (x, y), clamped to the canvas. Shared by darken()/render().
     * @param {number} x
     * @param {number} y
     * @param {number} radius
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
     * 03_mechanics.md 4.1: "Enemy crosses a colored area -> the area turns
     * back to dark". Inverse of _punch(): repaints the grey template back
     * onto the overlay in a soft-edged patch instead of erasing it.
     * @param {number} x
     * @param {number} y
     * @param {number} [radius]
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
     * @param {{x:number,y:number,width:number,height:number}} patch
     * @param {number} localX
     * @param {number} localY
     * @param {number} radius
     * @param {CanvasGradient} gradient
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
     * @param {number} x
     * @param {number} y
     * @param {number} [radius]
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
     * @see ColorZoneTransitions.triggerFullReveal
     * @param {number} originX
     * @param {number} originY
     */
    triggerFullReveal(originX, originY) {
        this._transitions.triggerFullReveal(originX, originY);
    }

    /**
     * @see ColorZoneTransitions.triggerFullDarken
     * @param {number} originX
     * @param {number} originY
     */
    triggerFullDarken(originX, originY) {
        this._transitions.triggerFullDarken(originX, originY);
    }

    /**
     * One-time full-height vertical-slice reveal, hard-edged rather than a
     * soft circular punch. Coordinates are pixel-rounded to avoid an
     * anti-aliased seam once scaled up.
     * @param {number} xStart
     * @param {number} xEnd
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
     * @see ColorZoneTransitions.triggerZoneWipe
     * @param {number} xStart
     * @param {number} xEnd
     */
    triggerZoneWipe(xStart, xEnd) {
        this._transitions.triggerZoneWipe(xStart, xEnd);
    }

    /**
     * Radial gradient instead of a flat fill: fully erases up to 55% of the
     * radius, then fades to no effect at the edge, for a soft transition
     * instead of a hard circle. `strength` scales this down as a fade stamp ages.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} strength
     * @param {number} [radius]
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
     * Shared 3-stop black gradient (opaque center/mid, fading to transparent
     * at the edge) - used both by _punch() (erases the overlay directly) and
     * darken() (masks a scratch copy of the grey template instead).
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {number} strength
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
     * Wraith.js beam-fire beat: desaturates the whole room in one instant
     * snap except a safe pocket around the player.
     * @param {number} safeX
     * @param {number} safeY
     * @param {number} safeRadius
     */
    darkenAllExcept(safeX, safeY, safeRadius) {
        this.overlayCtx.drawImage(this.greyTemplateCanvas, 0, 0);
        this._punch(this.overlayCtx, safeX, safeY, 1, safeRadius);
    }

    /**
     * Draws the overlay. With `liveGlow` ({x, y, radius}), also punches an
     * extra hole for this frame only, on a scratch copy never written back into overlayCanvas.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{x:number, y:number, radius?:number}|null} [liveGlow]
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
     * scratch copy of that patch with the live-glow hole punched into it,
     * leaving the real overlayCanvas untouched.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{x:number, y:number, width:number, height:number}} patch
     * @param {{x:number, y:number, radius?:number}} liveGlow
     * @param {number} radius
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
