const TILE_SIZE = 32;

export class Level {
    constructor(data, tilesetImage, tileSize = TILE_SIZE) {
        this.data = data;
        this.tilesetImage = tilesetImage;
        this.tileSize = tileSize;

        this.widthInTiles = data.width;
        this.heightInTiles = data.height;
        this.pixelWidth = this.widthInTiles * tileSize;
        this.pixelHeight = this.heightInTiles * tileSize;

        this.tilesetColumns = Math.floor(this.tilesetImage.width / tileSize);

        this.layers = {};
        this.layerOrder = [];
        for (const layer of data.layers) {
            if (layer.type === 'tilelayer') {
                this.layers[layer.name] = layer.data;
                this.layerOrder.push(layer.name);
            }
        }
    }

    static load(assetLoader, jsonKey, tilesetKey) {
        const data = assetLoader.getJSON(jsonKey);
        const tilesetImage = assetLoader.getImage(tilesetKey);
        if (!data || !tilesetImage) {
            throw new Error(`Level.load: assets not ready (${jsonKey} / ${tilesetKey})`);
        }
        return new Level(data, tilesetImage);
    }

    getTileSourceRect(gid) {
        const tileIndex = gid - 1;
        return {
            sx: (tileIndex % this.tilesetColumns) * this.tileSize,
            sy: Math.floor(tileIndex / this.tilesetColumns) * this.tileSize,
        };
    }

    drawLayer(ctx, layerName) {
        const tiles = this.layers[layerName];
        if (!tiles) return;

        for (let i = 0; i < tiles.length; i++) {
            const gid = tiles[i];
            if (gid === 0) continue;

            const { sx, sy } = this.getTileSourceRect(gid);
            const col = i % this.widthInTiles;
            const row = Math.floor(i / this.widthInTiles);

            ctx.drawImage(
                this.tilesetImage,
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

        const { sx, sy } = this.getTileSourceRect(gid);
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.tilesetImage, sx, sy, this.tileSize, this.tileSize, 0, 0, this.tileSize, this.tileSize);

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
