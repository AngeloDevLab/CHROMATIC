const TILE_SIZE = 32;

export class Level {
    // tilesetRegistry: { [tsxBasename]: { image, columns } } - Tiled's own
    // per-level `tilesets` array (firstgid + a source path to each .tsx)
    // already says which gid ranges belong to which tileset; this just
    // supplies the actual loaded image + column count for each one, keyed by
    // that .tsx's filename. Lets a level mix tilesets with different images
    // AND different column counts (a single shared image/column-count for
    // the whole level used to be assumed - broke once a level mixed a 5- and
    // a 9-column tileset, see getTileSourceRect() below).
    constructor(data, tilesetRegistry, tileSize = TILE_SIZE) {
        this.data = data;
        this.tileSize = tileSize;

        this.widthInTiles = data.width;
        this.heightInTiles = data.height;
        this.pixelWidth = this.widthInTiles * tileSize;
        this.pixelHeight = this.heightInTiles * tileSize;

        // Sorted ascending by firstGid so _tilesetFor()'s scan can stop at
        // the last one whose firstGid is still <= the gid being looked up.
        this.tilesets = data.tilesets
            .map((ts) => {
                const basename = ts.source.split('/').pop().replace(/\.tsx$/, '');
                const entry = tilesetRegistry[basename];
                if (!entry) throw new Error(`Level: no tileset registered for "${basename}"`);
                return { firstGid: ts.firstgid, image: entry.image, columns: entry.columns };
            })
            .sort((a, b) => a.firstGid - b.firstGid);

        this.layers = {};
        this.layerOrder = [];
        this.objects = [];
        for (const layer of data.layers) {
            if (layer.type === 'tilelayer') {
                this.layers[layer.name] = layer.data;
                this.layerOrder.push(layer.name);
            } else if (layer.type === 'objectgroup') {
                for (const obj of layer.objects) {
                    // Tiled's "properties" is an array of { name, type, value } -
                    // flatten to a plain object (e.g. enemyType) for easy lookup,
                    // matching 10_technical-architecture.md 11.6.2.
                    const properties = {};
                    for (const prop of obj.properties ?? []) {
                        properties[prop.name] = prop.value;
                    }
                    this.objects.push({
                        id: obj.id,
                        type: obj.type,
                        name: obj.name,
                        x: obj.x,
                        y: obj.y,
                        width: obj.width,
                        height: obj.height,
                        properties,
                    });
                }
            }
        }
    }

    getObjectsByType(type) {
        return this.objects.filter((obj) => obj.type === type);
    }

    static load(assetLoader, jsonKey, tilesetRegistry) {
        const data = assetLoader.getJSON(jsonKey);
        if (!data) {
            throw new Error(`Level.load: JSON not ready (${jsonKey})`);
        }
        return new Level(data, tilesetRegistry);
    }

    // Last tileset (in firstGid order) that this gid could belong to - Tiled
    // itself numbers gids as one continuous sequence across every tileset a
    // level uses, in firstgid order, so the "current" tileset for a gid is
    // whichever one started most recently at or before it.
    _tilesetFor(gid) {
        let found = this.tilesets[0];
        for (const tileset of this.tilesets) {
            if (tileset.firstGid <= gid) found = tileset;
            else break;
        }
        return found;
    }

    getTileSourceRect(gid) {
        const tileset = this._tilesetFor(gid);
        const localIndex = gid - tileset.firstGid;
        return {
            image: tileset.image,
            sx: (localIndex % tileset.columns) * this.tileSize,
            sy: Math.floor(localIndex / tileset.columns) * this.tileSize,
        };
    }

    drawLayer(ctx, layerName) {
        const tiles = this.layers[layerName];
        if (!tiles) return;

        for (let i = 0; i < tiles.length; i++) {
            const gid = tiles[i];
            if (gid === 0) continue;

            const { image, sx, sy } = this.getTileSourceRect(gid);
            const col = i % this.widthInTiles;
            const row = Math.floor(i / this.widthInTiles);

            ctx.drawImage(
                image,
                sx, sy, this.tileSize, this.tileSize,
                col * this.tileSize, row * this.tileSize, this.tileSize, this.tileSize
            );
        }
    }

    drawLayers(ctx, layerNames) {
        for (const name of layerNames) this.drawLayer(ctx, name);
    }

    drawAllLayers(ctx) {
        this.drawLayers(ctx, this.layerOrder);
    }

    // Tile art may leave transparent padding within its 32x32 cell (e.g. grass
    // tufts that don't fill the whole tile) - this finds how many pixels from the
    // top of the cell are empty before the actual artwork starts, so callers can
    // ground a character on the visible surface rather than the raw grid line.
    getTileTopPadding(gid) {
        this._topPaddingCache ??= new Map();
        if (this._topPaddingCache.has(gid)) return this._topPaddingCache.get(gid);

        const { image, sx, sy } = this.getTileSourceRect(gid);
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, sx, sy, this.tileSize, this.tileSize, 0, 0, this.tileSize, this.tileSize);

        const { data } = ctx.getImageData(0, 0, this.tileSize, this.tileSize);
        let topPadding = this.tileSize;
        outer:
        for (let row = 0; row < this.tileSize; row++) {
            for (let col = 0; col < this.tileSize; col++) {
                if (data[(row * this.tileSize + col) * 4 + 3] > 0) {
                    topPadding = row;
                    break outer;
                }
            }
        }

        this._topPaddingCache.set(gid, topPadding);
        return topPadding;
    }

    // World-space Y (pixels) where the ground actually becomes visually solid in
    // the given column - the tile grid row where a tile first appears, plus that
    // tile's own transparent padding. Used by static scenes (e.g. the menu
    // background) to ground a character without hardcoding a row or padding value.
    findGroundSurfaceY(column = Math.floor(this.widthInTiles / 2)) {
        for (let row = 0; row < this.heightInTiles; row++) {
            const index = row * this.widthInTiles + column;
            for (const name of this.layerOrder) {
                const gid = this.layers[name][index];
                if (gid !== 0) {
                    return row * this.tileSize + this.getTileTopPadding(gid);
                }
            }
        }
        return this.heightInTiles * this.tileSize;
    }
}
