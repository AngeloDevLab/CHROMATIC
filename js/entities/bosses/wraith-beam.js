import { Entity } from '../entity.js';

const THICKNESS_PX = 36;
const STEP_PX = 8;

export class WraithBeam extends Entity {
    /**
     * Spawns a beam and does its first scan for a wall to stop at.
     * @param {number} spawnCenterX - World X the beam fires from (fixed for a horizontal beam, live for a vertical one).
     * @param {number} spawnCenterY - World Y (center) the beam starts at.
     * @param {1|-1} direction - Which way a horizontal beam fires; ignored for 'vertical' (always reaches downward).
     * @param {Collision} collision - Level collision, for the `walls` scan in _rescan().
     * @param {number} damage - Damage dealt to the player on hit (combat.js).
     * @param {'horizontal'|'vertical'} [axis='horizontal'] - Which way the beam sweeps.
     */
    constructor(spawnCenterX, spawnCenterY, direction, collision, damage, axis = 'horizontal') {
        super(...WraithBeam._initialBounds(spawnCenterX, spawnCenterY, axis));
        this.axis = axis;
        this.direction = direction;
        this.vx = 0;
        this.damage = damage;
        this.dead = false;
        this._collision = collision;
        this._sourceX = spawnCenterX;
        this._rescan(spawnCenterX, spawnCenterY);
    }

    /**
     * Builds the zero-length starting rect for the given axis.
     * @param {number} spawnCenterX - World X the beam fires from.
     * @param {number} spawnCenterY - World Y (center) the beam starts at.
     * @param {'horizontal'|'vertical'} axis - Which way the beam sweeps.
     * @returns {[number, number, number, number]} Entity's (x, y, width, height) constructor args.
     */
    static _initialBounds(spawnCenterX, spawnCenterY, axis) {
        if (axis === 'horizontal') {
            return [spawnCenterX, spawnCenterY - THICKNESS_PX / 2, 0, THICKNESS_PX];
        }
        return [spawnCenterX - THICKNESS_PX / 2, spawnCenterY, THICKNESS_PX, 0];
    }

    /**
     * Dispatches to the axis-specific rescan.
     * @param {number} centerX - The beam source's current center X.
     * @param {number} centerY - The beam source's current center Y.
     */
    _rescan(centerX, centerY) {
        if (this.axis === 'horizontal') this._rescanHorizontal(centerY);
        else this._rescanVertical(centerX, centerY);
    }

    /**
     * Re-derives the beam's x/y/width for the wraith's current height.
     * @param {number} centerY - The beam source's current center Y.
     */
    _rescanHorizontal(centerY) {
        const levelEdgeX = this.direction === 1 ? this._collision.level.pixelWidth : 0;

        let stopX = this._sourceX;
        while (this.direction === 1 ? stopX < levelEdgeX : stopX > levelEdgeX) {
            const nextX = stopX + this.direction * STEP_PX;
            if (this._isBlockedAcross(nextX, centerY, 'y')) break;
            stopX = this.direction === 1 ? Math.min(nextX, levelEdgeX) : Math.max(nextX, levelEdgeX);
        }

        this.x = this.direction === 1 ? this._sourceX : stopX;
        this.width = Math.max(0, Math.abs(stopX - this._sourceX));
        this.y = centerY - this.height / 2;
    }

    /**
     * Reaches straight down from the source's current position to the first
     * `walls` tile, or the level's bottom edge.
     * @param {number} centerX - The beam source's current center X.
     * @param {number} centerY - The beam source's current center Y.
     */
    _rescanVertical(centerX, centerY) {
        const levelBottomY = this._collision.level.pixelHeight;

        let stopY = centerY;
        while (stopY < levelBottomY) {
            const nextY = stopY + STEP_PX;
            if (this._isBlockedAcross(centerX, nextY, 'x')) break;
            stopY = Math.min(nextY, levelBottomY);
        }

        this.x = centerX - this.width / 2;
        this.y = centerY;
        this.height = Math.max(0, stopY - centerY);
    }

    /**
     * Checks whether a wall tile blocks the beam at the given point, across its full cross-section.
     * @param {number} x - World X to check.
     * @param {number} y - World Y to check.
     * @param {'x'|'y'} crossAxis - Which coordinate the THICKNESS_PX span applies to.
     * @returns {boolean}
     */
    _isBlockedAcross(x, y, crossAxis) {
        const half = THICKNESS_PX / 2;
        for (let offset = -half; offset < half; offset += STEP_PX) {
            const px = crossAxis === 'x' ? x + offset : x;
            const py = crossAxis === 'y' ? y + offset : y;
            if (this._collision.isWallAt(px, py)) return true;
        }
        const px = crossAxis === 'x' ? x + half : x;
        const py = crossAxis === 'y' ? y + half : y;
        return this._collision.isWallAt(px, py);
    }

    /**
     * Called every frame while firing/descending. Horizontal beams ignore
     * centerX (fixed at fire time); vertical beams use it as the live source column.
     * @param {number} centerX - The beam source's current center X.
     * @param {number} centerY - The beam source's current center Y.
     */
    track(centerX, centerY) {
        this._rescan(centerX, centerY);
    }

    /**
     * No-op - the owning boss drives this entirely through track().
     */
    update() {}

    /**
     * Draws the beam as a gradient-filled rect, skipping zero-length or dead beams.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        const length = this.axis === 'horizontal' ? this.width : this.height;
        if (this.dead || length <= 0) return;

        ctx.save();
        ctx.fillStyle = this._buildGradient(ctx);
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }

    /**
     * Fades out across the beam's cross-section, not its length, for a thin
     * opaque core with soft edges.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to build the gradient for.
     * @returns {CanvasGradient}
     */
    _buildGradient(ctx) {
        const gradient = this.axis === 'horizontal'
            ? ctx.createLinearGradient(0, this.y, 0, this.y + this.height)
            : ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        gradient.addColorStop(0, 'rgba(180, 90, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(200, 140, 255, 0.85)');
        gradient.addColorStop(1, 'rgba(180, 90, 255, 0)');
        return gradient;
    }
}
