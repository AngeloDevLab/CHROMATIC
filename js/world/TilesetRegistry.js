/**
 * Maps each Tiled tileset's basename (its .tsx filename, referenced in every
 * level's own `tilesets` array) to the manifest image key + column count
 * Level.js needs to resolve a tile's gid against. Update this whenever a new
 * tileset is added to the project.
 */
const TILESET_KEYS = {
    tileset_grass: { imageKey: 'prologue-tileset', columns: 5 },
    tileset_gravel: { imageKey: 'tileset-gravel', columns: 5 },
    tileset_scifilab: { imageKey: 'tileset-scifilab', columns: 9 },
};

/**
 * Resolves each known tileset basename to its already-loaded image and
 * column count, ready for Level.js to look up by tileset name.
 * @param {AssetLoader} assets - Loader holding the tileset images.
 * @returns {Object<string, {image: HTMLImageElement, columns: number}>}
 */
export function buildTilesetRegistry(assets) {
    const registry = {};
    for (const [basename, { imageKey, columns }] of Object.entries(TILESET_KEYS)) {
        registry[basename] = { image: assets.getImage(imageKey), columns };
    }
    return registry;
}
