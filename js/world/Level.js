const TILE_SIZE = 32;

// Tiled numbers gids as one continuous sequence across a level's tilesets,
// in firstgid order; _tilesetFor() finds the tileset that started most
// recently at or before a given gid. getTileTopPadding()/findGroundSurfaceY()
// exist because tile art can leave transparent padding within its cell, so
// grounding uses where the artwork visually starts, not the raw grid line.
export class Level {
    /**
     * @param {object} data - Raw Tiled JSON export.
     * @param {Object<string, {image: HTMLImageElement, columns: number}>} tilesetRegistry - See the top-of-file note.
     * @param {number} [tileSize=TILE_SIZE] - Tile edge length, in pixels.
     */
    constructor(data, tilesetRegistry, tileSize = TILE_SIZE) {
        this.data = data;
        this.tileSize = tileSize;
        this.widthInTiles = data.width;
        this.heightInTiles = data.height;
        this.pixelWidth = this.widthInTiles * tileSize;
        this.pixelHeight = this.heightInTiles * tileSize;
        this.tilesets = this._buildTilesets(data, tilesetRegistry);
        this._buildLayersAndObjects(data);
    }

    /**
     * @param {object} data - Raw Tiled JSON export.
     * @param {Object<string, {image: HTMLImageElement, columns: number}>} tilesetRegistry
     * @returns {{firstGid: number, image: HTMLImageElement, columns: number}[]} Sorted ascending by firstGid.
     */
    _buildTilesets(data, tilesetRegistry) {
        return data.tilesets
            .map((ts) => {
                const basename = ts.source.split('/').pop().replace(/\.tsx$/, '');
                const entry = tilesetRegistry[basename];
                if (!entry) throw new Error(`Level: no tileset registered for "${basename}"`);
                return { firstGid: ts.firstgid, image: entry.image, columns: entry.columns };
            })
            .sort((a, b) => a.firstGid - b.firstGid);
    }

    /**
     * Splits Tiled's layers into tilelayers (rendered by name/order, see
     * drawLayer()) and objectgroups (flattened into spawn markers).
     * @param {object} data - Raw Tiled JSON export.
     */
    _buildLayersAndObjects(data) {
        this.layers = {};
        this.layerOrder = [];
        this.objects = [];
        for (const layer of data.layers) {
            if (layer.type === 'tilelayer') {
                this.layers[layer.name] = layer.data;
                this.layerOrder.push(layer.name);
            } else if (layer.type === 'objectgroup') {
                for (const obj of layer.objects) this.objects.push(this._flattenObject(obj));
            }
        }
    }

    /**
     * Flattens Tiled's `properties: [{name, type, value}]` array into a
     * plain object (10_technical-architecture.md 11.6.2).
     * @param {object} obj - Raw Tiled object from an objectgroup.
     * @returns {{id: number, type: string, name: string, x: number, y: number, width: number, height: number, properties: object}}
     */
    _flattenObject(obj) {
        const properties = {};
        for (const prop of obj.properties ?? []) {
            properties[prop.name] = prop.value;
        }
        return { id: obj.id, type: obj.type, name: obj.name, x: obj.x, y: obj.y, width: obj.width, height: obj.height, properties };
    }

    /**
     * @param {string} type - Object marker type (e.g. 'PlayerStart', 'EnemySpawn').
     * @returns {object[]} Matching flattened objects.
     */
    getObjectsByType(type) {
        return this.objects.filter((obj) => obj.type === type);
    }

    /**
     * @param {AssetLoader} assetLoader - Loader holding the level's JSON.
     * @param {string} jsonKey - Key the level JSON was loaded under.
     * @param {Object<string, {image: HTMLImageElement, columns: number}>} tilesetRegistry
     * @returns {Level}
     */
    static load(assetLoader, jsonKey, tilesetRegistry) {
        const data = assetLoader.getJSON(jsonKey);
        if (!data) {
            throw new Error(`Level.load: JSON not ready (${jsonKey})`);
        }
        return new Level(data, tilesetRegistry);
    }

    /**
     * @param {number} gid - Tiled global tile id.
     * @returns {{firstGid: number, image: HTMLImageElement, columns: number}} The tileset this gid belongs to.
     */
    _tilesetFor(gid) {
        let found = this.tilesets[0];
        for (const tileset of this.tilesets) {
            if (tileset.firstGid <= gid) found = tileset;
            else break;
        }
        return found;
    }

    /**
     * @param {number} gid - Tiled global tile id.
     * @returns {{image: HTMLImageElement, sx: number, sy: number}} Source rect within that tileset's image.
     */
    getTileSourceRect(gid) {
        const tileset = this._tilesetFor(gid);
        const localIndex = gid - tileset.firstGid;
        return {
            image: tileset.image,
            sx: (localIndex % tileset.columns) * this.tileSize,
            sy: Math.floor(localIndex / tileset.columns) * this.tileSize,
        };
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     * @param {string} layerName - Tilelayer to draw.
     */
    drawLayer(ctx, layerName) {
        const tiles = this.layers[layerName];
        if (!tiles) return;

        for (let i = 0; i < tiles.length; i++) {
            if (tiles[i] !== 0) this._drawTile(ctx, tiles[i], i);
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     * @param {number} gid - Tile's global ID.
     * @param {number} index - Tile's index within the layer array.
     */
    _drawTile(ctx, gid, index) {
        const { image, sx, sy } = this.getTileSourceRect(gid);
        const col = index % this.widthInTiles;
        const row = Math.floor(index / this.widthInTiles);

        ctx.drawImage(
            image,
            sx, sy, this.tileSize, this.tileSize,
            col * this.tileSize, row * this.tileSize, this.tileSize, this.tileSize
        );
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     * @param {string[]} layerNames - Tilelayers to draw, in order.
     */
    drawLayers(ctx, layerNames) {
        for (const name of layerNames) this.drawLayer(ctx, name);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     */
    drawAllLayers(ctx) {
        this.drawLayers(ctx, this.layerOrder);
    }

    /**
     * @param {number} gid - Tiled global tile id.
     * @returns {number} Rows of transparent padding above the visible art, cached per gid.
     */
    getTileTopPadding(gid) {
        this._topPaddingCache ??= new Map();
        if (this._topPaddingCache.has(gid)) return this._topPaddingCache.get(gid);

        const topPadding = this._computeTopPadding(gid);
        this._topPaddingCache.set(gid, topPadding);
        return topPadding;
    }

    /**
     * Renders one tile to a scratch canvas and finds how many pixels from
     * the top of its cell are empty before the actual artwork starts.
     * @param {number} gid - Tiled global tile id.
     * @returns {number} Rows of transparent padding above the visible art.
     */
    _computeTopPadding(gid) {
        const { image, sx, sy } = this.getTileSourceRect(gid);
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, sx, sy, this.tileSize, this.tileSize, 0, 0, this.tileSize, this.tileSize);

        const { data } = ctx.getImageData(0, 0, this.tileSize, this.tileSize);
        for (let row = 0; row < this.tileSize; row++) {
            for (let col = 0; col < this.tileSize; col++) {
                if (data[(row * this.tileSize + col) * 4 + 3] > 0) return row;
            }
        }
        return this.tileSize;
    }

    /**
     * World-space Y (pixels) where the ground actually becomes visually
     * solid in the given column - used by static scenes (e.g. the menu
     * background) to ground a character without hardcoding a row/padding value.
     * @param {number} [column] - Tile column to probe; defaults to the level's horizontal center.
     * @returns {number} World-space Y of the visible ground surface.
     */
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
