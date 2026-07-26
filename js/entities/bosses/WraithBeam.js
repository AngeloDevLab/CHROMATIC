import { Entity } from '../Entity.js';

// Full-extent beam, not a slow travelling bolt (contrast
// entities/enemies/ShooterProjectile.js). Vertical position AND horizontal
// extent both re-derive every frame via trackY() below, from wherever the
// wraith currently is - not resolved once at construction, because the
// wraith keeps firing while it glides all the way from the top down to the
// ground (Wraith.js), and a `walls` segment (05_enemies-bosses.md 6.3.1's
// "vertical wall segments... block the beam") meant to cover only part of
// that height range needs to actually block it there, not just wherever the
// beam happened to first fire from. update() is deliberately a no-op -
// Wraith.js drives this entirely through trackY(), see that class for why.
// Same x/y/width/height/damage/direction/dead/update/render shape as
// ShooterProjectile.js otherwise, so it still plugs straight into
// LevelSession's existing enemyProjectiles pipeline
// (resolveEnemyProjectileHits in Combat.js, which kills it on the first
// hit) with no changes needed there.
const THICKNESS_PX = 36;
const STEP_PX = 8;

export class WraithBeam extends Entity {
    /**
     * @param {number} spawnCenterX - World X the beam fires from (the wraith's own X, fixed for its whole lifetime).
     * @param {number} spawnCenterY - World Y (center) the beam starts at.
     * @param {1|-1} direction - Which way the beam fires.
     * @param {Collision} collision - Level collision, for the `walls` scan in _rescan().
     * @param {number} damage - Damage dealt to the player on hit (Combat.js).
     */
    constructor(spawnCenterX, spawnCenterY, direction, collision, damage) {
        super(spawnCenterX, spawnCenterY - THICKNESS_PX / 2, 0, THICKNESS_PX);

        this.direction = direction;
        this.vx = 0;
        this.damage = damage;
        this.dead = false;

        this._collision = collision;
        // The wraith's own X - fixed, it never moves horizontally, only the
        // beam's reach (this.width) and height position change per frame.
        this._sourceX = spawnCenterX;

        this._rescan(spawnCenterY);
    }

    /**
     * Re-derives x/y/width for the wraith's CURRENT height - scans fresh
     * against `walls` every call instead of once, so a wall segment that
     * only covers part of the arena's height actually blocks the beam once
     * it descends to that row, rather than the reach computed way back at
     * the top (where a wall usually isn't even present) staying locked in
     * for the whole ensuing glide down.
     * @param {number} centerY - The wraith's current center Y.
     */
    _rescan(centerY) {
        const levelEdgeX = this.direction === 1 ? this._collision.level.pixelWidth : 0;

        let stopX = this._sourceX;
        while (this.direction === 1 ? stopX < levelEdgeX : stopX > levelEdgeX) {
            const nextX = stopX + this.direction * STEP_PX;
            if (this._collision.isWallAt(nextX, centerY)) break;
            stopX = this.direction === 1 ? Math.min(nextX, levelEdgeX) : Math.max(nextX, levelEdgeX);
        }

        this.x = this.direction === 1 ? this._sourceX : stopX;
        this.width = Math.max(0, Math.abs(stopX - this._sourceX));
        this.y = centerY - this.height / 2;
    }

    /**
     * Wraith.js calls this every frame while it's still firing/descending.
     * @param {number} centerY - The wraith's current center Y.
     */
    trackY(centerY) {
        this._rescan(centerY);
    }

    /**
     * No-op - see the top-of-file note on why Wraith.js drives this entirely through trackY().
     */
    update() {}

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.dead || this.width <= 0) return;

        ctx.save();
        const gradient = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
        gradient.addColorStop(0, 'rgba(180, 90, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(200, 140, 255, 0.85)');
        gradient.addColorStop(1, 'rgba(180, 90, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
