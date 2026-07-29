import { Entity } from '../Entity.js';

// Full-extent beam, not a slow travelling bolt (contrast
// entities/enemies/ShooterProjectile.js). Position/extent both re-derive
// every frame via track() below, from wherever the wraith currently is - not
// resolved once at construction, because the wraith keeps firing while it
// moves (Wraith.js/WraithTemplateboss.js), and a `walls` segment (05_enemies-
// bosses.md 6.3.1's "vertical wall segments... block the beam") meant to
// cover only part of that range needs to actually block it there, not just
// wherever the beam happened to first fire from. update() is deliberately a
// no-op - the owning boss drives this entirely through track().
//
// `axis` ('horizontal', the Miniboss's only mode, or 'vertical', the
// Templateboss's alternative per 6.3.1) decides which coordinate sweeps and
// which stays fixed at THICKNESS_PX - a horizontal beam's source X is fixed
// at fire time (`direction` is left/right, `track()` only ever moves it up/
// down as the wraith rises/descends), a vertical beam's source column
// instead follows the live centerX every frame (WraithTemplateboss's
// firingSweep glides sideways while firing) and always reaches straight
// down. Both axes use the exact same wall-only check (isWallAt(), ignoring
// the one-way `terrain` layer) - a vertical beam passes through an ordinary
// floor exactly like a horizontal one passes a platform it's flying past,
// only real `walls` segments stop either.
//
// Same x/y/width/height/damage/direction/dead/update/render shape as
// ShooterProjectile.js otherwise, so it still plugs straight into
// LevelSession's existing enemyProjectiles pipeline
// (resolveEnemyProjectileHits in Combat.js, which kills it on the first
// hit) with no changes needed there.
const THICKNESS_PX = 36;
const STEP_PX = 8;

export class WraithBeam extends Entity {
    /**
     * @param {number} spawnCenterX - World X the beam fires from (fixed for a horizontal beam, live for a vertical one).
     * @param {number} spawnCenterY - World Y (center) the beam starts at.
     * @param {1|-1} direction - Which way a horizontal beam fires; ignored for 'vertical' (always reaches downward).
     * @param {Collision} collision - Level collision, for the `walls` scan in _rescan().
     * @param {number} damage - Damage dealt to the player on hit (Combat.js).
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
        // The horizontal beam's own fixed source X - a vertical beam ignores
        // this and instead tracks its live centerX every frame (see track()).
        this._sourceX = spawnCenterX;

        this._rescan(spawnCenterX, spawnCenterY);
    }

    /**
     * @param {number} spawnCenterX
     * @param {number} spawnCenterY
     * @param {'horizontal'|'vertical'} axis
     * @returns {[number, number, number, number]} Entity's (x, y, width, height) constructor args.
     */
    static _initialBounds(spawnCenterX, spawnCenterY, axis) {
        if (axis === 'horizontal') {
            return [spawnCenterX, spawnCenterY - THICKNESS_PX / 2, 0, THICKNESS_PX];
        }
        return [spawnCenterX - THICKNESS_PX / 2, spawnCenterY, THICKNESS_PX, 0];
    }

    /**
     * @param {number} centerX - The beam source's current center X.
     * @param {number} centerY - The beam source's current center Y.
     */
    _rescan(centerX, centerY) {
        if (this.axis === 'horizontal') this._rescanHorizontal(centerY);
        else this._rescanVertical(centerX, centerY);
    }

    /**
     * Re-derives x/y/width for the wraith's CURRENT height - scans fresh
     * against `walls` every call instead of once, so a wall segment that
     * only covers part of the arena's height actually blocks the beam once
     * it descends to that row, rather than the reach computed way back at
     * the top (where a wall usually isn't even present) staying locked in
     * for the whole ensuing glide down.
     * @param {number} centerY
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
     * Same idea as _rescanHorizontal(), axis-swapped: always reaches from
     * the source's current position straight down toward the level's bottom
     * edge, stopping at the first `walls` tile in that column.
     * @param {number} centerX
     * @param {number} centerY
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
     * isWallAt() checked across the beam's own THICKNESS_PX cross-section
     * (perpendicular to travel), not just the single centerline point - a
     * wall tile only partially overlapping that cross-section still needs
     * to register as a block, otherwise the beam's own detected reach lags
     * a few pixels behind where its rendered/hit rectangle has already
     * visually penetrated the wall.
     * @param {number} x
     * @param {number} y
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
     * The owning boss calls this every frame while still firing/descending.
     * A horizontal beam ignores centerX (its source X is fixed at fire time,
     * matching the original behavior); a vertical beam uses it as its live
     * moving source column.
     * @param {number} centerX
     * @param {number} centerY
     */
    track(centerX, centerY) {
        this._rescan(centerX, centerY);
    }

    /**
     * No-op - see the top-of-file note on why the owning boss drives this entirely through track().
     */
    update() {}

    /**
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
     * Fades out across the beam's own cross-section (perpendicular to
     * travel) rather than along its length - a thin opaque core with soft
     * edges, same look for either axis.
     * @param {CanvasRenderingContext2D} ctx
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
