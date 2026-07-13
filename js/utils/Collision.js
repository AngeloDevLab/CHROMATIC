export class Collision {
    constructor(level, layerName = 'Terrain/Collision') {
        this.level = level;
        this.layerName = layerName;
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
        this._resolveAxis(entity, 'x');

        entity.y += entity.vy * dt;
        return this._resolveAxis(entity, 'y');
    }

    _resolveAxis(entity, axis) {
        const tileSize = this.level.tileSize;

        if (axis === 'x') {
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
            return false;
        }

        if (entity.vy > 0) {
            const bottomEdge = entity.y + entity.height;
            if (this._rowSolid(bottomEdge, entity.x, entity.x + entity.width)) {
                entity.y = Math.floor(bottomEdge / tileSize) * tileSize - entity.height;
                entity.vy = 0;
                return true;
            }
        } else if (entity.vy < 0) {
            if (this._rowSolid(entity.y, entity.x, entity.x + entity.width)) {
                entity.y = (Math.floor(entity.y / tileSize) + 1) * tileSize;
                entity.vy = 0;
            }
        }
        return false;
    }

    // Checks every tile-size step across the span (not just the two endpoints),
    // so a tall/wide entity can't tunnel past a solid tile that only touches its
    // middle when unaligned with the grid.
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
