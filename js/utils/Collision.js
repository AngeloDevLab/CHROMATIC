export class Collision {
    /**
     * @param {Level} level - Level whose tile layers to collide against.
     * @param {string} [layerName='Terrain/Collision'] - Primary collision layer name.
     * @param {object} [options]
     * @param {boolean} [options.oneWay=false] - The primary layer only blocks when the
     *   entity falls onto it from above (previous frame's bottom edge was at/above the
     *   tile's surface) - jumping into it from below, or moving into it sideways, passes
     *   straight through. Matches a level built from several stacked walkable floors
     *   rather than solid walls (no separate "Platforms" layer needed).
     * @param {string|null} [options.wallLayerName=null] - Optional second layer that's
     *   always fully solid in every direction regardless of `oneWay` - the terrain
     *   tileset also includes vertical wall/ledge faces that should block sideways
     *   movement, which the one-way primary layer deliberately never does. Tolerates a
     *   level that doesn't have this layer yet, same as the primary one - opt-in per
     *   level as it gets painted in Tiled.
     * @param {string|null} [options.noDropLayerName=null] - Optional third layer marking
     *   specific one-way platforms as exempt from Player.js's Drop-Through-Platform
     *   ability (see isNoDropBelow()) - still a normal landable-from-above one-way floor
     *   otherwise. Needed once a level relies on specific platforms staying put (Lvl 4/5's
     *   gimmick/secret layouts).
     */
    constructor(level, layerName = 'Terrain/Collision', { oneWay = false, wallLayerName = null, noDropLayerName = null } = {}) {
        this.level = level;
        this.layerName = layerName;
        this.oneWay = oneWay;
        this.wallLayerName = wallLayerName;
        this.noDropLayerName = noDropLayerName;
    }

    /**
     * @param {number} pxX - World X, pixels.
     * @param {number} pxY - World Y, pixels.
     * @returns {boolean} Whether either the primary or wall layer is solid here.
     */
    isSolidAt(pxX, pxY) {
        return this._layerSolidAt(this.layerName, pxX, pxY)
            || (!!this.wallLayerName && this._layerSolidAt(this.wallLayerName, pxX, pxY));
    }

    /**
     * Wall-layer-only check (Boss.js/WraithBeam.js) - deliberately excludes
     * the one-way terrain layer isSolidAt() also checks, since a boss beam
     * should only be blocked by real walls (05_enemies-bosses.md 6.3.1's
     * "vertical wall segments... block the beam"), not by a horizontal
     * platform it's flying past at the same height.
     * @param {number} pxX - World X, pixels.
     * @param {number} pxY - World Y, pixels.
     * @returns {boolean} Whether the wall layer is solid here.
     */
    isWallAt(pxX, pxY) {
        return !!this.wallLayerName && this._layerSolidAt(this.wallLayerName, pxX, pxY);
    }

    /**
     * @param {string} layerName - Tile layer to check.
     * @param {number} pxX - World X, pixels.
     * @param {number} pxY - World Y, pixels.
     * @returns {boolean} Whether that layer has a non-empty tile at this pixel.
     */
    _layerSolidAt(layerName, pxX, pxY) {
        const col = Math.floor(pxX / this.level.tileSize);
        const row = Math.floor(pxY / this.level.tileSize);
        if (col < 0 || row < 0 || col >= this.level.widthInTiles || row >= this.level.heightInTiles) return false;

        const tiles = this.level.layers[layerName];
        if (!tiles) return false;
        return tiles[row * this.level.widthInTiles + col] !== 0;
    }

    /**
     * Moves the entity by its current velocity and resolves overlaps
     * against solid tiles axis by axis (X then Y), so diagonal movement
     * into a corner doesn't get blocked by both axes at once.
     * @param {Entity} entity - Entity to move and resolve.
     * @param {number} dt - Elapsed time in seconds.
     * @returns {boolean} Whether the entity ends up standing on solid ground.
     */
    resolve(entity, dt) {
        entity.x += entity.vx * dt;
        this._resolveX(entity);
        this._clampToLevelX(entity);

        const previousBottom = entity.y + entity.height;
        entity.y += entity.vy * dt;
        return this._resolveY(entity, previousBottom);
    }

    /**
     * Keeps the entity inside the level's pixel width regardless of
     * `oneWay` - one-way terrain deliberately never blocks sideways
     * movement (see _resolveX()), so without this the player could walk
     * straight past the level's left/right edge into the void.
     * @param {Entity} entity - Entity to clamp.
     */
    _clampToLevelX(entity) {
        const maxX = this.level.pixelWidth - entity.width;
        if (entity.x < 0) {
            entity.x = 0;
            if (entity.vx < 0) entity.vx = 0;
        } else if (entity.x > maxX) {
            entity.x = maxX;
            if (entity.vx > 0) entity.vx = 0;
        }
    }

    /**
     * @param {Entity} entity - Entity whose X movement to resolve.
     */
    _resolveX(entity) {
        const tileSize = this.level.tileSize;
        if (entity.vx > 0) {
            const rightEdge = entity.x + entity.width;
            if (this._blockedColumnX(rightEdge, entity.y, entity.y + entity.height)) {
                entity.x = Math.floor(rightEdge / tileSize) * tileSize - entity.width;
                entity.vx = 0;
            }
        } else if (entity.vx < 0) {
            if (this._blockedColumnX(entity.x, entity.y, entity.y + entity.height)) {
                entity.x = (Math.floor(entity.x / tileSize) + 1) * tileSize;
                entity.vx = 0;
            }
        }
    }

    /**
     * The one-way primary layer never blocks horizontally (its whole point
     * is to only catch a fall from above) - the wall layer, if configured,
     * always does, regardless of `oneWay`.
     * @param {number} pxX - World X, pixels.
     * @param {number} yTop - Top of the entity's vertical span.
     * @param {number} yBottom - Bottom of the entity's vertical span.
     * @returns {boolean} Whether this column is blocked.
     */
    _blockedColumnX(pxX, yTop, yBottom) {
        if (!this.oneWay && this._columnSolid(this.layerName, pxX, yTop, yBottom)) return true;
        if (this.wallLayerName && this._columnSolid(this.wallLayerName, pxX, yTop, yBottom)) return true;
        return false;
    }

    /**
     * @param {Entity} entity - Entity whose Y movement to resolve.
     * @param {number} previousBottom - Entity's bottom edge before this frame's Y movement.
     * @returns {boolean} Whether the entity ends up standing on solid ground.
     */
    _resolveY(entity, previousBottom) {
        if (entity.vy > 0) return this._resolveFalling(entity, previousBottom);
        if (entity.vy < 0) return this._resolveRising(entity);
        return false;
    }

    /**
     * Falling (vy>0): the wall layer, if configured, always catches, full
     * solidity in every direction. The one-way primary layer only catches
     * if the entity was already at/above the surface last frame (landing
     * onto it from above) - otherwise it was approaching from below/inside
     * and should pass through.
     * @param {Entity} entity - Entity whose Y movement to resolve.
     * @param {number} previousBottom - Entity's bottom edge before this frame's Y movement.
     * @returns {boolean} Whether the entity is now standing on solid ground.
     */
    _resolveFalling(entity, previousBottom) {
        const tileSize = this.level.tileSize;
        const bottomEdge = entity.y + entity.height;

        if (this.wallLayerName && this._rowSolid(this.wallLayerName, bottomEdge, entity.x, entity.x + entity.width)) {
            return this._snapOntoSurface(entity, bottomEdge, tileSize);
        }

        if (this._rowSolid(this.layerName, bottomEdge, entity.x, entity.x + entity.width)) {
            const surfaceY = Math.floor(bottomEdge / tileSize) * tileSize;
            if (this.oneWay && previousBottom > surfaceY + 1) return false;
            return this._snapOntoSurface(entity, bottomEdge, tileSize);
        }
        return false;
    }

    /**
     * Snaps the entity's bottom edge to the tile boundary at/above
     * bottomEdge and zeroes its fall speed - shared by both the wall-layer
     * and primary-layer catch branches above.
     * @param {Entity} entity - Entity to snap onto the surface.
     * @param {number} bottomEdge - Entity's bottom edge this frame.
     * @param {number} tileSize - Level tile size in pixels.
     * @returns {true}
     */
    _snapOntoSurface(entity, bottomEdge, tileSize) {
        entity.y = Math.floor(bottomEdge / tileSize) * tileSize - entity.height;
        entity.vy = 0;
        return true;
    }

    /**
     * Rising (vy<0): the wall layer, if configured, always blocks. The
     * one-way primary layer never blocks upward movement at all (jumping
     * up through a platform is exactly what one-way floors are for).
     * @param {Entity} entity - Entity whose Y movement to resolve.
     * @returns {boolean} Always false - rising never counts as "standing on ground".
     */
    _resolveRising(entity) {
        const tileSize = this.level.tileSize;

        if (this.wallLayerName && this._rowSolid(this.wallLayerName, entity.y, entity.x, entity.x + entity.width)) {
            entity.y = (Math.floor(entity.y / tileSize) + 1) * tileSize;
            entity.vy = 0;
            return false;
        }

        if (this.oneWay) return false;

        if (this._rowSolid(this.layerName, entity.y, entity.x, entity.x + entity.width)) {
            entity.y = (Math.floor(entity.y / tileSize) + 1) * tileSize;
            entity.vy = 0;
        }
        return false;
    }

    /**
     * @param {string} layerName - Tile layer to check.
     * @param {number} pxX - World X, pixels.
     * @param {number} yTop - Top of the vertical span to scan.
     * @param {number} yBottom - Bottom of the vertical span to scan.
     * @returns {boolean} Whether any tile along that column is solid.
     */
    _columnSolid(layerName, pxX, yTop, yBottom) {
        const step = this.level.tileSize;
        for (let y = yTop; y < yBottom; y += step) {
            if (this._layerSolidAt(layerName, pxX, y)) return true;
        }
        return this._layerSolidAt(layerName, pxX, yBottom - 1);
    }

    /**
     * @param {string} layerName - Tile layer to check.
     * @param {number} pxY - World Y, pixels.
     * @param {number} xLeft - Left of the horizontal span to scan.
     * @param {number} xRight - Right of the horizontal span to scan.
     * @returns {boolean} Whether any tile along that row is solid.
     */
    _rowSolid(layerName, pxY, xLeft, xRight) {
        const step = this.level.tileSize;
        for (let x = xLeft; x < xRight; x += step) {
            if (this._layerSolidAt(layerName, x, pxY)) return true;
        }
        return this._layerSolidAt(layerName, xRight - 1, pxY);
    }

    /**
     * Drop-Through-Platform (Player.js, replaces the originally-planned
     * Duck - 03_mechanics.md 4.2) safety check: is there an actual floor to
     * land on below the entity's *current* platform, or would dropping
     * through just walk it into the kill-plane/pit below? Not a naive "any
     * solid tile below" scan - this tileset's platforms are visually
     * several tiles thick (dirt continues below the walkable surface), so
     * this first skips past the current platform's own contiguous solid
     * mass, then keeps scanning the gap below that for a genuine next
     * floor before the level ends.
     * @param {Entity} entity - Entity considering a drop.
     * @returns {boolean} Whether a real floor exists below the current platform.
     */
    hasFloorBelow(entity) {
        const tileSize = this.level.tileSize;
        let y = entity.y + entity.height + tileSize;

        while (y < this.level.pixelHeight && this._solidAtRow(y, entity)) {
            y += tileSize;
        }
        for (; y < this.level.pixelHeight; y += tileSize) {
            if (this._solidAtRow(y, entity)) return true;
        }
        return false;
    }

    /**
     * @param {number} pxY - World Y, pixels.
     * @param {Entity} entity - Entity whose width to scan across.
     * @returns {boolean} Whether the primary or wall layer is solid across the entity's width at this Y.
     */
    _solidAtRow(pxY, entity) {
        return this._rowSolid(this.layerName, pxY, entity.x, entity.x + entity.width)
            || (!!this.wallLayerName && this._rowSolid(this.wallLayerName, pxY, entity.x, entity.x + entity.width));
    }

    /**
     * Player.js checks this alongside hasFloorBelow() before honoring a
     * drop press - true when the platform the entity is currently resting
     * on (the row right at its own feet, not the gap below like
     * hasFloorBelow() scans) is marked on the noDropLayerName layer.
     * @param {Entity} entity - Entity considering a drop.
     * @returns {boolean} Whether the entity's current platform is drop-exempt.
     */
    isNoDropBelow(entity) {
        if (!this.noDropLayerName) return false;
        return this._rowSolid(this.noDropLayerName, entity.y + entity.height, entity.x, entity.x + entity.width);
    }
}
