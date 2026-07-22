export class Collision {
    // oneWay: the primary layer only blocks when the entity falls onto it from
    // above (previous frame's bottom edge was at/above the tile's surface) -
    // jumping into it from below, or moving into it sideways, passes straight
    // through. Matches a level built from several stacked walkable floors
    // rather than solid walls (no separate "Platforms" layer needed).
    //
    // wallLayerName: an optional second layer that's always fully solid in
    // every direction regardless of `oneWay` - the terrain tileset also
    // includes vertical wall/ledge faces that should block sideways movement,
    // which the one-way primary layer deliberately never does. Tolerates a
    // level that doesn't have this layer yet (same "missing layer" handling
    // as the primary one) - opt-in per level as it gets painted in Tiled.
    constructor(level, layerName = 'Terrain/Collision', { oneWay = false, wallLayerName = null } = {}) {
        this.level = level;
        this.layerName = layerName;
        this.oneWay = oneWay;
        this.wallLayerName = wallLayerName;
    }

    isSolidAt(pxX, pxY) {
        return this._layerSolidAt(this.layerName, pxX, pxY)
            || (!!this.wallLayerName && this._layerSolidAt(this.wallLayerName, pxX, pxY));
    }

    _layerSolidAt(layerName, pxX, pxY) {
        const col = Math.floor(pxX / this.level.tileSize);
        const row = Math.floor(pxY / this.level.tileSize);
        if (col < 0 || row < 0 || col >= this.level.widthInTiles || row >= this.level.heightInTiles) return false;

        const tiles = this.level.layers[layerName];
        if (!tiles) return false;
        return tiles[row * this.level.widthInTiles + col] !== 0;
    }

    // Moves the entity by its current velocity and resolves overlaps against
    // solid tiles axis by axis (X then Y), so diagonal movement into a corner
    // doesn't get blocked by both axes at once. Returns whether the entity ends
    // up standing on solid ground.
    resolve(entity, dt) {
        entity.x += entity.vx * dt;
        this._resolveX(entity);
        this._clampToLevelX(entity);

        const previousBottom = entity.y + entity.height;
        entity.y += entity.vy * dt;
        return this._resolveY(entity, previousBottom);
    }

    // Keeps the entity inside the level's pixel width regardless of oneWay -
    // one-way terrain deliberately never blocks sideways movement (see
    // _resolveX), so without this the player could walk straight past the
    // level's left/right edge into the void.
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

    // The one-way primary layer never blocks horizontally (its whole point is
    // to only catch a fall from above) - the wall layer, if configured,
    // always does, regardless of `oneWay`.
    _blockedColumnX(pxX, yTop, yBottom) {
        if (!this.oneWay && this._columnSolid(this.layerName, pxX, yTop, yBottom)) return true;
        if (this.wallLayerName && this._columnSolid(this.wallLayerName, pxX, yTop, yBottom)) return true;
        return false;
    }

    _resolveY(entity, previousBottom) {
        const tileSize = this.level.tileSize;

        if (entity.vy > 0) {
            const bottomEdge = entity.y + entity.height;

            // Wall layer first - always catches, full solidity in every
            // direction like the primary layer would with oneWay: false.
            if (this.wallLayerName && this._rowSolid(this.wallLayerName, bottomEdge, entity.x, entity.x + entity.width)) {
                entity.y = Math.floor(bottomEdge / tileSize) * tileSize - entity.height;
                entity.vy = 0;
                return true;
            }

            if (this._rowSolid(this.layerName, bottomEdge, entity.x, entity.x + entity.width)) {
                const surfaceY = Math.floor(bottomEdge / tileSize) * tileSize;

                // One-way: only catches the entity if it was already at/above
                // this surface last frame (falling onto it) - otherwise it was
                // approaching from below/inside and should pass through.
                if (this.oneWay && previousBottom > surfaceY + 1) return false;

                entity.y = surfaceY - entity.height;
                entity.vy = 0;
                return true;
            }
        } else if (entity.vy < 0) {
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
        }
        return false;
    }

    _columnSolid(layerName, pxX, yTop, yBottom) {
        const step = this.level.tileSize;
        for (let y = yTop; y < yBottom; y += step) {
            if (this._layerSolidAt(layerName, pxX, y)) return true;
        }
        return this._layerSolidAt(layerName, pxX, yBottom - 1);
    }

    _rowSolid(layerName, pxY, xLeft, xRight) {
        const step = this.level.tileSize;
        for (let x = xLeft; x < xRight; x += step) {
            if (this._layerSolidAt(layerName, x, pxY)) return true;
        }
        return this._layerSolidAt(layerName, xRight - 1, pxY);
    }

    // Drop-Through-Platform (Player.js, replaces the originally-planned Duck -
    // 03_mechanics.md 4.2) safety check: is there an actual floor to land on
    // below the entity's *current* platform, or would dropping through just
    // walk it into the kill-plane/pit below? Not a naive "any solid tile
    // below" scan - this tileset's platforms are visually several tiles thick
    // (dirt continues below the walkable surface), so this first skips past
    // the current platform's own contiguous solid mass, then keeps scanning
    // the gap below that for a genuine next floor before the level ends.
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

    _solidAtRow(pxY, entity) {
        return this._rowSolid(this.layerName, pxY, entity.x, entity.x + entity.width)
            || (!!this.wallLayerName && this._rowSolid(this.wallLayerName, pxY, entity.x, entity.x + entity.width));
    }
}
