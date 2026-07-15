export class Collision {
    // oneWay: the layer only blocks when the entity falls onto it from above
    // (previous frame's bottom edge was at/above the tile's surface) - jumping
    // into it from below, or moving into it sideways, passes straight through.
    // Matches a level built from several stacked walkable floors rather than
    // solid walls (no separate "Platforms" layer needed).
    constructor(level, layerName = 'Terrain/Collision', { oneWay = false } = {}) {
        this.level = level;
        this.layerName = layerName;
        this.oneWay = oneWay;
    }

    isSolidAt(pxX, pxY) {
        const col = Math.floor(pxX / this.level.tileSize);
        const row = Math.floor(pxY / this.level.tileSize);
        if (col < 0 || row < 0 || col >= this.level.widthInTiles || row >= this.level.heightInTiles) return false;

        const tiles = this.level.layers[this.layerName];
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
        if (this.oneWay) return;

        const tileSize = this.level.tileSize;
        if (entity.vx > 0) {
            const rightEdge = entity.x + entity.width;
            if (this._columnSolid(rightEdge, entity.y, entity.y + entity.height)) {
                entity.x = Math.floor(rightEdge / tileSize) * tileSize - entity.width;
                entity.vx = 0;
            }
        } else if (entity.vx < 0) {
            if (this._columnSolid(entity.x, entity.y, entity.y + entity.height)) {
                entity.x = (Math.floor(entity.x / tileSize) + 1) * tileSize;
                entity.vx = 0;
            }
        }
    }

    _resolveY(entity, previousBottom) {
        const tileSize = this.level.tileSize;

        if (entity.vy > 0) {
            const bottomEdge = entity.y + entity.height;
            if (this._rowSolid(bottomEdge, entity.x, entity.x + entity.width)) {
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
            if (this.oneWay) return false;

            if (this._rowSolid(entity.y, entity.x, entity.x + entity.width)) {
                entity.y = (Math.floor(entity.y / tileSize) + 1) * tileSize;
                entity.vy = 0;
            }
        }
        return false;
    }

    _columnSolid(pxX, yTop, yBottom) {
        const step = this.level.tileSize;
        for (let y = yTop; y < yBottom; y += step) {
            if (this.isSolidAt(pxX, y)) return true;
        }
        return this.isSolidAt(pxX, yBottom - 1);
    }

    _rowSolid(pxY, xLeft, xRight) {
        const step = this.level.tileSize;
        for (let x = xLeft; x < xRight; x += step) {
            if (this.isSolidAt(x, pxY)) return true;
        }
        return this.isSolidAt(xRight - 1, pxY);
    }
}
