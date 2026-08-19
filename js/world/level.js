// Tiled numbers gids as one continuous sequence across a level's tilesets, in firstgid order.

const tile_size = 32;

/** A parsed Tiled level: tilesets, tile layers, and object markers. */
export class Level {
    /**
     * Parses a Tiled JSON export into tilesets, layers, and object markers.
     * @param {object} data - Raw Tiled JSON export.
     * @param {Object<string, {image: HTMLImageElement, columns: number}>} tilesetRegistry - Loaded tileset images keyed by basename (see tileset-registry.js).
     * @param {number} [tileSize=tile_size] - Tile edge length, in pixels.
     */
    constructor(data, tilesetRegistry, tileSize = tile_size) {
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
     * Resolves each Tiled tileset reference against the registry.
     * @param {object} data - Raw Tiled JSON export.
     * @param {Object<string, {image: HTMLImageElement, columns: number}>} tilesetRegistry - Loaded tileset images keyed by basename.
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
     * Flattens Tiled's `properties: [{name, type, value}]` array into a plain object.
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
     * Looks up every spawn marker of a given type.
     * @param {string} type - Object marker type (e.g. 'PlayerStart', 'EnemySpawn').
     * @returns {object[]} Matching flattened objects.
     */
    getObjectsByType(type) {
        return this.objects.filter((obj) => obj.type === type);
    }

    /**
     * Builds a Level from a JSON already loaded via AssetLoader.
     * @param {AssetLoader} assetLoader - Loader holding the level's JSON.
     * @param {string} jsonKey - Key the level JSON was loaded under.
     * @param {Object<string, {image: HTMLImageElement, columns: number}>} tilesetRegistry - Loaded tileset images keyed by basename.
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
     * Finds which tileset a global tile id falls into.
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
     * Converts a global tile id into its pixel source rect on the sheet.
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
     * Draws every non-empty tile in one named layer.
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
     * Draws a single tile at its grid position within the layer.
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
     * Draws multiple named layers in order.
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     * @param {string[]} layerNames - Tilelayers to draw, in order.
     */
    drawLayers(ctx, layerNames) {
        for (const name of layerNames) this.drawLayer(ctx, name);
    }

    /**
     * Draws every tilelayer in the level, in its original Tiled order.
     * @param {CanvasRenderingContext2D} ctx - Destination context.
     */
    drawAllLayers(ctx) {
        this.drawLayers(ctx, this.layerOrder);
    }

    /**
     * Cached lookup of a tile's top transparent padding.
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
