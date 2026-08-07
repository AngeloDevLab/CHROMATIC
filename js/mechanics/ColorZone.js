/**
 * 03_mechanics.md 4.1: "Boss defeated -> the entire level turns colorful -
 * color explosion". Duration of the sweep triggered by triggerFullReveal().
 */
const FULL_REVEAL_DURATION_SECONDS = 1.5;

/**
 * 02_game-structure.md 2.1: Worldmap's "connecting paths turn colorful" -
 * duration of the horizontal sweep triggered by triggerZoneWipe().
 */
const ZONE_WIPE_DURATION_SECONDS = 1.5;

/**
 * CSS `filter` string for the grey/desaturated look, standalone so
 * always-full-color elements (e.g. Portal.js while unrevealed) can match the
 * same grey exactly instead of re-deriving it from a second copy of the tint constants.
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
     * @param {{sepia:number, hueRotate:number, saturate:number}|null} [options.greyTint=null] -
     *   Grayscale alone removes all color, so sepia has to run before hue-rotate can rotate anything.
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
    }

    /**
     * greyTemplateCanvas is the untouched desaturated render; overlayCanvas is
     * the persistent punched result drawn every frame; _scratchCanvas is a
     * reusable patch-sized buffer for darken()/render()'s liveGlow - sized to
     * just the local patch (see _patchBounds()) since darken() runs once per
     * living enemy per frame, and the full canvas was a measurable cost there.
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

    /** Fade-mode stamp aging, permanent-mode's last punch, and transition state. */
    _initState() {
        this._stamps = [];
        this._timeSinceLastStamp = Infinity;
        this._lastPermanentPunch = null;
        this._fullReveal = null;
        this._fullDarken = null;
        this._zoneWipe = null;
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
        if (this._fullReveal) {
            this._updateFullReveal(dt);
            return;
        }

        if (this._fullDarken) {
            this._updateFullDarken(dt);
            return;
        }

        if (this._zoneWipe) {
            this._updateZoneWipe(dt);
            return;
        }

        if (this.fadeDurationSeconds === Infinity) {
            this._updatePermanent(x, y);
            return;
        }

        this._updateFade(dt, x, y);
    }

    /**
     * Skips re-stamping an unchanged position: punching the same gradient into
     * the persistent overlay every frame compounds destination-out alpha in
     * the fade ring toward fully erased, collapsing the soft falloff into a
     * hard cutoff. (Keeping color around the player regardless of an enemy's
     * darken() is render()'s liveGlow instead, not this.)
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
     * Ages/expires stamps, adds a new one every stampIntervalSeconds, then
     * repaints the overlay from the grey template plus every live stamp -
     * rebuilding from scratch avoids drifting from the original grey the way
     * repeatedly blending the overlay with itself would. The final punch at
     * the live (x, y) keeps the leading edge tracking every frame instead of
     * only every stampIntervalSeconds.
     * @param {number} dt
     * @param {number} x
     * @param {number} y
     */
    _updateFade(dt, x, y) {
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

        this._punch(this.overlayCtx, x, y, 1);
    }

    /**
     * Bounding box of a radius around (x, y), clamped to the canvas - shared
     * by darken()/render() so both only clear/copy/composite that small patch
     * instead of the whole level-sized canvas.
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
     * Whether a triggerFullReveal()/triggerFullDarken() sweep is still
     * playing out - callers can gate their own update() calls on this once
     * they stop caring about per-frame position tracking (e.g. GameState after a player death).
     * @returns {boolean}
     */
    get isTransitioning() {
        return !!this._fullReveal || !!this._fullDarken || !!this._zoneWipe;
    }

    /**
     * 03_mechanics.md 4.1: "Boss defeated -> the entire level turns colorful".
     * Expands a full-strength reveal circle from (originX, originY) past the
     * whole canvas over FULL_REVEAL_DURATION_SECONDS, then clears the overlay
     * outright (a growing circle never quite reaches the corners).
     * @param {number} originX
     * @param {number} originY
     */
    triggerFullReveal(originX, originY) {
        this._fullReveal = {
            originX,
            originY,
            elapsed: 0,
            maxRadius: Math.hypot(this.width, this.height),
        };
    }

    /**
     * @param {number} dt
     */
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

    /**
     * Player death - inverse of triggerFullReveal(): repaints the grey
     * template outward from (originX, originY) until the level is grey again.
     * @param {number} originX
     * @param {number} originY
     */
    triggerFullDarken(originX, originY) {
        this._fullDarken = {
            originX,
            originY,
            elapsed: 0,
            maxRadius: Math.hypot(this.width, this.height),
        };
    }

    /**
     * @param {number} dt
     */
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

    /**
     * One-time full-height vertical-slice reveal (Worldmap's "this level's
     * zone turned colorful"), hard-edged rather than the point-based
     * punches' soft circular falloff - a completed zone should read as a
     * flat, fully-revealed block, flush against a completed neighbor with
     * no seam. Coordinates are pixel-rounded before filling since an
     * anti-aliased fillRect edge on this canvas's small native resolution
     * turns into a visibly soft/mismatched seam once scaled up to screen size.
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
     * Animated version of revealZone() - sweeps the revealed strip from
     * xStart to xEnd (left to right) over ZONE_WIPE_DURATION_SECONDS, for
     * the Worldmap's "just completed this level" flourish.
     * @param {number} xStart
     * @param {number} xEnd
     */
    triggerZoneWipe(xStart, xEnd) {
        this._zoneWipe = { xStart, xEnd, elapsed: 0 };
    }

    /**
     * @param {number} dt
     */
    _updateZoneWipe(dt) {
        this._zoneWipe.elapsed += dt;
        const progress = Math.min(1, this._zoneWipe.elapsed / ZONE_WIPE_DURATION_SECONDS);
        const { xStart, xEnd } = this._zoneWipe;
        const right = xStart + (xEnd - xStart) * progress;

        this.revealZone(xStart, right);
        if (progress >= 1) this._zoneWipe = null;
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

    /**
     * Wraith.js beam-fire beat: desaturates the whole room in one instant
     * snap except a safe pocket around the player - unlike triggerFullDarken()'s
     * slow one-time sweep, this needs to read fast since it repeats all fight.
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
     * extra hole for this frame only, on a scratch copy never written back
     * into overlayCanvas - so the player's immediate area always reads as
     * revealed regardless of what an enemy's darken() did to the persisted overlay there.
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
     * Clips the base overlay draw to exclude the patch rect (an evenodd
     * clip - drawing the full overlay underneath first would leave opaque
     * pixels behind the hole, since transparent-over-opaque is a no-op), then
     * blits in a scratch copy of that patch with the live-glow hole punched
     * into it, leaving the real overlayCanvas untouched.
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
