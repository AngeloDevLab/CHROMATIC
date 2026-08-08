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

// ColorZone.js's triggered, one-time sweep animations (full-level reveal/
// darken on boss-defeat/player-death, Worldmap's zone-wipe), as opposed to
// that file's own continuous per-frame trail mechanism - each has its own
// elapsed/progress state that the other group never needs. Holds a
// reference back to the owning ColorZone instance to reuse its shared
// drawing primitives (_punch()/darken()/revealZone()/overlayCtx) rather than
// duplicating them here.
export class ColorZoneTransitions {
    /**
     * @param {ColorZone} colorZone
     */
    constructor(colorZone) {
        this._colorZone = colorZone;
        this._fullReveal = null;
        this._fullDarken = null;
        this._zoneWipe = null;
    }

    /**
     * Whether a sweep is still playing out - ColorZone.isTransitioning
     * delegates here.
     * @returns {boolean}
     */
    get isActive() {
        return !!this._fullReveal || !!this._fullDarken || !!this._zoneWipe;
    }

    /**
     * 03_mechanics.md 4.1: "Boss defeated -> the entire level turns
     * colorful". Expands a full-strength reveal circle from (originX,
     * originY) past the whole canvas over FULL_REVEAL_DURATION_SECONDS,
     * then clears the overlay outright (a growing circle never quite
     * reaches the corners).
     * @param {number} originX
     * @param {number} originY
     */
    triggerFullReveal(originX, originY) {
        const zone = this._colorZone;
        this._fullReveal = { originX, originY, elapsed: 0, maxRadius: Math.hypot(zone.width, zone.height) };
    }

    /**
     * Player death - inverse of triggerFullReveal(): repaints the grey
     * template outward from (originX, originY) until the level is grey again.
     * @param {number} originX
     * @param {number} originY
     */
    triggerFullDarken(originX, originY) {
        const zone = this._colorZone;
        this._fullDarken = { originX, originY, elapsed: 0, maxRadius: Math.hypot(zone.width, zone.height) };
    }

    /**
     * Animated version of ColorZone.revealZone() - sweeps the revealed
     * strip from xStart to xEnd (left to right) over
     * ZONE_WIPE_DURATION_SECONDS, for the Worldmap's "just completed this
     * level" flourish.
     * @param {number} xStart
     * @param {number} xEnd
     */
    triggerZoneWipe(xStart, xEnd) {
        this._zoneWipe = { xStart, xEnd, elapsed: 0 };
    }

    /**
     * @param {number} dt
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
     * @param {number} dt
     */
    _updateFullReveal(dt) {
        const zone = this._colorZone;
        this._fullReveal.elapsed += dt;
        const progress = Math.min(1, this._fullReveal.elapsed / FULL_REVEAL_DURATION_SECONDS);

        if (progress >= 1) {
            zone.overlayCtx.clearRect(0, 0, zone.width, zone.height);
            this._fullReveal = null;
            return;
        }

        zone._punch(zone.overlayCtx, this._fullReveal.originX, this._fullReveal.originY, 1, this._fullReveal.maxRadius * progress);
    }

    /**
     * @param {number} dt
     */
    _updateFullDarken(dt) {
        const zone = this._colorZone;
        this._fullDarken.elapsed += dt;
        const progress = Math.min(1, this._fullDarken.elapsed / FULL_REVEAL_DURATION_SECONDS);

        if (progress >= 1) {
            zone.overlayCtx.drawImage(zone.greyTemplateCanvas, 0, 0);
            this._fullDarken = null;
            return;
        }

        zone.darken(this._fullDarken.originX, this._fullDarken.originY, this._fullDarken.maxRadius * progress);
    }

    /**
     * @param {number} dt
     */
    _updateZoneWipe(dt) {
        this._zoneWipe.elapsed += dt;
        const progress = Math.min(1, this._zoneWipe.elapsed / ZONE_WIPE_DURATION_SECONDS);
        const { xStart, xEnd } = this._zoneWipe;
        const right = xStart + (xEnd - xStart) * progress;

        this._colorZone.revealZone(xStart, right);
        if (progress >= 1) this._zoneWipe = null;
    }
}
