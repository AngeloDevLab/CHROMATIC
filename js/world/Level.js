const TILE_SIZE = 32;

// tilesetRegistry (constructor param): { [tsxBasename]: { image, columns } } -
// Tiled's own per-level `tilesets` array (firstgid + a source path to each
// .tsx) already says which gid ranges belong to which tileset; the registry
// just supplies the actual loaded image + column count for each one, keyed
// by that .tsx's filename. Lets a level mix tilesets with different images
// AND different column counts (a single shared image/column-count for the
// whole level used to be assumed - broke once a level mixed a 5- and a
// 9-column tileset, see getTileSourceRect()). Tiled itself numbers gids as
// one continuous sequence across every tileset a level uses, in firstgid
// order, so _tilesetFor()'s "current tileset for a gid" is whichever one
// started most recently at or before it - _buildTilesets() sorts ascending
// by firstGid so that scan can stop early. getTileTopPadding()/
// findGroundSurfaceY() exist because tile art may leave transparent padding
// within its 32x32 cell (e.g. grass tufts that don't fill the whole tile) -
// they find where the actual artwork starts so callers can ground a
// character on the visible surface rather than the raw grid line.
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
