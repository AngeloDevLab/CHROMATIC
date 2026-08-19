const full_reveal_duration_seconds = 1.5;

const zone_wipe_duration_seconds = 1.5;

/** ColorZone's triggered, one-time sweep animations (full reveal/darken, Worldmap's zone-wipe). */
export class ColorZoneTransitions {
    /**
     * Starts with no sweep active.
     * @param {ColorZone} colorZone - Owning ColorZone to reuse drawing primitives from.
     */
    constructor(colorZone) {
        this._colorZone = colorZone;
        this._fullReveal = null;
        this._fullDarken = null;
        this._zoneWipe = null;
    }

    /**
     * Whether a sweep is still playing out.
     * @returns {boolean}
     */
    get isActive() {
        return !!this._fullReveal || !!this._fullDarken || !!this._zoneWipe;
    }

    /**
     * Expands a full-strength reveal circle from (originX, originY) past the
     * whole canvas, then clears the overlay outright (a growing circle never
     * quite reaches the corners).
     * @param {number} originX - World X the reveal circle expands from.
     * @param {number} originY - World Y the reveal circle expands from.
     */
    triggerFullReveal(originX, originY) {
        const zone = this._colorZone;
        this._fullReveal = { originX, originY, elapsed: 0, maxRadius: Math.hypot(zone.width, zone.height) };
    }

    /**
     * Player death - inverse of triggerFullReveal(): repaints the grey
     * template outward from (originX, originY) until the level is grey again.
     * @param {number} originX - World X the darken circle expands from.
     * @param {number} originY - World Y the darken circle expands from.
     */
    triggerFullDarken(originX, originY) {
        const zone = this._colorZone;
        this._fullDarken = { originX, originY, elapsed: 0, maxRadius: Math.hypot(zone.width, zone.height) };
    }

    /**
     * Animated version of ColorZone.revealZone(): sweeps the revealed strip from xStart to xEnd over time, for the Worldmap's level-complete flourish.
     * @param {number} xStart - Left edge of the reveal sweep.
     * @param {number} xEnd - Right edge of the reveal sweep.
     */
    triggerZoneWipe(xStart, xEnd) {
        this._zoneWipe = { xStart, xEnd, elapsed: 0 };
    }

    /**
     * Advances whichever sweep is currently active.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this._fullReveal) {
            this._updateFullReveal(dt);
        } else if (this._fullDarken) {
            this._updateFullDarken(dt);
        } else if (this._zoneWipe) {
            this._updateZoneWipe(dt);
        }
    }

    /**
     * Grows the reveal circle, clearing the overlay outright once it completes.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateFullReveal(dt) {
        const zone = this._colorZone;
        this._fullReveal.elapsed += dt;
        const progress = Math.min(1, this._fullReveal.elapsed / full_reveal_duration_seconds);

        if (progress >= 1) {
            zone.overlayCtx.clearRect(0, 0, zone.width, zone.height);
            this._fullReveal = null;
            return;
        }

        zone._punch(zone.overlayCtx, this._fullReveal.originX, this._fullReveal.originY, 1, this._fullReveal.maxRadius * progress);
    }

    /**
     * Grows the darken circle, repainting the full grey template once it completes.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateFullDarken(dt) {
        const zone = this._colorZone;
        this._fullDarken.elapsed += dt;
        const progress = Math.min(1, this._fullDarken.elapsed / full_reveal_duration_seconds);

        if (progress >= 1) {
            zone.overlayCtx.drawImage(zone.greyTemplateCanvas, 0, 0);
            this._fullDarken = null;
            return;
        }

        zone.darken(this._fullDarken.originX, this._fullDarken.originY, this._fullDarken.maxRadius * progress);
    }

    /**
     * Sweeps the revealed strip's right edge toward xEnd.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateZoneWipe(dt) {
        this._zoneWipe.elapsed += dt;
        const progress = Math.min(1, this._zoneWipe.elapsed / zone_wipe_duration_seconds);
        const { xStart, xEnd } = this._zoneWipe;
        const right = xStart + (xEnd - xStart) * progress;

        this._colorZone.revealZone(xStart, right);
        if (progress >= 1) this._zoneWipe = null;
    }
}
